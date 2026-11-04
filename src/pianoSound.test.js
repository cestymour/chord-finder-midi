import { existsSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { SAMPLE_NOTES, nearestSample } from "./pianoSound.js";

describe("échantillons de piano", () => {
  test("une note sur trois, de A0 (21) à C8 (108)", () => {
    expect(SAMPLE_NOTES[0]).toBe(21);
    expect(SAMPLE_NOTES.at(-1)).toBe(108);
    expect(SAMPLE_NOTES.length).toBe(30);
  });

  test.each(SAMPLE_NOTES)("public/piano/%i.mp3 existe", (midi) => {
    expect(existsSync(new URL(`../public/piano/${midi}.mp3`, import.meta.url))).toBe(true);
  });

  test("chaque touche du piano part d'un échantillon à un demi-ton au plus", () => {
    for (let midi = 21; midi <= 108; midi++) {
      const { sample, semitones } = nearestSample(midi);
      expect(SAMPLE_NOTES).toContain(sample);
      expect(sample + semitones).toBe(midi);
      expect(Math.abs(semitones)).toBeLessThanOrEqual(1);
    }
  });

  test("notes hors du clavier : échantillon le plus proche (extrémités)", () => {
    expect(nearestSample(12)).toEqual({ sample: 21, semitones: -9 });
    expect(nearestSample(115)).toEqual({ sample: 108, semitones: 7 });
  });
});
