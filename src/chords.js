// Moteur d'accords (fonctions pures, sans React) :
// - détection : notes MIDI → accords (identifyChords)
// - sens inverse : accord → touches à jouer (buildChordVoicing, describeVoicing)
// - orthographe : nom exact de chaque note d'un accord (spellRoot, spellDegree)
//
// Une note orthographiée est un objet { letter, alter } :
//   letter : 0–6 pour C D E F G A B (Do Ré Mi Fa Sol La Si)
//   alter  : -2 (𝄫), -1 (♭), 0, +1 (♯), +2 (𝄪)
// Les noms affichés (selon la langue) sont construits dans src/i18n.js.

// ─────────────────────────────────────────────
// ALTÉRATIONS ET ORTHOGRAPHE
// ─────────────────────────────────────────────

// Réglage dièses/bémols. Il décide du nom des touches noires hors accord
// (clavier, accord non reconnu) et des fondamentales à égalité (F♯/G♭ majeur,
// D♯m/E♭m). Les autres notes d'un accord s'écrivent selon sa fondamentale.
export const ACCIDENTALS = ["sharp", "flat"];
// Valeur par défaut (avant tout choix de l'utilisateur dans les paramètres)
export const DEFAULT_ACCIDENTALS = "sharp";

/** Symboles des altérations, indexés par `alter` + 2 (vrais symboles, jamais "#" ni "b"). */
export const ACCIDENTAL_SYMBOLS = ["𝄫", "♭", "", "♯", "𝄪"];

// Classe de hauteur de chaque lettre naturelle (C D E F G A B)
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11];
const ENGLISH_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// Black-key pitch classes: C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭ (virtual keyboard layout).
export const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

/** Nom d'une classe de hauteur hors accord : dièse ou bémol selon le réglage. */
export function spellPc(pc, accidentals = DEFAULT_ACCIDENTALS) {
  const p = ((pc % 12) + 12) % 12;
  if (!BLACK_KEY_PCS.has(p)) return { letter: LETTER_PCS.indexOf(p), alter: 0 };
  return accidentals === "flat"
    ? { letter: LETTER_PCS.indexOf(p + 1), alter: -1 }
    : { letter: LETTER_PCS.indexOf(p - 1), alter: 1 };
}

// Fondamentale sur une touche noire : on garde l'écriture dont la tonalité
// a le moins d'altérations à la clé (Si♭ majeur : 2 bémols, La♯ majeur : 10 dièses).
// "tie" = autant d'altérations des deux côtés → le réglage décide.
const BLACK_ROOT_SPELLING = {
  major: { 1: "flat", 3: "flat", 6: "tie", 8: "flat", 10: "flat" },   // D♭ E♭ F♯/G♭ A♭ B♭
  minor: { 1: "sharp", 3: "tie", 6: "sharp", 8: "sharp", 10: "flat" }, // C♯m D♯m/E♭m F♯m G♯m B♭m
};

/** Fondamentale d'un accord, selon son type (mineur ou non) et le réglage en cas d'égalité. */
export function spellRoot(pc, template, accidentals = DEFAULT_ACCIDENTALS) {
  const p = ((pc % 12) + 12) % 12;
  const choice = BLACK_ROOT_SPELLING[template?.minor ? "minor" : "major"][p];
  return spellPc(p, choice === undefined || choice === "tie" ? accidentals : choice);
}

/** Note située à un degré donné au-dessus d'une fondamentale orthographiée. */
export function spellDegree(root, degree) {
  const letter = (root.letter + degree.step) % 7;
  const rootPc = LETTER_PCS[root.letter] + root.alter;
  const pc = (((rootPc + degree.semitones) % 12) + 12) % 12;
  const alter = ((pc - LETTER_PCS[letter] + 18) % 12) - 6;
  return { letter, alter };
}

/** Nom anglais d'une note orthographiée (clé de dédoublonnage, vérifications). */
export const englishNoteName = (note) =>
  ENGLISH_LETTERS[note.letter] + ACCIDENTAL_SYMBOLS[note.alter + 2];

// ─────────────────────────────────────────────
// DEGRÉS
// Un degré s'écrit comme dans un symbole d'accord : "1", "♭3", "♯5", "𝄫7",
// "9", "♯11", "13"… Il donne à la fois le nombre de demi-tons au-dessus de la
// fondamentale (au-delà de l'octave pour 9, 11, 13), la lettre de la note
// (`step` : nombre de lettres au-dessus de la fondamentale) et l'intervalle
// affiché dans le tableau.
// ─────────────────────────────────────────────

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const DEGREE_ALTER = { "𝄫": -2, "♭": -1, "": 0, "♯": 1 };

function parseDegree(label) {
  const [, acc, num] = /^(𝄫|♭|♯)?(\d+)$/u.exec(label);
  const n = Number(num);
  const step = (n - 1) % 7;
  return {
    label,
    step,
    semitones: MAJOR_SCALE[step] + DEGREE_ALTER[acc ?? ""] + (n > 7 ? 12 : 0),
  };
}

// ─────────────────────────────────────────────
// CHORD DEFINITIONS
// Les libellés (nom du type d'accord, nom du groupe) sont traduits dans
// src/i18n.js, indexés par `suffix` et par `id` de groupe.
// `degrees` : notes de l'accord, dans l'ordre où le dictionnaire les empile
//   du grave à l'aigu (9, 11 et 13 au-dessus de l'octave).
// `optional` : degrés qu'on peut ne pas jouer (la quinte juste des accords de
//   7e et plus, la 9e et la 11e des 13e). Tous les autres sont obligatoires,
//   et aucune note en dehors de `degrees` n'est acceptée.
// ─────────────────────────────────────────────

const RAW_TEMPLATE_GROUPS = [
  {
    id: "triads",
    templates: [
      { suffix: "",      degrees: ["1", "3", "5"] },
      { suffix: "m",     degrees: ["1", "♭3", "5"] },
      { suffix: "dim",   degrees: ["1", "♭3", "♭5"] },
      { suffix: "aug",   degrees: ["1", "3", "♯5"] },
      { suffix: "sus2",  degrees: ["1", "2", "5"] },
      { suffix: "sus4",  degrees: ["1", "4", "5"] },
      { suffix: "5",     degrees: ["1", "5"] },
    ],
  },
  {
    id: "sixths",
    templates: [
      { suffix: "6",     degrees: ["1", "3", "5", "6"] },
      { suffix: "m6",    degrees: ["1", "♭3", "5", "6"] },
      { suffix: "6/9",   degrees: ["1", "3", "5", "6", "9"], optional: ["5"] },
    ],
  },
  {
    id: "sevenths",
    templates: [
      { suffix: "maj7",  degrees: ["1", "3", "5", "7"], optional: ["5"] },
      { suffix: "7",     degrees: ["1", "3", "5", "♭7"], optional: ["5"] },
      { suffix: "m7",    degrees: ["1", "♭3", "5", "♭7"], optional: ["5"] },
      { suffix: "mM7",   degrees: ["1", "♭3", "5", "7"], optional: ["5"] },
      { suffix: "dim7",  degrees: ["1", "♭3", "♭5", "𝄫7"] },
      { suffix: "m7♭5",  degrees: ["1", "♭3", "♭5", "♭7"] },
      { suffix: "aug7",  degrees: ["1", "3", "♯5", "♭7"] },
      { suffix: "7sus4", degrees: ["1", "4", "5", "♭7"] },
      { suffix: "7♭5",   degrees: ["1", "3", "♭5", "♭7"] },
      { suffix: "7♯5",   degrees: ["1", "3", "♯5", "♭7"] },
    ],
  },
  {
    id: "ninths",
    templates: [
      { suffix: "maj9",  degrees: ["1", "3", "5", "7", "9"], optional: ["5"] },
      { suffix: "9",     degrees: ["1", "3", "5", "♭7", "9"], optional: ["5"] },
      { suffix: "m9",    degrees: ["1", "♭3", "5", "♭7", "9"], optional: ["5"] },
      { suffix: "mM9",   degrees: ["1", "♭3", "5", "7", "9"], optional: ["5"] },
      { suffix: "add9",  degrees: ["1", "3", "5", "9"] },
      { suffix: "madd9", degrees: ["1", "♭3", "5", "9"] },
      { suffix: "9sus4", degrees: ["1", "4", "5", "♭7", "9"] },
      { suffix: "7♭9",   degrees: ["1", "3", "5", "♭7", "♭9"], optional: ["5"] },
      { suffix: "7♯9",   degrees: ["1", "3", "5", "♭7", "♯9"], optional: ["5"] },
    ],
  },
  {
    id: "elevenths",
    templates: [
      { suffix: "11",    degrees: ["1", "3", "5", "♭7", "9", "11"], optional: ["5"] },
      { suffix: "m11",   degrees: ["1", "♭3", "5", "♭7", "9", "11"], optional: ["5"] },
      { suffix: "maj11", degrees: ["1", "3", "5", "7", "9", "11"], optional: ["5"] },
      { suffix: "add11", degrees: ["1", "3", "5", "11"] },
      { suffix: "7♯11",  degrees: ["1", "3", "5", "♭7", "♯11"], optional: ["5"] },
    ],
  },
  {
    id: "thirteenths",
    templates: [
      // Pas de 11e juste dans 13 et maj13 : elle frotte contre la tierce majeure.
      { suffix: "13",    degrees: ["1", "3", "5", "♭7", "9", "13"], optional: ["5", "9"] },
      { suffix: "m13",   degrees: ["1", "♭3", "5", "♭7", "9", "11", "13"], optional: ["5", "9", "11"] },
      { suffix: "maj13", degrees: ["1", "3", "5", "7", "9", "13"], optional: ["5", "9"] },
    ],
  },
];

/**
 * Champs calculés de chaque template :
 * - `intervals` : classes de hauteur (0–11) au-dessus de la fondamentale, triées
 * - `required`  : celles qui doivent être jouées
 * - `degreeByInterval` : degré correspondant à chaque classe de hauteur
 * - `voicing`   : degrés empilés pour le dictionnaire (demi-tons croissants)
 * - `minor`     : tierce mineure (choix de l'écriture de la fondamentale)
 */
function buildTemplate(raw) {
  const degrees = raw.degrees.map(parseDegree);
  const optional = new Set(raw.optional ?? []);
  const degreeByInterval = new Map(degrees.map((d) => [d.semitones % 12, d]));
  return {
    suffix: raw.suffix,
    degrees,
    intervals: [...degreeByInterval.keys()].sort((a, b) => a - b),
    required: degrees.filter((d) => !optional.has(d.label)).map((d) => d.semitones % 12),
    degreeByInterval,
    voicing: [...degrees].sort((a, b) => a.semitones - b.semitones),
    minor: raw.degrees.includes("♭3"),
  };
}

export const CHORD_TEMPLATE_GROUPS = RAW_TEMPLATE_GROUPS.map((g) => ({
  id: g.id,
  templates: g.templates.map(buildTemplate),
}));

export const CHORD_TEMPLATES = CHORD_TEMPLATE_GROUPS.flatMap((g) => g.templates);

// ─────────────────────────────────────────────
// CHORD DETECTION ENGINE
// ─────────────────────────────────────────────

// Fréquence d'usage par suffixe (plus petit = plus courant).
// Les clés doivent correspondre exactement aux suffixes des templates.
const SUFFIX_RANK = {
  "":       1,
  "m":      1,
  "7":      1,
  "m7":     1,
  "5":      1,
  "sus2":   1,
  "sus4":   1,
  "maj7":   2,
  "6":      2,
  "m6":     2,
  "add9":   2,
  "madd9":  2,
  "9":      2,
  "m9":     2,
  "7sus4":  2,
  "6/9":    3,
  "7♯5":    3,
  "7♭5":    3,
  "m7♭5":   3,
  "dim7":   3,
  "9sus4":  3,
  "7♭9":    3,
  "7♯9":    3,
  "add11":  3,
  "mM7":    4,
  "dim":    4,
  "aug":    4,
  "aug7":   4,
  "11":     4,
  "m11":    4,
  "7♯11":   4,
  "maj9":   5,
  "maj11":  5,
  "maj13":  5,
  "13":     5,
  "m13":    5,
  "mM9":    5,
};

// 1.5 > écart de rang entre "6" et "m7" : C E G A avec Do à la basse donne C6, pas Am7/C
const INVERSION_PENALTY = 1.5;
// Chaque note facultative absente rend la lecture un peu moins probable
const MISSING_NOTE_PENALTY = 1;

/**
 * Notes MIDI jouées → accords possibles, du plus probable au moins probable (4 au plus).
 * `accidentals` : "sharp" | "flat", pour les fondamentales à égalité.
 * `allowIncomplete` : accepter un accord dont des notes facultatives ne sont pas
 *   jouées (sinon, toutes les notes du template sont obligatoires).
 *
 * Chaque résultat : { rootPc, root, bassPc, bass, suffix, chordName, isInversion,
 * noteIntervalPairs: [{ pc, note, interval, missing? }] } où `root`, `bass` et
 * `note` sont des notes orthographiées ({ letter, alter }). Les notes facultatives
 * non jouées figurent dans noteIntervalPairs avec `missing: true`.
 */
export function identifyChords(
  midiNotes,
  accidentals = DEFAULT_ACCIDENTALS,
  { allowIncomplete = true } = {}
) {
  if (midiNotes.length < 2) return [];

  const sorted = [...midiNotes].sort((a, b) => a - b);
  const bassPc = sorted[0] % 12; // note la plus grave
  // Classes de hauteur, du grave à l'aigu (première apparition de chacune)
  const pitchClasses = [...new Set(sorted.map((n) => n % 12))];

  const results = [];

  for (let rootPc = 0; rootPc < 12; rootPc++) {
    const intervalSet = new Set(pitchClasses.map((pc) => (pc - rootPc + 12) % 12));

    for (const template of CHORD_TEMPLATES) {
      // Toutes les notes obligatoires, et aucune note étrangère à l'accord
      const required = allowIncomplete ? template.required : template.intervals;
      if (!required.every((i) => intervalSet.has(i))) continue;
      if ([...intervalSet].some((i) => !template.degreeByInterval.has(i))) continue;

      const missing = template.intervals.length - intervalSet.size;
      const root = spellRoot(rootPc, template, accidentals);
      const isInversion = bassPc !== rootPc;

      const playedPairs = pitchClasses.map((pc) => {
        const degree = template.degreeByInterval.get((pc - rootPc + 12) % 12);
        return { pc, note: spellDegree(root, degree), interval: degree.label, degree };
      });
      const bass = isInversion ? playedPairs[0].note : null;
      const noteIntervalPairs = insertMissingDegrees(playedPairs, template, rootPc, root);

      results.push({
        rootPc,
        root,
        bassPc: isInversion ? bassPc : null,
        bass,
        suffix: template.suffix,
        chordName: englishNoteName(root) + template.suffix + (bass ? "/" + englishNoteName(bass) : ""),
        isInversion,
        priority:
          (SUFFIX_RANK[template.suffix] ?? 6) +
          (isInversion ? INVERSION_PENALTY : 0) +
          missing * MISSING_NOTE_PENALTY,
        noteIntervalPairs,
      });
    }
  }

  // Ordre : lecture la plus probable d'abord, puis alphabétique
  results.sort((a, b) => a.priority - b.priority || a.chordName.localeCompare(b.chordName));

  // Une seule entrée par nom d'accord, 4 au plus
  const seen = new Set();
  return results
    .filter((r) => !seen.has(r.chordName) && seen.add(r.chordName))
    .slice(0, 4);
}

/**
 * Ajoute les notes facultatives non jouées au tableau (`missing: true`).
 * Chacune se place juste après le degré qui la précède dans l'accord
 * (la quinte après la tierce, la 9e après la 7e…), là où on l'attendrait.
 */
function insertMissingDegrees(playedPairs, template, rootPc, root) {
  const pairs = [...playedPairs];
  template.degrees.forEach((degree, index) => {
    if (pairs.some((p) => p.degree === degree)) return;
    const previous = template.degrees[index - 1]; // la fondamentale est toujours jouée
    const at = pairs.findIndex((p) => p.degree === previous) + 1;
    pairs.splice(at, 0, {
      pc: (rootPc + degree.semitones) % 12,
      note: spellDegree(root, degree),
      interval: degree.label,
      degree,
      missing: true,
    });
  });
  // `degree` ne sert qu'au placement : les résultats gardent la forme { pc, note, interval }
  for (const pair of pairs) delete pair.degree;
  return pairs;
}

/** Notes jouées sans accord reconnu → paires pour le tableau (noms selon le réglage). */
export function buildPendingNotePairs(midiNotes, accidentals = DEFAULT_ACCIDENTALS) {
  const sorted = [...midiNotes].sort((a, b) => a - b);
  return [...new Set(sorted.map((n) => n % 12))].map((pc) => ({
    pc,
    note: spellPc(pc, accidentals),
    interval: "—",
  }));
}

// ─────────────────────────────────────────────
// CHORD EXPLORER (sens inverse : accord → touches)
// ─────────────────────────────────────────────

/** Note la plus grave possible d'un voicing (Do2, convention française). */
export const VOICING_LOWEST_NOTE = 48;

/**
 * Voicing canonique d'un accord : fondamentale (ou basse du renversement)
 * dans l'octave [VOICING_LOWEST_NOTE, +11], puis les degrés de `template.voicing`
 * empilés vers le haut. Chaque renversement fait monter la note la plus grave
 * d'une octave. Renvoie [{ midi, degree }] trié du grave à l'aigu.
 *
 * L'écart grave→aigu ne dépasse jamais 21 demi-tons, donc le voicing tient
 * dans [48, 83] (3 octaves) et dans 2 octaves visibles.
 */
export function buildChordVoicing(rootPc, template, inversion = 0) {
  let notes = template.voicing.map((degree) => ({ midi: rootPc + degree.semitones, degree }));

  for (let i = 0; i < inversion % notes.length; i++) {
    const [lowest, ...rest] = notes;
    notes = [...rest, { ...lowest, midi: lowest.midi + 12 }].sort((a, b) => a.midi - b.midi);
  }

  // Ramène la basse dans l'octave la plus grave du clavier
  const bass = notes[0].midi;
  const shift = VOICING_LOWEST_NOTE + (((bass - VOICING_LOWEST_NOTE) % 12) + 12) % 12 - bass;
  return notes.map((n) => ({ ...n, midi: n.midi + shift }));
}

/** Nombre de positions (état fondamental + renversements) d'un accord. */
export const inversionCount = (template) => template.voicing.length;

/** Données d'affichage (même forme que identifyChords) pour un voicing choisi. */
export function describeVoicing(rootPc, template, voicing, accidentals = DEFAULT_ACCIDENTALS) {
  const root = spellRoot(rootPc, template, accidentals);
  const noteIntervalPairs = voicing.map((n) => ({
    pc: n.midi % 12,
    note: spellDegree(root, n.degree),
    interval: n.degree.label,
  }));
  const bassPc = voicing[0].midi % 12;
  const isInversion = bassPc !== rootPc;
  const bass = isInversion ? noteIntervalPairs[0].note : null;

  return {
    rootPc,
    root,
    bassPc: isInversion ? bassPc : null,
    bass,
    suffix: template.suffix,
    chordName: englishNoteName(root) + template.suffix + (bass ? "/" + englishNoteName(bass) : ""),
    isInversion,
    noteIntervalPairs,
  };
}
