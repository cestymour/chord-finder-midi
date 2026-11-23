import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { loadGraphModel } from "@tensorflow/tfjs-converter";
import {
  BASIC_PITCH_TRACKER,
  EDGE_FRAMES,
  MODEL_FRAMES,
  MODEL_SAMPLES,
  MODEL_SAMPLE_RATE,
  READ_FRAMES,
  createBasicPitchEngine,
  recentNotes,
  resampleTail,
} from "./micBasicPitch.js";
import { createRingBuffer } from "./micCapture.js";
import { createNoteTracker } from "./micTracker.js";
import { identifyChords } from "./chords.js";
import { synthChord } from "./micSynth.js";

function sine(hz, sampleRate, length, phase = 0) {
  return Float32Array.from({ length }, (_, i) => Math.sin(2 * Math.PI * hz * (i / sampleRate) + phase));
}

describe("rééchantillonnage", () => {
  test("48 kHz → 22 050 Hz : une sinusoïde reste la même, alignée sur la fin", () => {
    const n = 48000;
    const input = sine(440, 48000, n);
    const out = resampleTail(input, 48000, MODEL_SAMPLE_RATE, 4000);
    // Instant du dernier échantillon d'entrée = instant du dernier de sortie
    const tEnd = (n - 1) / 48000;
    let maxError = 0;
    for (let j = 0; j < out.length; j++) {
      const t = tEnd - (out.length - 1 - j) / MODEL_SAMPLE_RATE;
      maxError = Math.max(maxError, Math.abs(out[j] - Math.sin(2 * Math.PI * 440 * t)));
    }
    expect(maxError).toBeLessThan(0.02);
  });

  test("les fréquences au-dessus de 11 kHz sont filtrées (pas de repliement)", () => {
    const out = resampleTail(sine(15000, 48000, 20000), 48000, MODEL_SAMPLE_RATE, 4000);
    // Hors des tout derniers points (bord, non lus par le moteur)
    const peak = Math.max(...out.slice(100, -40).map(Math.abs));
    expect(peak).toBeLessThan(0.05);
  });

  test("même fréquence : signal inchangé", () => {
    const input = sine(1000, 22050, 3000, 0.3);
    const out = resampleTail(input, 22050, 22050, 1000);
    for (let j = 0; j < out.length; j++) expect(out[j]).toBeCloseTo(input[2000 + j], 3);
  });
});

describe("lecture des trames", () => {
  test("maximum de chaque touche sur les trames lues, bords écartés", () => {
    const frames = Array.from({ length: MODEL_FRAMES }, () => new Array(88).fill(0));
    const end = MODEL_FRAMES - EDGE_FRAMES;
    frames[end - 1][39] = 0.8; // Do4 (MIDI 60), dans les trames lues
    frames[end - READ_FRAMES][43] = 0.5; // Mi4, première trame lue
    frames[end - READ_FRAMES - 1][46] = 0.9; // Sol4 : trop ancien
    frames[MODEL_FRAMES - 1][48] = 0.9; // La4 : bord de la fenêtre
    frames[end - 2][50] = 0.05; // trop faible
    expect(recentNotes(frames)).toEqual([
      { midi: 60, salience: 0.8 },
      { midi: 64, salience: 0.5 },
    ]);
  });

  test("seuils du suivi : probabilités absolues, avec hystérésis", () => {
    expect(BASIC_PITCH_TRACKER.onSalience).toBeGreaterThan(BASIC_PITCH_TRACKER.offSalience);
  });
});

describe("moteur B avec un faux modèle", () => {
  test("entrée de la bonne taille, notes et niveau renvoyés", async () => {
    let received = null;
    const frames = Array.from({ length: MODEL_FRAMES }, () => new Array(88).fill(0));
    frames[MODEL_FRAMES - EDGE_FRAMES - 1][39] = 0.9;
    const engine = createBasicPitchEngine({
      sampleRate: 48000,
      model: { predict: async (samples) => { received = samples; return frames; } },
    });
    expect(engine.frameSize).toBeGreaterThanOrEqual(Math.ceil((MODEL_SAMPLES * 48000) / MODEL_SAMPLE_RATE));
    const result = await engine.analyze(sine(440, 48000, engine.frameSize).map((v) => v * 0.1));
    expect(received).toHaveLength(MODEL_SAMPLES);
    expect(result.notes).toEqual([{ midi: 60, salience: 0.9 }]);
    expect(result.level).toBeCloseTo(-23, 0); // sinusoïde d'amplitude 0,1
  });
});

describe("tampon circulaire de la capture", () => {
  test("les n derniers échantillons, zéros avant le début", () => {
    const ring = createRingBuffer(8);
    ring.push(Float32Array.from([1, 2, 3]));
    expect([...ring.latest(5)]).toEqual([0, 0, 1, 2, 3]);
    ring.push(Float32Array.from([4, 5, 6, 7, 8, 9, 10]));
    expect([...ring.latest(4)]).toEqual([7, 8, 9, 10]);
    expect([...ring.latest(8)]).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    ring.push(Float32Array.from({ length: 20 }, (_, i) => i));
    expect([...ring.latest(3)]).toEqual([17, 18, 19]);
  });
});

// Le vrai modèle, exécuté sur le processeur (lent : environ 2 s par analyse)
describe("moteur B avec le modèle Basic Pitch", () => {
  let model;

  beforeAll(async () => {
    await tf.setBackend("cpu");
    const dir = new URL("../public/models/basic-pitch/", import.meta.url);
    const json = JSON.parse(readFileSync(new URL("model.json", dir), "utf8"));
    const bin = readFileSync(new URL(json.weightsManifest[0].paths[0], dir));
    const graph = await loadGraphModel({
      load: async () => ({
        modelTopology: json.modelTopology,
        weightSpecs: json.weightsManifest[0].weights,
        weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
        format: json.format,
        generatedBy: json.generatedBy,
        convertedBy: json.convertedBy,
        signature: json.signature,
      }),
    });
    model = {
      predict: async (samples) => {
        const input = tf.tensor3d(samples, [1, MODEL_SAMPLES, 1]);
        const output = graph.execute(input, "Identity_1");
        const frames = (await output.array())[0];
        input.dispose();
        output.dispose();
        return frames;
      },
    };
  }, 60000);

  async function chordFor(notes) {
    const sampleRate = 48000;
    const engine = createBasicPitchEngine({ sampleRate, model });
    const tracker = createNoteTracker(engine.tracker);
    const result = await engine.analyze(synthChord(notes, { sampleRate, length: engine.frameSize, seed: 5 }));
    // Même lecture deux fois : le suivi la confirme
    tracker.update(result);
    const held = tracker.update(result);
    return identifyChords(held, "sharp")[0]?.chordName ?? null;
  }

  test("accords et renversement reconnus", async () => {
    expect(await chordFor([48, 52, 55])).toBe("C");
    expect(await chordFor([57, 60, 64])).toBe("Am");
    expect(await chordFor([43, 47, 50, 53])).toBe("G7");
    expect(await chordFor([52, 55, 60])).toBe("C/E");
  }, 60000);
});
