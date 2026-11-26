import { describe, expect, test } from "vitest";
import { createSimRecording, encodeWav, simFileBase } from "./simRecorder.js";

describe("enregistrement de simulation", () => {
  test("WAV mono 16 bits : en-tête et échantillons", () => {
    const wav = encodeWav([Float32Array.from([0, 1, -1]), Float32Array.from([0.5])], 48000);
    const view = new DataView(wav);
    const text = (offset, n) => String.fromCharCode(...new Uint8Array(wav, offset, n));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(40, true)).toBe(8); // 4 échantillons × 2 octets
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + 2 * i, true))).toEqual([0, 32767, -32768, 16383]);
  });

  test("nom des fichiers : date, heure et moteur", () => {
    expect(simFileBase(new Date(2026, 10, 26, 9, 5, 7), "A3")).toBe("sim-20261126-090507-A3");
  });

  test("journal : événements horodatés et repères du son", () => {
    let clock = 1000;
    const recording = createSimRecording({ engine: "A3", sampleRate: 48000, now: () => clock });
    recording.addAudio(new Float32Array(1024));
    clock = 1010;
    recording.log("midiOn", { note: 60, velocity: 90 });
    clock = 1050;
    recording.log("micOn", { note: 60 });
    recording.addAudio(new Float32Array(1024));
    const { wav, journal } = recording.finish();
    expect(wav.byteLength).toBe(44 + 2048 * 2);
    expect(journal.engine).toBe("A3");
    expect(journal.samples).toBe(2048);
    expect(journal.events).toEqual([
      { t: 10, type: "midiOn", note: 60, velocity: 90 },
      { t: 50, type: "micOn", note: 60 },
    ]);
    expect(journal.audioMarks).toEqual([[0, 0], [2048, 50]]);
  });
});
