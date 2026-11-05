import { describe, expect, it } from "vitest";
import { identifyChords, buildPendingNotePairs } from "./chords.js";
import { buildScoreNotes, chooseStaves, vexKey, writtenOctave } from "./score.js";

const scoreOf = (midiNotes) => {
  const chord = identifyChords(midiNotes)[0];
  return buildScoreNotes(midiNotes, chord.noteIntervalPairs, chord.rootPc);
};
const keys = (notes) => notes.map((n) => vexKey(n.note, n.midi));

describe("vexKey / writtenOctave", () => {
  it("écrit l'octave de la lettre, pas celle de la touche", () => {
    expect(vexKey({ letter: 0, alter: 0 }, 60)).toBe("c/4");
    expect(writtenOctave({ letter: 6, alter: 1 }, 60)).toBe(3); // Si♯3
    expect(vexKey({ letter: 0, alter: -1 }, 59)).toBe("cb/4"); // Do♭4
    expect(vexKey({ letter: 6, alter: -2 }, 57)).toBe("bbb/3"); // Si𝄫3
    expect(vexKey({ letter: 3, alter: 2 }, 67)).toBe("f##/4"); // Fa𝄪4
  });
});

describe("buildScoreNotes", () => {
  it("écrit chaque touche jouée, même note à plusieurs octaves comprise", () => {
    expect(keys(scoreOf([48, 60, 64, 67]))).toEqual(["c/3", "c/4", "e/4", "g/4"]);
  });

  it("suit l'orthographe de l'accord", () => {
    expect(keys(scoreOf([53, 56, 60]))).toEqual(["f/3", "ab/3", "c/4"]); // Fm
    expect(keys(scoreOf([64, 68, 72]))).toEqual(["e/4", "g#/4", "b#/4"]); // Eaug
  });

  it("place une note facultative non jouée au-dessus de la fondamentale la plus grave", () => {
    const notes = scoreOf([55, 59, 65]); // G7 sans ré
    expect(keys(notes)).toEqual(["g/3", "b/3", "d/4", "f/4"]);
    expect(notes.map((n) => n.missing)).toEqual([false, false, true, false]);
  });

  it("met une extension non jouée une octave plus haut", () => {
    // C13 sans 9 ni 11 : la 9 manquante au-dessus de l'octave
    const chord = identifyChords([48, 52, 55, 58, 69]).find((c) => c.suffix === "13");
    const notes = buildScoreNotes([48, 52, 55, 58, 69], chord.noteIntervalPairs, chord.rootPc);
    const ninth = notes.find((n) => n.missing && n.note.letter === 1);
    expect(ninth.midi).toBe(62);
  });

  it("notes non reconnues : orthographe du réglage, pas de note ajoutée", () => {
    const notes = buildScoreNotes([60, 61], buildPendingNotePairs([60, 61], "flat"));
    expect(keys(notes)).toEqual(["c/4", "db/4"]);
  });
});

describe("chooseStaves", () => {
  const at = (...midis) => midis.map((midi) => ({ midi }));

  it("aucune portée sans note", () => {
    expect(chooseStaves([])).toEqual({ treble: null, bass: null });
  });

  it("clé de sol ou de fa quand l'accord y tient", () => {
    expect(chooseStaves(at(60, 64, 67)).bass).toBeNull();
    expect(chooseStaves(at(48, 52, 55)).treble).toBeNull();
    expect(chooseStaves(at(84, 88, 91)).bass).toBeNull(); // très aigu : sol seule
    expect(chooseStaves(at(24, 28, 31)).treble).toBeNull(); // très grave : fa seule
  });

  it("dans la zone commune, la clé du milieu de l'accord", () => {
    expect(chooseStaves(at(57, 60, 64)).treble).not.toBeNull(); // La3 Do4 Mi4
    expect(chooseStaves(at(55, 59, 62)).bass).not.toBeNull(); // Sol3 Si3 Ré4
  });

  it("les deux portées, partagées au Do central, pour un accord large", () => {
    const { treble, bass } = chooseStaves(at(43, 59, 65, 69, 74));
    expect(bass.map((n) => n.midi)).toEqual([43, 59]);
    expect(treble.map((n) => n.midi)).toEqual([65, 69, 74]);
  });
});
