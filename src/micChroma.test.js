import { describe, expect, test } from "vitest";
import {
  MIC_MAX_MIDI,
  MIC_MIN_MIDI,
  createChromaEngine,
  detectNotes,
  estimateTuning,
  fft,
  findPeaks,
  frameSizeFor,
  framePeaks,
  hzToMidi,
  levelDb,
  magnitudeSpectrum,
  midiToHz,
  minFundamental,
  pruneHarmonicGhosts,
} from "./micChroma.js";
import { createNoteTracker } from "./micTracker.js";
import { identifyChords } from "./chords.js";
import { synthChord } from "./micSynth.js";

const SAMPLE_RATE = 48000;

function sine(hz, amplitude, length, sampleRate = SAMPLE_RATE) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  return out;
}

/** Notes entendues dans une trame (au-dessus du seuil d'entrée du suivi). */
function heard(notes, options = {}) {
  const engine = createChromaEngine({ sampleRate: SAMPLE_RATE });
  const samples = synthChord(notes, { length: engine.frameSize, ...options });
  return engine.analyze(samples).notes.filter((n) => n.salience >= 0.15).map((n) => n.midi);
}

/** Accord affiché après quelques trames du même son (moteur, suivi, identifyChords). */
function chordFor(notes, options = {}) {
  const engine = createChromaEngine({ sampleRate: SAMPLE_RATE });
  const tracker = createNoteTracker(engine.tracker);
  // Deux trames différentes (timbre, bruit), en alternance : de quoi stabiliser le suivi
  const frames = [1, 2].map((seed) => synthChord(notes, { length: engine.frameSize, seed, ...options }));
  let held = [];
  for (let i = 0; i < 8; i++) held = tracker.update(engine.analyze(frames[i % 2]));
  return identifyChords(held, "sharp")[0]?.chordName ?? null;
}

const pcsOf = (midis) => [...new Set(midis.map((m) => m % 12))].sort((a, b) => a - b);

describe("outils", () => {
  test("midiToHz / hzToMidi", () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBeCloseTo(220);
    expect(midiToHz(69, 100)).toBeCloseTo(midiToHz(70));
    expect(hzToMidi(261.6256)).toBeCloseTo(60, 3);
  });

  test("frameSizeFor : puissance de 2", () => {
    expect(frameSizeFor(48000, 0.17)).toBe(8192);
    expect(frameSizeFor(44100, 0.34)).toBe(16384);
    expect(frameSizeFor(48000, 0.34)).toBe(16384);
  });

  test("fft : une sinusoïde sur un bin donne ce bin", () => {
    const n = 64;
    const re = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 5 * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    expect(re[5]).toBeCloseTo(n / 2);
    expect(re[n - 5]).toBeCloseTo(n / 2);
    expect(Math.hypot(re[4], im[4])).toBeCloseTo(0);
  });

  test("spectre : une sinusoïde d'amplitude a donne un pic d'environ a", () => {
    const n = 8192;
    const hz = (100 * SAMPLE_RATE) / n; // pile sur un bin
    const mags = magnitudeSpectrum(sine(hz, 0.5, n));
    expect(mags[100]).toBeCloseTo(0.5, 2);
  });

  test("pics : fréquence et amplitude affinées entre deux bins", () => {
    const peaks = findPeaks(magnitudeSpectrum(sine(440.7, 0.3, 8192)), SAMPLE_RATE);
    expect(peaks).toHaveLength(1);
    expect(peaks[0].hz).toBeCloseTo(440.7, 0);
    expect(peaks[0].mag).toBeGreaterThan(0.25);
    expect(peaks[0].mag).toBeLessThan(0.32);
  });

  test("framePeaks : deux notes graves voisines restent séparées", () => {
    const n = 16384;
    const samples = sine(midiToHz(40), 0.2, n).map((v, i) => v + 0.2 * Math.sin((2 * Math.PI * midiToHz(43) * i) / SAMPLE_RATE));
    const peaks = framePeaks(samples, SAMPLE_RATE);
    const midis = peaks.map((p) => Math.round(hzToMidi(p.hz)));
    expect(midis).toEqual([40, 43]);
  });

  test("niveau en dB pleine échelle", () => {
    expect(levelDb(sine(440, 1, 4800))).toBeCloseTo(-3.01, 1);
    expect(levelDb(new Float32Array(16))).toBe(-Infinity);
  });

  test("recalage du La : écart global du piano retrouvé", () => {
    for (const detune of [-30, 0, 25]) {
      const samples = synthChord([48, 52, 55, 60], { length: 16384, detune, inharmonicity: 0 });
      const tuning = estimateTuning(framePeaks(samples, SAMPLE_RATE));
      expect(Math.abs(tuning - detune)).toBeLessThan(5);
    }
  });

  test("harmoniques fantômes : écartés s'ils sont faibles, gardés s'ils sont joués", () => {
    const notes = [{ midi: 48, salience: 1 }, { midi: 67, salience: 0.2 }, { midi: 64, salience: 0.25 }];
    expect(pruneHarmonicGhosts(notes).map((n) => n.midi)).toEqual([48, 64]);
    const played = [{ midi: 48, salience: 1 }, { midi: 67, salience: 0.6 }];
    expect(pruneHarmonicGhosts(played)).toEqual(played);
  });

  test("écho à l'octave inférieure : écarté s'il est faible, sauf dans le grave", () => {
    const notes = [{ midi: 74, salience: 1 }, { midi: 62, salience: 0.2 }, { midi: 50, salience: 0.2 }];
    expect(pruneHarmonicGhosts(notes).map((n) => n.midi)).toEqual([74]);
    // Basse doublée sous Do2 (MIDI 48) : gardée
    const bass = [{ midi: 55, salience: 1 }, { midi: 43, salience: 0.2 }];
    expect(pruneHarmonicGhosts(bass)).toEqual(bass);
    // Octave jouée assez fort : gardée
    const octave = [{ midi: 74, salience: 1 }, { midi: 62, salience: 0.5 }];
    expect(pruneHarmonicGhosts(octave)).toEqual(octave);
    // Ancien comportement (A1, A2)
    expect(pruneHarmonicGhosts(notes, { octaveFix: false })).toEqual(notes);
  });

  test("fondamentale exigée : peu dans le grave, davantage au-dessus de Do3", () => {
    expect(minFundamental(65)).toBeCloseTo(0.05);
    expect(minFundamental(130.8)).toBeCloseTo(0.05);
    expect(minFundamental(185)).toBeGreaterThan(0.1);
    expect(minFundamental(185)).toBeLessThan(0.2);
    expect(minFundamental(261.6)).toBeCloseTo(0.25);
    expect(minFundamental(1000)).toBeCloseTo(0.25);
  });
});

describe("moteur A : notes entendues", () => {
  // Registre visé (Mi1 à Do5 en français, MIDI 40 à 84)
  const REGISTER = Array.from({ length: 45 }, (_, i) => 40 + i);

  test.each(REGISTER)("note seule %i : une seule classe de hauteur, la bonne", (midi) => {
    for (const seed of [1, 2, 3]) {
      const notes = heard([midi], { seed: midi * seed });
      expect(pcsOf(notes)).toEqual([midi % 12]);
      expect(Math.min(...notes)).toBe(midi);
    }
  });

  test("silence et bruit seul : aucune note gardée par le suivi", () => {
    const engine = createChromaEngine({ sampleRate: SAMPLE_RATE });
    const tracker = createNoteTracker(engine.tracker);
    for (let frame = 0; frame < 5; frame++) {
      const noise = synthChord([], { length: engine.frameSize, noise: 0.001, seed: frame + 1 });
      expect(tracker.update(engine.analyze(noise))).toEqual([]);
    }
    expect(engine.analyze(new Float32Array(engine.frameSize)).notes).toEqual([]);
  });

  test("plage des candidates", () => {
    expect(MIC_MIN_MIDI).toBeLessThanOrEqual(40);
    expect(MIC_MAX_MIDI).toBeGreaterThanOrEqual(84);
  });
});

describe("moteur A + suivi : accord reconnu", () => {
  const SHAPES = [
    ["", [0, 4, 7]],
    ["m", [0, 3, 7]],
    ["7", [0, 4, 7, 10]],
    ["maj7", [0, 4, 7, 11]],
    ["m7", [0, 3, 7, 10]],
    ["dim", [0, 3, 6]],
  ];
  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

  // Fondamentales de Sol2 à Fa♯4 (MIDI 43 à 66)
  const CASES = [];
  for (let root = 43; root <= 66; root += 1) {
    for (const [suffix, shape] of SHAPES) CASES.push([NAMES[root % 12] + suffix, root, shape]);
  }

  test.each(CASES)("%s (fondamentale %i)", (name, root, shape) => {
    expect(chordFor(shape.map((i) => root + i), { detune: 15, spread: 8 })).toBe(name);
  });

  test("renversements : la basse est reconnue", () => {
    expect(chordFor([52, 55, 60])).toBe("C/E"); // Mi3 Sol3 Do4
    expect(chordFor([55, 60, 64])).toBe("C/G");
    expect(chordFor([59, 62, 65, 67])).toBe("G7/B");
  });

  test("piano désaccordé (−35 et +35 cents) : même accord", () => {
    expect(chordFor([57, 60, 64], { detune: -35, spread: 10 })).toBe("Am");
    expect(chordFor([55, 59, 62, 65], { detune: 35, spread: 10 })).toBe("G7");
  });

  test("voix intérieures plus faibles", () => {
    expect(chordFor([48, 52, 55, 60], { gains: [1, 0.5, 0.6, 1] })).toBe("C");
  });
});

/**
 * Notes affichées trame après trame (toutes les 50 ms) sur un son qui évolue :
 * `notes` frappées à l'instant `attack` (secondes) puis s'éteignant (constante de
 * temps `decay`), avec un fond `background` : résonance d'autres cordes, à
 * `backgroundGain` du niveau des notes, excitée par la première frappe et qui
 * s'éteint lentement. `before` : notes frappées à 0 s.
 */
function displayedOverTime({ before = [], notes, attack = 0.5, decay = 0.4, background = [], backgroundGain = 0.02, seconds = 3.5 }) {
  const engine = createChromaEngine({ sampleRate: SAMPLE_RATE });
  const tracker = createNoteTracker(engine.tracker);
  const total = Math.round(seconds * SAMPLE_RATE);
  const signal = new Float32Array(total);
  const add = (midis, gain, start, tau, seed) => {
    if (midis.length === 0) return;
    const tone = synthChord(midis, { length: total, noise: 0, seed });
    const from = Math.round(start * SAMPLE_RATE);
    for (let i = from; i < total; i++) {
      const t = (i - from) / SAMPLE_RATE;
      signal[i] += gain * tone[i] * Math.exp(-t / tau);
    }
  };
  add(background, backgroundGain, before.length > 0 ? 0 : attack, 4, 7);
  add(before, 1, 0, decay, 3);
  add(notes, 1, attack, decay, 5);
  const noise = synthChord([], { length: total, noise: 0.0003, seed: 11 });
  for (let i = 0; i < total; i++) signal[i] += noise[i];

  const hop = Math.round(0.05 * SAMPLE_RATE);
  const shown = [];
  for (let end = engine.frameSize; end <= total; end += hop) {
    const held = tracker.update(engine.analyze(signal.subarray(end - engine.frameSize, end)), 50);
    shown.push({ time: end / SAMPLE_RATE, held });
  }
  return shown;
}

/**
 * Notes affichées 0,3 à 1,3 s après l'attaque d'un accord (chaque note avec son timbre
 * et son volume), avec une résonance faible (sinusoïde) à `resonanceHz`.
 */
function heldWithResonance(notes, resonanceHz, { seed = 1, gain = 0.1, version } = {}) {
  const engine = createChromaEngine({ sampleRate: SAMPLE_RATE, version });
  const tracker = createNoteTracker(engine.tracker);
  const total = Math.round(1.6 * SAMPLE_RATE);
  const from = Math.round(0.2 * SAMPLE_RATE);
  const signal = new Float32Array(total);
  const envelope = (k) => Math.exp(-(k - from) / SAMPLE_RATE / 0.8);
  notes.forEach((midi, i) => {
    const tone = synthChord([midi], { length: total, noise: 0, seed: seed * 31 + i, spread: 10 });
    const volume = 0.6 + 0.2 * ((seed + i) % 3);
    for (let k = from; k < total; k++) signal[k] += volume * tone[k] * envelope(k);
  });
  for (let k = from; k < total; k++) {
    signal[k] += 0.15 * gain * Math.sin((2 * Math.PI * resonanceHz * k) / SAMPLE_RATE) * envelope(k);
  }
  const noise = synthChord([], { length: total, noise: 0.0003, seed: seed + 5 });
  for (let k = 0; k < total; k++) signal[k] += noise[k];

  const hop = Math.round(0.05 * SAMPLE_RATE);
  const shown = new Set();
  for (let end = engine.frameSize; end <= total; end += hop) {
    const held = tracker.update(engine.analyze(signal.subarray(end - engine.frameSize, end)), 50);
    const time = end / SAMPLE_RATE - 0.2;
    if (time >= 0.3 && time <= 1.3) shown.add(held.join(","));
  }
  return [...shown];
}

describe("moteur A, version 4", () => {
  // Résonance du meuble ou des haut-parleurs vers 73 Hz (relevée dans un
  // enregistrement) : un pic grave isolé s'affichait comme un Ré1, en ramassant les
  // notes jouées comme ses harmoniques. Ce test synthétique est un garde-fou ; le
  // défaut réel se vérifie sur l'enregistrement (scripts/sim-analyze.mjs).
  test.each([1, 2, 3])("La3-Do4-Mi4 et un pic isolé à 73 Hz : pas de Ré1 (%i)", (seed) => {
    expect(heldWithResonance([57, 60, 64], 72.8, { seed, gain: 0.12 })).toEqual(["57,60,64"]);
  });

  test.each([89, 91, 93, 95, 98, 100])("note suraiguë %i entendue (plage étendue)", (midi) => {
    const engine = createChromaEngine({ sampleRate: SAMPLE_RATE });
    const notes = engine.analyze(synthChord([midi], { length: engine.frameSize, seed: midi })).notes;
    expect(notes[0].midi).toBe(midi);
    const old = createChromaEngine({ sampleRate: SAMPLE_RATE, version: 3 });
    expect(old.analyze(synthChord([midi], { length: old.frameSize, seed: midi })).notes.some((n) => n.midi === midi)).toBe(false);
  });

  test("accord lâché (étouffoirs) : effacé en moins de 300 ms", () => {
    const engine = createChromaEngine({ sampleRate: SAMPLE_RATE });
    const tracker = createNoteTracker(engine.tracker);
    const total = Math.round(2 * SAMPLE_RATE);
    const start = Math.round(0.2 * SAMPLE_RATE);
    const release = Math.round(1.2 * SAMPLE_RATE);
    const tone = synthChord([60, 64, 67], { length: total, noise: 0, seed: 3 });
    const noise = synthChord([], { length: total, noise: 0.0003, seed: 4 });
    const signal = tone.map((v, k) => {
      if (k < start) return noise[k];
      const t = (k - start) / SAMPLE_RATE;
      const damper = k < release ? 1 : Math.exp(-(k - release) / SAMPLE_RATE / 0.03);
      return v * Math.exp(-t / 2) * damper + noise[k];
    });
    let cleared = null;
    let shown = false;
    for (let end = engine.frameSize; end <= total; end += 2400) {
      const held = tracker.update(engine.analyze(signal.subarray(end - engine.frameSize, end)), 50);
      if (held.join(",") === "60,64,67") shown = true;
      if (end > release && held.length === 0 && cleared === null) cleared = (end - release) / SAMPLE_RATE;
    }
    expect(shown).toBe(true);
    expect(cleared).not.toBeNull();
    expect(cleared).toBeLessThan(0.3);
  });
});

describe("moteur A : erreurs d'octave dans le médium et l'aigu", () => {
  // Ré4-Fa4-La4 (français) avec un peu de résonance à Ré3 : le Ré restait affiché
  // une octave trop bas (Ré3 ramasse Ré4 et La4 comme ses harmoniques 2 et 3)
  test.each([1, 2, 3, 4])("Ré4-Fa4-La4 et résonance à Ré3 (%i)", (seed) => {
    expect(heldWithResonance([74, 77, 81], midiToHz(62), { seed, gain: 0.12 })).toEqual(["74,77,81"]);
  });

  test("le défaut existait sans la correction", () => {
    const shown = [1, 2, 3, 4].flatMap((seed) =>
      heldWithResonance([74, 77, 81], midiToHz(62), { seed, gain: 0.12, version: 2 }));
    expect(shown).toContain("62,77,81");
  });

  // Accords en position serrée, de Mi3 à Sol♯4 : résonance une octave sous la basse
  test.each([64, 66, 69, 71, 74, 76, 78, 80])("accord majeur sur %i, résonance à l'octave inférieure", (root) => {
    const notes = [root, root + 4, root + 7];
    expect(heldWithResonance(notes, midiToHz(root - 12), { seed: 2 })).toEqual([notes.join(",")]);
  });
});

describe("moteur A + suivi : notes qui s'éteignent", () => {
  test("une note aiguë qui s'éteint ne laisse pas entrer la résonance des cordes graves", () => {
    const shown = displayedOverTime({ notes: [76], background: [45, 50, 53] }); // Mi5 ; La2, Ré3, Fa3
    // Le Mi est bien affiché après l'attaque
    expect(shown.some(({ held }) => held.includes(76))).toBe(true);
    // Aucune autre classe de hauteur n'apparaît pendant qu'il s'éteint
    const others = shown.flatMap(({ time, held }) => held.filter((m) => m % 12 !== 4).map((m) => `${m}@${time.toFixed(2)}`));
    expect(others).toEqual([]);
  });

  test("une note frappée pendant qu'une autre s'éteint entre bien", () => {
    // Do4 frappé à 0 s ; Sol4 frappé à 1,2 s, alors que le Do s'éteint encore
    const shown = displayedOverTime({ before: [60], notes: [67], attack: 1.2, decay: 0.8, background: [45, 50] });
    const after = shown.filter(({ time }) => time > 1.2 && time < 1.8);
    expect(after.some(({ held }) => held.includes(67))).toBe(true);
  });

  test("la même note frappée une deuxième fois revient", () => {
    // Mi5 frappé à 0 s puis à 2 s : il réapparaît après la deuxième attaque
    const shown = displayedOverTime({ before: [76], notes: [76], attack: 2, decay: 0.3, background: [45, 50, 53] });
    const gone = shown.findIndex(({ time, held }) => time > 0.5 && time < 2 && !held.includes(76));
    expect(gone).toBeGreaterThan(-1);
    expect(shown.some(({ time, held }) => time > 2 && held.includes(76))).toBe(true);
  });
});

describe("moteur A, version 5 : note grave sans son octave", () => {
  // Pics relevés dans un enregistrement réel (piano numérique, micro d'ordinateur),
  // en Hz et relatifs au plus fort. Le son synthétique ne reproduit pas le défaut.
  const peaksOf = (list) => list.map(([hz, mag]) => ({ hz, mag }));
  const names = (peaks, lowOctave) => detectNotes(peaks, 0, { lowOctave, maxMidi: 108 }).map((n) => n.midi).sort((a, b) => a - b);

  // Fa3-La3-Do4-Fa4 joué doucement : résonance fixe à 72,9 Hz (pas de pic à 146,8 Hz,
  // seulement la résonance voisine de 139 Hz), qui ramassait La3, Do4 et Ré4 comme
  // harmoniques 6, 7 et 8 : Ré1 affiché sous l'accord de Fa
  const fChord = peaksOf([
    [72.9, 0.036], [104.7, 0.027], [139.3, 0.013], [172.7, 0.011], [228.6, 0.014], [240.8, 0.043],
    [294.8, 0.016], [348.9, 0.485], [440.2, 1], [471.2, 0.012], [524.2, 0.19], [698.5, 0.543],
    [881, 0.1], [1047.7, 0.037],
  ]);
  test("Fa3-La3-Do4-Fa4 et la résonance à 73 Hz : plus de Ré1", () => {
    expect(names(fChord, false)).toContain(38);
    expect(names(fChord, true)).not.toContain(38);
  });

  // Vrai Ré1-Fa1-La1 joué : chaque corde grave a son octave (146, 174, 219 Hz)
  const dmLow = peaksOf([
    [73.1, 0.582], [86.8, 0.865], [109.7, 0.994], [133.9, 0.019], [146.2, 0.432], [160.6, 0.018],
    [173.8, 0.79], [219.4, 0.323], [233, 0.012], [246.4, 0.013], [261.3, 0.159], [292.7, 0.383],
    [329.1, 0.26], [348.5, 0.136], [366, 0.215], [436.7, 0.546], [492.1, 0.013], [522.5, 1],
    [549.1, 0.129], [586.1, 0.019], [610.1, 0.086], [659, 0.217], [734.1, 0.33], [785.1, 0.063],
    [808.3, 0.1], [873.4, 0.16], [958.1, 0.167], [990, 0.156], [1030.9, 0.046], [1048.5, 0.049],
  ]);
  test("un vrai Ré1-Fa1-La1 reste entendu", () => {
    expect(names(dmLow, true)).toEqual(expect.arrayContaining([38, 41, 45]));
  });
});
