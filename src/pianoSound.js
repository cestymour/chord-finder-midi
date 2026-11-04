// Son de piano : échantillons d'un vrai piano joués avec la Web Audio API.
//
// Les échantillons (public/piano/<midi>.mp3) viennent du Salamander Grand Piano V3
// d'Alexander Holm (licence CC-BY 3.0), une note toutes les 3 demi-tons de A0 (21)
// à C8 (108), en mono et raccourcies. Chaque note jouée part de l'échantillon le plus
// proche, accéléré ou ralenti d'un demi-ton au plus (inaudible).
// Le service worker les met en cache avec l'appli : le son marche hors ligne.
// Ils se chargent au lancement ; une note dont l'échantillon n'est pas encore
// prêt reste muette (sa touche s'allume quand même).

const SAMPLE_FIRST = 21;
const SAMPLE_LAST = 108;
const SAMPLE_STEP = 3;
const SAMPLE_RATE = 44100;
const RELEASE_S = 0.15; // étouffoir quand on relâche la touche
// Échantillons enregistrés assez bas (crête vers −10 dB) : remontés d'autant
const SAMPLE_GAIN = 1.6;

let ctx = null;
let master = null;
const voices = new Map(); // midi → { gain, nodes }
let enabled = true;
const listeners = new Set(); // (midi, delay) → void, appelés à chaque note jouée
const samples = new Map(); // midi de l'échantillon → AudioBuffer
let loading = null;

/** Notes MIDI qui ont un échantillon (21, 24, … 108). */
export const SAMPLE_NOTES = Array.from(
  { length: (SAMPLE_LAST - SAMPLE_FIRST) / SAMPLE_STEP + 1 },
  (_, i) => SAMPLE_FIRST + i * SAMPLE_STEP,
);

/** Échantillon le plus proche d'une note, et l'écart en demi-tons à combler. */
export function nearestSample(midi) {
  const index = Math.round((midi - SAMPLE_FIRST) / SAMPLE_STEP);
  const sample = SAMPLE_FIRST + SAMPLE_STEP * Math.max(0, Math.min(SAMPLE_NOTES.length - 1, index));
  return { sample, semitones: midi - sample };
}

/** S'abonne aux notes jouées (pour les faire briller à l'écran). Renvoie le désabonnement. */
export function subscribePianoNotes(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Active ou coupe le son (réglage « Son » des paramètres). Activé, il charge les échantillons. */
export function setPianoSoundEnabled(on) {
  enabled = on;
  if (on) loadPianoSamples();
  else stopAllPianoNotes();
}

/**
 * Charge et décode les échantillons une seule fois, du médium vers les extrêmes.
 * Le décodage passe par un contexte hors ligne : pas besoin d'attendre un geste
 * de l'utilisateur, le son est prêt dès la première touche.
 */
function loadPianoSamples() {
  if (loading || typeof window === "undefined") return;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline || typeof fetch !== "function") return;
  const decoder = new Offline(1, 1, SAMPLE_RATE);
  const base = `${import.meta.env?.BASE_URL ?? "/"}piano/`;
  const order = [...SAMPLE_NOTES].sort((a, b) => Math.abs(a - 60) - Math.abs(b - 60));
  loading = Promise.all(
    order.map(async (midi) => {
      try {
        const response = await fetch(`${base}${midi}.mp3`);
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        // Forme à rappels : les anciens Safari n'ont pas la version à promesse
        const buffer = await new Promise((resolve, reject) => decoder.decodeAudioData(data, resolve, reject));
        samples.set(midi, buffer);
      } catch {
        // Fichier manquant ou illisible : la synthèse jouera ces notes
      }
    }),
  );
}

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    // Le compresseur évite la saturation quand plusieurs notes sonnent ensemble.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(compressor).connect(ctx.destination);
  }
  // Les navigateurs créent le contexte suspendu tant qu'il n'y a pas eu de geste.
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/**
 * Joue une note (numéro MIDI), éventuellement après `delay` secondes.
 * À appeler depuis un geste utilisateur (clic), sinon le navigateur reste muet.
 */
export function playPianoNote(midi, { velocity = 0.8, delay = 0 } = {}) {
  if (!enabled) return;
  const ac = getContext();
  if (!ac) return;
  stopPianoNote(midi);
  listeners.forEach((listener) => listener(midi, delay));

  const { sample, semitones } = nearestSample(midi);
  const buffer = samples.get(sample);
  if (!buffer) return; // pas encore chargé

  const now = ac.currentTime + delay;
  const voiceGain = ac.createGain();
  voiceGain.gain.value = velocity * SAMPLE_GAIN;
  voiceGain.connect(master);

  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = 2 ** (semitones / 12);
  source.connect(voiceGain);
  source.start(now);

  const nodes = [voiceGain, source];
  const voice = { gain: voiceGain, nodes };
  voices.set(midi, voice);
  source.onended = () => {
    if (voices.get(midi) === voice) voices.delete(midi);
    nodes.forEach((node) => node.disconnect());
  };
}

/** Joue des notes en arpège, du grave à l'aigu ; elles résonnent ensemble à la fin. */
export function playPianoArpeggio(midis, step = 0.11) {
  stopAllPianoNotes();
  [...midis].sort((a, b) => a - b).forEach((midi, i) => playPianoNote(midi, { delay: i * step }));
}

/** Joue des notes toutes ensemble (accord plaqué). */
export function playPianoChord(midis) {
  stopAllPianoNotes();
  // Un peu moins fort par note : l'ensemble ne sature pas le compresseur
  const velocity = Math.min(0.8, 3.2 / Math.max(1, midis.length));
  midis.forEach((midi) => playPianoNote(midi, { velocity }));
}

/** Étouffe une note qui sonne encore (touche relâchée). */
export function stopPianoNote(midi) {
  const voice = voices.get(midi);
  if (!voice || !ctx) return;
  voices.delete(midi);
  const now = ctx.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  voice.gain.gain.setTargetAtTime(0, now, RELEASE_S / 3);
  voice.nodes.forEach((node) => {
    // Sources seulement ; pas d'instanceof AudioScheduledSourceNode,
    // absent des anciens Safari qui n'ont que webkitAudioContext.
    if (typeof node.stop === "function") {
      try { node.stop(now + RELEASE_S * 2); } catch { /* déjà arrêté */ }
    }
  });
}

/** Étouffe toutes les notes. */
export function stopAllPianoNotes() {
  [...voices.keys()].forEach(stopPianoNote);
}
