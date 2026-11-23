import { describe, expect, test } from "vitest";
import {
  MIC_MAX_MIDI,
  MIC_MIN_MIDI,
  createChromaEngine,
  estimateTuning,
  fft,
  findPeaks,
  frameSizeFor,
  framePeaks,
  hzToMidi,
  levelDb,
  magnitudeSpectrum,
  midiToHz,
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
  const tracker = createNoteTracker();
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
    const tracker = createNoteTracker();
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
