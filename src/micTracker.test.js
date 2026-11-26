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

  describe("pas de nouvelle note sans attaque (moteur qui donne classEnergy)", () => {
    // Énergie de chaque classe : 0 partout sauf celles données
    const energy = (values) => Array.from({ length: 12 }, (_, pc) => values[pc] ?? 0);
    const withEnergy = (notes, values, level = LOUD) => ({ ...frame(notes, level), classEnergy: energy(values) });

    test("une note fantôme d'énergie stable n'entre pas quand la note jouée s'éteint", () => {
      const tracker = createNoteTracker();
      // Mi joué (classe 4), un La faible (classe 9) résonne à niveau constant
      let held;
      for (let i = 0; i < 8; i++) held = tracker.update(withEnergy([64, [57, 0.05]], { 4: 1, 9: 0.05 }));
      expect(held).toEqual([64]);
      // Le Mi s'éteint : le La devient « le plus fort », mais son énergie ne monte pas
      for (let i = 0; i < 10; i++) held = tracker.update(withEnergy([57, [64, 0.05]], { 4: 0.02, 9: 0.05 }));
      expect(held).toEqual([]);
    });

    test("une note frappée (énergie qui monte) entre, même pendant qu'une autre sonne", () => {
      const tracker = createNoteTracker();
      for (let i = 0; i < 8; i++) tracker.update(withEnergy([60], { 0: 1 }));
      tracker.update(withEnergy([60, 67], { 0: 1, 7: 0.8 }));
      expect(tracker.update(withEnergy([60, 67], { 0: 1, 7: 0.9 }))).toEqual([60, 67]);
    });

    test("une note qui s'éteint puis est frappée à nouveau revient", () => {
      const tracker = createNoteTracker();
      tracker.update(withEnergy([76], { 4: 1 }));
      tracker.update(withEnergy([76], { 4: 1 }));
      for (let i = 0; i < 8; i++) tracker.update(withEnergy([], { 4: 0.01 }));
      expect(tracker.update(withEnergy([], { 4: 0.01 }))).toEqual([]);
      tracker.update(withEnergy([76], { 4: 1 }));
      expect(tracker.update(withEnergy([76], { 4: 1 }))).toEqual([76]);
    });

    test("sans classEnergy (moteur B), rien ne change", () => {
      const tracker = createNoteTracker();
      for (let i = 0; i < 8; i++) tracker.update(frame([60]));
      tracker.update(frame([60, 67]));
      expect(tracker.update(frame([60, 67]))).toEqual([60, 67]);
    });
  });

  describe("relâchement : chute brusque du niveau récent (releaseDb)", () => {
    const energy = (values) => Array.from({ length: 12 }, (_, pc) => values[pc] ?? 0);
    const at = (notes, values, recentLevel) => ({ ...frame(notes), classEnergy: energy(values), recentLevel });

    test("l'accord lâché disparaît dès la chute, sans attendre le silence", () => {
      const tracker = createNoteTracker({ releaseDb: 12 });
      for (let i = 0; i < 8; i++) tracker.update(at([60, 64, 67], { 0: 1, 4: 1, 7: 1 }, -25));
      // Étouffoirs : −15 dB en une trame ; le moteur entend encore la fin de l'accord
      tracker.update(at([60, 64, 67], { 0: 0.3, 4: 0.3, 7: 0.3 }, -40));
      expect(tracker.update(at([60, 64, 67], { 0: 0.2, 4: 0.2, 7: 0.2 }, -42))).toEqual([]);
    });

    test("une décroissance lente ne relâche rien", () => {
      const tracker = createNoteTracker({ releaseDb: 12 });
      let held;
      for (let i = 0; i < 20; i++) held = tracker.update(at([60, 64, 67], { 0: 1, 4: 1, 7: 1 }, -25 - i));
      expect(held).toEqual([60, 64, 67]);
    });

    test("après un relâchement, la même note revient seulement si on la refrappe", () => {
      const tracker = createNoteTracker({ releaseDb: 12 });
      for (let i = 0; i < 8; i++) tracker.update(at([60], { 0: 1 }, -25));
      tracker.update(at([60], { 0: 0.2 }, -40));
      tracker.update(at([60], { 0: 0.2 }, -41));
      // Ce qui reste du son ne la fait pas revenir…
      for (let i = 0; i < 4; i++) expect(tracker.update(at([60], { 0: 0.2 }, -41))).toEqual([]);
      // … une nouvelle frappe, si
      tracker.update(at([60], { 0: 1 }, -25));
      expect(tracker.update(at([60], { 0: 1 }, -25))).toEqual([60]);
    });
  });

  test("reset", () => {
    const tracker = createNoteTracker();
    tracker.update(frame([60]));
    tracker.update(frame([60]));
    tracker.reset();
    expect(tracker.update(frame([60]))).toEqual([]);
  });
});
