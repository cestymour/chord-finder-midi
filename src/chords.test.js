import { describe, expect, test } from "vitest";
import {
  CHORD_TEMPLATES,
  CHORD_TEMPLATE_GROUPS,
  SUFFIX_RANK,
  VOICING_LOWEST_NOTE,
  buildChordVoicing,
  buildPendingNotePairs,
  describeVoicing,
  englishNoteName,
  identifyChords,
  inversionCount,
  spellDegree,
  spellPc,
} from "./chords.js";

// ── Aides ──────────────────────────────────────────────────────────────

const template = (suffix) => CHORD_TEMPLATES.find((tpl) => tpl.suffix === suffix);
const names = (notes) => notes.map(englishNoteName);
const chordNames = (results) => results.map((r) => r.chordName);
/** Noms anglais des notes du tableau, entre parenthèses pour les notes non jouées. */
const table = (chord) =>
  chord.noteIntervalPairs.map((p) => (p.missing ? `(${englishNoteName(p.note)})` : englishNoteName(p.note)));
/** Notes d'un accord, chaque degré épelé depuis la fondamentale. */
const spellChord = (root, suffix) => names(template(suffix).degrees.map((d) => spellDegree(root, d)));

// Classes de hauteur (0–11) et lettres (0–6) des notes naturelles
const C = 0, D = 2;
const [L_C, L_D, L_E, L_F, L_G, L_A, L_B] = [0, 1, 2, 3, 4, 5, 6];
const note = (letter, alter = 0) => ({ letter, alter });

// ── Orthographe ────────────────────────────────────────────────────────

describe("spellPc (touche hors accord)", () => {
  test("touches blanches : sans altération, quel que soit le réglage", () => {
    for (const acc of ["sharp", "flat"]) {
      expect(names([0, 2, 4, 5, 7, 9, 11].map((pc) => spellPc(pc, acc)))).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    }
  });

  test("touches noires en dièses ou en bémols selon le réglage", () => {
    expect(names([1, 3, 6, 8, 10].map((pc) => spellPc(pc, "sharp")))).toEqual(["C♯", "D♯", "F♯", "G♯", "A♯"]);
    expect(names([1, 3, 6, 8, 10].map((pc) => spellPc(pc, "flat")))).toEqual(["D♭", "E♭", "G♭", "A♭", "B♭"]);
  });

  test("dièses par défaut, et classes de hauteur hors de 0–11 ramenées dans l'octave", () => {
    expect(englishNoteName(spellPc(1))).toBe("C♯");
    expect(englishNoteName(spellPc(13, "flat"))).toBe("D♭");
    expect(englishNoteName(spellPc(-1))).toBe("B");
  });
});

describe("spellDegree (notes d'un accord épelées depuis la fondamentale)", () => {
  test.each([
    [note(L_F), "m", ["F", "A♭", "C"]],
    [note(L_E), "aug", ["E", "G♯", "B♯"]],
    [note(L_D, 1), "", ["D♯", "F𝄪", "A♯"]],
    [note(L_G, -1), "m", ["G♭", "B𝄫", "D♭"]],
    [note(L_C), "dim7", ["C", "E♭", "G♭", "B𝄫"]],
    [note(L_B, -1), "7♯9", ["B♭", "D", "F", "A♭", "C♯"]],
    [note(L_A), "m13", ["A", "C", "E", "G", "B", "D", "F♯"]],
  ])("%j %s", (root, suffix, expected) => {
    expect(spellChord(root, suffix)).toEqual(expected);
  });

  test("chaque degré garde sa lettre et sa hauteur, au plus une double altération", () => {
    const pcOf = (n) => ([0, 2, 4, 5, 7, 9, 11][n.letter] + n.alter + 12) % 12;
    for (const tpl of CHORD_TEMPLATES) {
      for (let pc = 0; pc < 12; pc++) {
        for (const acc of ["sharp", "flat"]) {
          const root = spellPc(pc, acc);
          for (const degree of tpl.degrees) {
            const spelled = spellDegree(root, degree);
            expect(spelled.letter).toBe((root.letter + degree.step) % 7);
            expect(pcOf(spelled)).toBe((pc + degree.semitones) % 12);
            expect(Math.abs(spelled.alter)).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});

// ── Modèles ────────────────────────────────────────────────────────────

describe("modèles d'accords", () => {
  test("suffixes uniques", () => {
    const suffixes = CHORD_TEMPLATES.map((tpl) => tpl.suffix);
    expect(new Set(suffixes).size).toBe(suffixes.length);
  });

  test("SUFFIX_RANK a exactement une entrée par suffixe (sinon rang 6 en silence)", () => {
    expect(Object.keys(SUFFIX_RANK).sort()).toEqual(CHORD_TEMPLATES.map((tpl) => tpl.suffix).sort());
  });

  test("les groupes contiennent tous les modèles", () => {
    expect(CHORD_TEMPLATE_GROUPS.flatMap((g) => g.templates)).toEqual(CHORD_TEMPLATES);
  });

  test("la fondamentale est toujours obligatoire, et deux degrés ne tombent jamais sur la même touche", () => {
    for (const tpl of CHORD_TEMPLATES) {
      expect(tpl.required).toContain(0);
      expect(tpl.intervals.length).toBe(tpl.degrees.length);
    }
  });

  test("une quinte altérée n'est jamais facultative", () => {
    for (const tpl of CHORD_TEMPLATES) {
      for (const d of tpl.degrees) {
        if (d.label === "♭5" || d.label === "♯5") expect(tpl.required).toContain(d.semitones % 12);
      }
    }
  });

  test("triades, 6 et m6 entièrement obligatoires", () => {
    for (const suffix of ["", "m", "dim", "aug", "sus2", "sus4", "5", "6", "m6"]) {
      expect(template(suffix).required.length).toBe(template(suffix).intervals.length);
    }
  });

  test("7♭13 garde sa quinte (sinon mêmes touches que 7♯5)", () => {
    expect(template("7♭13").required).toContain(7);
  });

  test("11 et maj11 gardent leur 9e", () => {
    expect(template("11").required).toContain(2);
    expect(template("maj11").required).toContain(2);
  });
});

// ── Détection ──────────────────────────────────────────────────────────

describe("identifyChords", () => {
  test("rien, ou une seule note : aucun accord", () => {
    expect(identifyChords([])).toEqual([]);
    expect(identifyChords([60])).toEqual([]);
    expect(identifyChords([60, 72])).toEqual([]); // même note à l'octave
  });

  test("accord parfait majeur à l'état fondamental", () => {
    const [first] = identifyChords([60, 64, 67]);
    expect(first.chordName).toBe("C");
    expect(first.suffix).toBe("");
    expect(first.isInversion).toBe(false);
    expect(first.bass).toBeNull();
    expect(first.bassPc).toBeNull();
    expect(table(first)).toEqual(["C", "E", "G"]);
    expect(first.noteIntervalPairs.map((p) => p.interval)).toEqual(["1", "3", "5"]);
  });

  test("l'ordre et l'octave des notes ne changent rien, à part la basse", () => {
    expect(identifyChords([67, 48, 76, 60])[0].chordName).toBe("C");
    expect(identifyChords([64, 67, 72])[0].chordName).toBe("C/E");
  });

  test("renversement : basse en notation de barre oblique", () => {
    const [first] = identifyChords([64, 67, 72]);
    expect(first.isInversion).toBe(true);
    expect(first.rootPc).toBe(0);
    expect(first.bassPc).toBe(4);
    expect(englishNoteName(first.bass)).toBe("E");
    // Le tableau suit l'ordre des touches, du grave à l'aigu
    expect(table(first)).toEqual(["E", "G", "C"]);
  });

  test("réglage bémols : fondamentale et basse en bémols", () => {
    const [first] = identifyChords([60, 63, 68], "flat"); // C E♭ A♭
    expect(first.chordName).toBe("A♭/C");
    expect(table(first)).toEqual(["C", "E♭", "A♭"]);
  });

  test("la basse se lit comme la touche jouée, le tableau garde l'orthographe exacte", () => {
    const [flat] = identifyChords([56, 64, 71], "flat"); // G♯ E B : E/G♯
    expect(flat.chordName).toBe("E/A♭");
    expect(table(flat)).toEqual(["G♯", "E", "B"]);
    expect(identifyChords([56, 64, 71], "sharp")[0].chordName).toBe("E/G♯");
  });

  test("dièses : symbole tout en dièses, notes épelées depuis la fondamentale", () => {
    const [first] = identifyChords([63, 67, 70], "sharp"); // D♯ F𝄪 A♯
    expect(first.chordName).toBe("D♯");
    expect(table(first)).toEqual(["D♯", "F𝄪", "A♯"]);
    expect(identifyChords([63, 67, 70], "flat")[0].chordName).toBe("E♭");
  });

  test("C E G A avec Do à la basse : C6 plutôt que Am7/C", () => {
    const results = identifyChords([60, 64, 67, 69]);
    expect(results[0].chordName).toBe("C6");
    expect(chordNames(results)).toContain("Am7/C");
  });

  test("A C E G avec La à la basse : Am7", () => {
    expect(identifyChords([57, 60, 64, 67])[0].chordName).toBe("Am7");
  });

  test("note facultative absente : listée entre parenthèses après le degré qui la précède", () => {
    const [first] = identifyChords([55, 59, 65]); // G B F
    expect(first.chordName).toBe("G7");
    expect(table(first)).toEqual(["G", "B", "(D)", "F"]);
    const missing = first.noteIntervalPairs.find((p) => p.missing);
    expect(missing).toMatchObject({ pc: 2, interval: "5", missing: true });
  });

  test("13 sans quinte ni 9e : les deux absentes à leur place", () => {
    const [first] = identifyChords([48, 52, 58, 69]); // C E B♭ A
    expect(first.chordName).toBe("C13");
    expect(table(first)).toEqual(["C", "E", "(G)", "B♭", "(D)", "A"]);
  });

  test("accords incomplets refusés : toutes les notes deviennent obligatoires", () => {
    expect(chordNames(identifyChords([55, 59, 65], "sharp", { allowIncomplete: false }))).not.toContain("G7");
    expect(identifyChords([55, 59, 62, 65], "sharp", { allowIncomplete: false })[0].chordName).toBe("G7");
  });

  test("une note absente rend la lecture moins probable", () => {
    const complete = identifyChords([55, 59, 62, 65])[0];
    const incomplete = identifyChords([55, 59, 65])[0];
    expect(incomplete.priority).toBeGreaterThan(complete.priority);
  });

  test("triades strictes : deux notes ne font pas un accord majeur", () => {
    const results = identifyChords([60, 64]); // C E
    expect(results.some((r) => r.rootPc === 0 && r.suffix === "")).toBe(false);
  });

  test("quinte seule : accord de puissance", () => {
    expect(identifyChords([60, 67])[0].chordName).toBe("C5");
  });

  test("une note étrangère exclut le modèle", () => {
    const results = identifyChords([60, 64, 66, 67]); // C E F♯ G
    expect(chordNames(results)).not.toContain("C");
  });

  test("aug7 et 7♯5 ont les mêmes touches : toujours trouvés ensemble", () => {
    const results = chordNames(identifyChords([60, 64, 68, 70]));
    expect(results).toContain("C7♯5");
    expect(results).toContain("Caug7");
  });

  test("7♭13 sans quinte n'est pas reconnu (lu 7♯5)", () => {
    const results = chordNames(identifyChords([60, 64, 68, 70]));
    expect(results).not.toContain("C7♭13");
    expect(chordNames(identifyChords([60, 64, 67, 68, 70]))).toContain("C7♭13");
  });

  test("Dm13 à l'état fondamental l'emporte sur les lectures en 11", () => {
    const voicing = buildChordVoicing(D, template("m13"), 0).map((n) => n.midi);
    expect(identifyChords(voicing)[0].chordName).toBe("Dm13");
  });

  test("au plus 4 résultats, sans doublon, du plus probable au moins probable", () => {
    for (const notes of [[60, 63, 66, 69], [60, 64, 68], [60, 62, 67], [60, 64, 67, 69, 74]]) {
      const results = identifyChords(notes);
      expect(results.length).toBeLessThanOrEqual(4);
      expect(new Set(chordNames(results)).size).toBe(results.length);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].priority).toBeGreaterThanOrEqual(results[i - 1].priority);
      }
    }
  });

  test("dim7 : symétrique, plusieurs lectures possibles", () => {
    const results = chordNames(identifyChords([60, 63, 66, 69]));
    expect(results[0]).toBe("Cdim7");
    expect(results.length).toBeGreaterThan(1);
  });

  test("le résultat ne garde que { pc, note, interval } dans le tableau", () => {
    for (const pair of identifyChords([55, 59, 65])[0].noteIntervalPairs) {
      expect(Object.keys(pair).sort()).toEqual(
        pair.missing ? ["interval", "missing", "note", "pc"] : ["interval", "note", "pc"],
      );
    }
  });
});

describe("buildPendingNotePairs (notes jouées sans accord reconnu)", () => {
  test("une entrée par classe de hauteur, de la plus grave à la plus aiguë, nommée selon le réglage", () => {
    const pairs = buildPendingNotePairs([73, 61, 64], "flat");
    expect(pairs.map((p) => englishNoteName(p.note))).toEqual(["D♭", "E"]);
    expect(pairs.map((p) => p.interval)).toEqual(["—", "—"]);
    expect(pairs.map((p) => p.pc)).toEqual([1, 4]);
    expect(englishNoteName(buildPendingNotePairs([61], "sharp")[0].note)).toBe("C♯");
  });
});

// ── Dictionnaire (accord → touches) ────────────────────────────────────

describe("buildChordVoicing", () => {
  const allVoicings = CHORD_TEMPLATES.flatMap((tpl) =>
    Array.from({ length: 12 }, (_, rootPc) =>
      Array.from({ length: inversionCount(tpl) }, (_, inversion) => ({ tpl, rootPc, inversion })),
    ).flat(),
  );

  test("Dm9 : chaque renversement fait tourner l'empilement", () => {
    const m9 = template("m9");
    const spelled = (k) =>
      describeVoicing(D, m9, buildChordVoicing(D, m9, k)).noteIntervalPairs.map((p) => englishNoteName(p.note));
    expect(spelled(0)).toEqual(["D", "F", "A", "C", "E"]);
    expect(spelled(1)).toEqual(["F", "A", "C", "E", "D"]);
    expect(spelled(2)).toEqual(["A", "C", "E", "D", "F"]);
    expect(spelled(3)).toEqual(["C", "E", "D", "F", "A"]);
    expect(spelled(4)).toEqual(["E", "D", "F", "A", "C"]);
  });

  test("état fondamental : 9, 11 et 13 au-dessus de l'octave", () => {
    expect(buildChordVoicing(C, template("13♯11"), 0).map((n) => n.midi)).toEqual([60, 64, 67, 70, 74, 78, 81]);
  });

  test.each(allVoicings)("$tpl.suffix, fondamentale $rootPc, renversement $inversion", ({ tpl, rootPc, inversion }) => {
    const voicing = buildChordVoicing(rootPc, tpl, inversion);
    const midis = voicing.map((n) => n.midi);

    // Toutes les notes du modèle, une fois chacune, du grave à l'aigu
    expect(new Set(midis.map((m) => (m - rootPc + 12) % 12))).toEqual(new Set(tpl.intervals));
    expect(midis.length).toBe(tpl.degrees.length);
    for (let i = 1; i < midis.length; i++) expect(midis[i]).toBeGreaterThan(midis[i - 1]);

    // Basse : le degré du renversement, dans l'octave la plus grave ; écart ≤ 22 demi-tons
    expect(voicing[0].degree).toBe(tpl.voicing[inversion]);
    expect(midis[0]).toBeGreaterThanOrEqual(VOICING_LOWEST_NOTE);
    expect(midis[0]).toBeLessThanOrEqual(VOICING_LOWEST_NOTE + 11);
    expect(midis.at(-1) - midis[0]).toBeLessThanOrEqual(22);

    // Le cycle revient à l'état fondamental
    expect(buildChordVoicing(rootPc, tpl, inversion + inversionCount(tpl))).toEqual(voicing);

    // Aller-retour : la détection retrouve l'accord choisi (avec ou sans accords incomplets)
    for (const accidentals of ["sharp", "flat"]) {
      const expected = describeVoicing(rootPc, tpl, voicing, accidentals).chordName;
      for (const allowIncomplete of [true, false]) {
        const results = identifyChords(midis, accidentals, { allowIncomplete });
        expect(chordNames(results)).toContain(expected);
        // À l'état fondamental il arrive en tête (aug7 est à égalité avec 7♯5, classé avant)
        if (inversion === 0 && tpl.suffix !== "aug7") expect(results[0].chordName).toBe(expected);
      }
    }
  });
});

describe("describeVoicing", () => {
  test("même forme que identifyChords, basse en barre oblique pour un renversement", () => {
    const tpl = template("");
    const chord = describeVoicing(C, tpl, buildChordVoicing(C, tpl, 1), "flat");
    expect(chord).toMatchObject({ rootPc: 0, bassPc: 4, suffix: "", chordName: "C/E", isInversion: true });
    expect(chord.noteIntervalPairs.map((p) => p.interval)).toEqual(["3", "5", "1"]);
  });

  test("fondamentale noire selon le réglage, notes épelées depuis elle", () => {
    const tpl = template("m");
    const flat = describeVoicing(6, tpl, buildChordVoicing(6, tpl, 0), "flat");
    expect(flat.chordName).toBe("G♭m");
    expect(flat.noteIntervalPairs.map((p) => englishNoteName(p.note))).toEqual(["G♭", "B𝄫", "D♭"]);
    const sharp = describeVoicing(6, tpl, buildChordVoicing(6, tpl, 0), "sharp");
    expect(sharp.noteIntervalPairs.map((p) => englishNoteName(p.note))).toEqual(["F♯", "A", "C♯"]);
  });
});
