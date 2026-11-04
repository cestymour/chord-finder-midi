import { describe, expect, test } from "vitest";
import { CHORD_TEMPLATES, CHORD_TEMPLATE_GROUPS } from "./chords.js";
import {
  CHORD_TYPE_NAMES,
  DEFAULT_LANGUAGE,
  GROUP_NAMES,
  LANGUAGE_CODES,
  MESSAGES,
  createI18n,
} from "./i18n.js";

const note = (letter, alter = 0) => ({ letter, alter });

describe("traductions complètes", () => {
  test("les quatre langues ont un jeu de libellés", () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LANGUAGE_CODES].sort());
  });

  test.each(LANGUAGE_CODES)("%s : mêmes clés que le français, aucune vide", (lang) => {
    expect(Object.keys(MESSAGES[lang]).sort()).toEqual(Object.keys(MESSAGES[DEFAULT_LANGUAGE]).sort());
    for (const value of Object.values(MESSAGES[lang])) expect(value.trim()).not.toBe("");
  });

  test.each(LANGUAGE_CODES)("%s : un nom pour chaque type d'accord et chaque groupe", (lang) => {
    expect(Object.keys(CHORD_TYPE_NAMES[lang]).sort()).toEqual(CHORD_TEMPLATES.map((tpl) => tpl.suffix).sort());
    expect(Object.keys(GROUP_NAMES[lang]).sort()).toEqual(CHORD_TEMPLATE_GROUPS.map((g) => g.id).sort());
  });

  test("altérations : vrais symboles, jamais # dans les libellés", () => {
    for (const lang of LANGUAGE_CODES) {
      for (const value of [...Object.values(MESSAGES[lang]), ...Object.values(CHORD_TYPE_NAMES[lang])]) {
        expect(value).not.toMatch(/[A-G]#/);
      }
    }
  });
});

describe("createI18n", () => {
  test("t : libellé de la langue, sinon français, sinon la clé", () => {
    expect(createI18n("en", "sharp").t("status.connect")).toBe(MESSAGES.en["status.connect"]);
    expect(createI18n("xx", "sharp").t("status.connect")).toBe(MESSAGES.fr["status.connect"]);
    expect(createI18n("fr", "sharp").t("clé.inconnue")).toBe("clé.inconnue");
  });

  test("langue et altérations inconnues : valeurs par défaut", () => {
    const i18n = createI18n("xx", "bizarre");
    expect(i18n.language).toBe("fr");
    expect(i18n.accidentals).toBe("sharp");
  });

  test("noms de notes selon la langue", () => {
    const eFlat = note(2, -1);
    expect(createI18n("fr", "sharp").noteName(eFlat)).toBe("Mi♭");
    expect(createI18n("en", "sharp").noteName(eFlat)).toBe("E♭");
    expect(createI18n("es", "sharp").noteName(note(1))).toBe("Re");
    expect(createI18n("fr", "sharp").noteName(note(1))).toBe("Ré");
    expect(createI18n("fr", "sharp").noteName(note(3, 2))).toBe("Fa𝄪");
  });

  test("allemand : H = si naturel, B = si bémol, les autres altérations gardent H", () => {
    const de = createI18n("de", "flat");
    expect(de.noteName(note(6))).toBe("H");
    expect(de.noteName(note(6, -1))).toBe("B");
    expect(de.noteName(note(6, 1))).toBe("H♯");
    expect(de.noteName(note(6, -2))).toBe("H𝄫");
    expect(de.rootName(note(6))).toBe("H");
    expect(de.rootName(note(6, -1))).toBe("B");
  });

  test("symboles d'accords en lettres anglaises (sauf allemand)", () => {
    expect(createI18n("fr", "flat").rootName(note(6, -1))).toBe("B♭");
    expect(createI18n("es", "sharp").rootName(note(0, 1))).toBe("C♯");
  });

  test("touches hors accord : dièses ou bémols selon le réglage", () => {
    expect(createI18n("fr", "sharp").pcName(1)).toBe("Do♯");
    expect(createI18n("fr", "flat").pcName(1)).toBe("Ré♭");
    expect(createI18n("de", "flat").pcName(10)).toBe("B");
  });

  test("octaves : Do central = Do3 (fr, es), C4 (en, de)", () => {
    expect(createI18n("fr", "sharp").keyLabel(60)).toBe("Do3");
    expect(createI18n("es", "sharp").keyLabel(60)).toBe("Do3");
    expect(createI18n("en", "sharp").keyLabel(60)).toBe("C4");
    expect(createI18n("de", "sharp").keyLabel(60)).toBe("C4");
    expect(createI18n("en", "sharp").keyLabel(21)).toBe("A0");
    expect(createI18n("fr", "flat").keyLabel(70)).toBe("Si♭3");
  });

  test("renversements", () => {
    const fr = createI18n("fr", "sharp");
    expect(fr.inversionLabel(0)).toBe("État fondamental");
    expect(fr.inversionLabel(1)).toBe("1er renversement");
    expect(fr.inversionLabel(2)).toBe("2e renversement");
    const en = createI18n("en", "sharp");
    expect([1, 2, 3, 4, 6].map(en.inversionLabel)).toEqual([
      "1st inversion", "2nd inversion", "3rd inversion", "4th inversion", "6th inversion",
    ]);
  });

  test("types d'accords et groupes traduits", () => {
    expect(createI18n("fr", "sharp").chordTypeName("m7")).toBe("Septième mineure");
    expect(createI18n("en", "sharp").chordTypeName("")).toBe("Major");
    expect(createI18n("de", "sharp").groupName("triads")).toBe("Dreiklänge");
  });
});
