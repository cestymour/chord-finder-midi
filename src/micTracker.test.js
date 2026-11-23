import { describe, expect, test } from "vitest";
import { createNoteTracker } from "./micTracker.js";

const LOUD = -20;
const frame = (notes, level = LOUD) => ({
  level,
  notes: notes.map((n) => (Array.isArray(n) ? { midi: n[0], salience: n[1] } : { midi: n, salience: 1 })),
});

describe("suivi des notes du micro", () => {
  test("une lecture doit revenir 2 trames de suite pour être affichée", () => {
    const tracker = createNoteTracker();
    expect(tracker.update(frame([60, 64, 67]))).toEqual([]);
    expect(tracker.update(frame([60, 64, 67]))).toEqual([60, 64, 67]);
  });

  test("une note qui clignote ne change pas l'affichage", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([60, 64, 67]));
    tracker.update(frame([60, 64, 67]));
    expect(tracker.update(frame([60, 64, 67, 70]))).toEqual([60, 64, 67]);
    expect(tracker.update(frame([60, 64, 67]))).toEqual([60, 64, 67]);
    expect(tracker.update(frame([60, 64, 67, 70]))).toEqual([60, 64, 67]);
  });

  test("un nouvel accord remplace l'ancien d'un coup", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([60, 64, 67]));
    tracker.update(frame([60, 64, 67]));
    expect(tracker.update(frame([57, 60, 64]))).toEqual([60, 64, 67]);
    expect(tracker.update(frame([57, 60, 64]))).toEqual([57, 60, 64]);
  });

  test("hystérésis : une note tenue reste plus longtemps qu'une nouvelle n'entre", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([60, 64, 67]));
    tracker.update(frame([60, 64, 67]));
    // Le Sol faiblit (0,1) : il reste ; un Si aussi faible n'entre pas
    for (let i = 0; i < 4; i++) {
      expect(tracker.update(frame([60, 64, [67, 0.1], [71, 0.1]]))).toEqual([60, 64, 67]);
    }
    // Sous le seuil de sortie : il part
    tracker.update(frame([60, 64, [67, 0.05]]));
    expect(tracker.update(frame([60, 64, [67, 0.05]]))).toEqual([60, 64]);
  });

  test("classes de hauteur : l'octave des notes du haut ne compte pas", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([48, 64, 67]));
    tracker.update(frame([48, 64, 67]));
    // Mi entendu une octave plus haut : même lecture, affichage inchangé
    expect(tracker.update(frame([48, 76, 67]))).toEqual([48, 64, 67]);
    expect(tracker.update(frame([48, 76, 67]))).toEqual([48, 64, 67]);
  });

  test("chaque classe garde sa note la plus grave (la basse)", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([60, 48, 64, 67]));
    expect(tracker.update(frame([60, 48, 64, 67]))).toEqual([48, 64, 67]);
  });

  test("un changement de basse (renversement) est un nouvel accord", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([48, 64, 67]));
    tracker.update(frame([48, 64, 67]));
    tracker.update(frame([52, 60, 67]));
    expect(tracker.update(frame([52, 60, 67]))).toEqual([52, 60, 67]);
  });

  test("silence : tout est relâché sans attendre", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([60, 64, 67]));
    tracker.update(frame([60, 64, 67]));
    expect(tracker.update(frame([60, 64, 67], -70))).toEqual([]);
  });

  test("seuil de silence avec hystérésis", () => {
    const tracker = createNoteTracker();
    // Trop faible pour commencer (sous −50 dB)
    tracker.update(frame([60], -54));
    expect(tracker.update(frame([60], -54))).toEqual([]);
    tracker.update(frame([60], -45));
    expect(tracker.update(frame([60], -45))).toEqual([60]);
    // Déjà commencé : tient jusqu'à −58 dB
    expect(tracker.update(frame([60], -54))).toEqual([60]);
    expect(tracker.update(frame([60], -60))).toEqual([]);
  });

  test("appareil lent : analyses espacées, une seule lecture suffit", () => {
    const tracker = createNoteTracker();
    expect(tracker.update(frame([60, 64, 67]), 1500)).toEqual([60, 64, 67]);
    expect(tracker.update(frame([57, 60, 64]), 100)).toEqual([60, 64, 67]);
    expect(tracker.update(frame([57, 60, 64]), 100)).toEqual([57, 60, 64]);
  });

  test("reset", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([60]));
    tracker.update(frame([60]));
    tracker.reset();
    expect(tracker.update(frame([60]))).toEqual([]);
  });
});
