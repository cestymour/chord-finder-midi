// Mode micro, moteur B : transcription par un réseau de neurones (Basic Pitch).
//
// Basic Pitch (Spotify, licence Apache 2.0, modèle dans public/models/basic-pitch/)
// transcrit l'audio en notes : pour une fenêtre de 2 s à 22 050 Hz, il donne
// 172 trames (une toutes les 11,6 ms) × 88 touches (La0 à Do8), chacune avec la
// probabilité que la note sonne. Il gère bien mieux que le moteur A les harmoniques
// et l'octave des notes, mais il est plus lourd (TensorFlow.js et 900 Ko de modèle,
// chargés seulement quand on choisit « Micro B ») et plus gourmand en calcul.
//
// En temps réel, on lui donne à chaque fois les 2 dernières secondes du micro et on
// lit ses trames les plus récentes, sauf les toutes dernières : au bord de la
// fenêtre, le réseau manque de contexte (Basic Pitch en écarte 15 de chaque côté).
//
// Ce module est pur (sans React ni TensorFlow) : le modèle lui est passé tout prêt
// par micBasicPitchModel.js, ce qui permet de le tester avec un faux modèle.

import { levelDb } from "./micChroma.js";

export const MODEL_SAMPLE_RATE = 22050;
export const MODEL_SAMPLES = 43844; // 2 s moins un pas de 256 échantillons
export const MODEL_FRAMES = 172;
const FRAME_SAMPLES = 256;
const FIRST_MIDI = 21;

// Trames lues : les EDGE_FRAMES dernières sont écartées, puis on prend le maximum
// sur READ_FRAMES trames (environ 140 ms, de 175 à 315 ms avant l'instant présent)
export const EDGE_FRAMES = 15;
export const READ_FRAMES = 12;
// Probabilité en dessous de laquelle une note n'est pas transmise au suivi
const MIN_PROBABILITY = 0.1;

/** Seuils du suivi (micTracker.js) pour ce moteur : probabilités absolues. */
export const BASIC_PITCH_TRACKER = { onSalience: 0.45, offSalience: 0.3 };

// Noyaux du rééchantillonnage, précalculés pour PHASES décalages entre deux
// échantillons d'entrée (le plus proche est pris) : beaucoup plus rapide que de
// recalculer sinus et cosinus pour chaque point.
const PHASES = 512;
const kernelCache = new Map();

function kernelTable(ratio, halfWidth) {
  const key = `${ratio}|${halfWidth}`;
  let table = kernelCache.get(key);
  if (!table) {
    const cutoff = Math.min(1, 1 / ratio) * 0.9; // fraction de la moitié de la fréquence d'entrée
    const reach = Math.ceil(halfWidth / cutoff);
    const taps = 2 * reach + 1; // décalages −reach … +reach autour de l'échantillon le plus proche
    const kernels = new Float32Array(PHASES * taps);
    for (let p = 0; p < PHASES; p++) {
      const frac = p / PHASES; // position du point entre l'échantillon k et k + 1
      let sum = 0;
      for (let t = 0; t < taps; t++) {
        const d = t - reach - frac;
        const x = d * cutoff;
        const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        const w = Math.abs(d) > reach + 1 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * d) / (reach + 1));
        kernels[p * taps + t] = sinc * w;
        sum += sinc * w;
      }
      for (let t = 0; t < taps; t++) kernels[p * taps + t] /= sum;
    }
    table = { kernels, taps, reach };
    kernelCache.set(key, table);
  }
  return table;
}

/**
 * Rééchantillonne la fin d'un signal : renvoie les `length` derniers échantillons
 * à `toRate`, le dernier aligné sur le dernier de l'entrée. Interpolation par sinus
 * cardinal fenêtré (Hann), avec un filtre passe-bas sous la moitié de la fréquence
 * d'arrivée quand on la réduit. Les tout derniers points (un demi-noyau, moins de
 * 1 ms) manquent d'échantillons futurs : le moteur B ne lit pas cette zone.
 */
export function resampleTail(input, fromRate, toRate, length, halfWidth = 16) {
  const out = new Float32Array(length);
  if (fromRate === toRate) {
    const count = Math.min(length, input.length);
    out.set(input.subarray(input.length - count), length - count);
    return out;
  }
  const ratio = fromRate / toRate; // échantillons d'entrée par échantillon de sortie
  const { kernels, taps, reach } = kernelTable(ratio, halfWidth);
  const last = input.length - 1;
  for (let j = 0; j < length; j++) {
    const center = last - (length - 1 - j) * ratio;
    const base = Math.floor(center);
    let phase = Math.round((center - base) * PHASES);
    let k0 = base;
    if (phase === PHASES) { phase = 0; k0++; }
    const offset = phase * taps;
    const from = k0 - reach;
    let sum = 0;
    if (from >= 0 && from + taps - 1 <= last) {
      for (let t = 0; t < taps; t++) sum += input[from + t] * kernels[offset + t];
    } else {
      for (let t = 0; t < taps; t++) {
        const i = from + t;
        if (i >= 0 && i <= last) sum += input[i] * kernels[offset + t];
      }
    }
    out[j] = sum;
  }
  return out;
}

/**
 * Notes des trames récentes : pour chaque touche, la plus forte probabilité sur
 * les trames lues ; [{ midi, salience }] au-dessus de MIN_PROBABILITY, de la plus
 * probable à la moins probable. frames : tableau [trame][touche].
 */
export function recentNotes(frames, edge = EDGE_FRAMES, count = READ_FRAMES) {
  const end = frames.length - edge;
  const start = Math.max(0, end - count);
  const notes = [];
  const keys = frames[0]?.length ?? 0;
  for (let key = 0; key < keys; key++) {
    let max = 0;
    for (let f = start; f < end; f++) if (frames[f][key] > max) max = frames[f][key];
    if (max >= MIN_PROBABILITY) notes.push({ midi: FIRST_MIDI + key, salience: max });
  }
  return notes.sort((a, b) => b.salience - a.salience);
}

/**
 * Moteur B. model : { predict(Float32Array de MODEL_SAMPLES) → Promise<frames> }
 * (voir micBasicPitchModel.js). analyze(samples) prend les frameSize derniers
 * échantillons du micro et renvoie (par une promesse) { notes, level }, comme le
 * moteur A. Le niveau est mesuré sur le passage qui correspond aux trames lues.
 */
export function createBasicPitchEngine({ sampleRate, model }) {
  const frameSize = Math.ceil((MODEL_SAMPLES * sampleRate) / MODEL_SAMPLE_RATE) + 64;
  const readStart = Math.round(((EDGE_FRAMES + READ_FRAMES) * FRAME_SAMPLES * sampleRate) / MODEL_SAMPLE_RATE);
  const readEnd = Math.round((EDGE_FRAMES * FRAME_SAMPLES * sampleRate) / MODEL_SAMPLE_RATE);
  return {
    id: "basicPitch",
    frameSize,
    // Une analyse au plus toutes les 100 ms : le réseau coûte cher sur téléphone
    minIntervalMs: 100,
    tracker: BASIC_PITCH_TRACKER,
    async analyze(samples) {
      const input = resampleTail(samples, sampleRate, MODEL_SAMPLE_RATE, MODEL_SAMPLES);
      const frames = await model.predict(input);
      const level = levelDb(samples.subarray(samples.length - readStart, samples.length - readEnd));
      return { notes: recentNotes(frames), level };
    },
  };
}
