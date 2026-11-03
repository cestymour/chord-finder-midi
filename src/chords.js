// Moteur d'accords (fonctions pures, sans React) :
// - détection : notes MIDI → accords (identifyChords)
// - sens inverse : accord → touches à jouer (buildChordVoicing, describeVoicing)

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

// Altérations des touches noires, partout dans l'appli (noms d'accords et notes) :
// "sharp" → C♯, Do♯ ; "flat" → D♭, Ré♭ (vrais symboles, jamais "#" ni "b").
export const ACCIDENTALS = ["sharp", "flat"];
// Valeur par défaut (avant tout choix de l'utilisateur dans les paramètres)
export const DEFAULT_ACCIDENTALS = "sharp";

// Index = semitone 0–11. Les symboles d'accords restent en notation anglaise
// quelle que soit la langue ; les noms de notes traduits sont dans src/i18n.js.
const ROOT_NAMES = {
  sharp: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"],
  flat:  ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"],
};

// Black-key pitch classes: C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭ (virtual keyboard layout).
export const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

/** Nom anglais d'une note (fondamentale / basse des symboles d'accords). */
export function getRootNameEN(semitone, accidentals) {
  return (ROOT_NAMES[accidentals] ?? ROOT_NAMES[DEFAULT_ACCIDENTALS])[semitone % 12];
}

// ─────────────────────────────────────────────
// CHORD DEFINITIONS
// Les libellés (nom du type d'accord, nom du groupe) sont traduits dans
// src/i18n.js, indexés par `suffix` et par `id` de groupe.
// `intervals`: semitones from root, sorted ascending, all within one octave.
//   ALL intervals must be present for a match (strict mode).
// `voicing` (optional): how the chord is laid out on the keyboard in the
//   chord explorer (extensions above the octave: 9 → 14, 11 → 17, 13 → 21).
//   Its pitch classes must equal `intervals`. Defaults to `intervals`.
// ─────────────────────────────────────────────

export const CHORD_TEMPLATE_GROUPS = [
  {
    id: "triads",
    templates: [
      { suffix: "",      intervals: [0, 4, 7] },
      { suffix: "m",     intervals: [0, 3, 7] },
      { suffix: "dim",   intervals: [0, 3, 6] },
      { suffix: "aug",   intervals: [0, 4, 8] },
      { suffix: "sus2",  intervals: [0, 2, 7] },
      { suffix: "sus4",  intervals: [0, 5, 7] },
      { suffix: "5",     intervals: [0, 7] },
    ],
  },
  {
    id: "sixths",
    templates: [
      { suffix: "6",     intervals: [0, 4, 7, 9] },
      { suffix: "m6",    intervals: [0, 3, 7, 9] },
      { suffix: "6/9",   intervals: [0, 2, 4, 7, 9],
        voicing: [0, 4, 7, 9, 14] },
    ],
  },
  {
    id: "sevenths",
    templates: [
      { suffix: "maj7",  intervals: [0, 4, 7, 11] },
      { suffix: "7",     intervals: [0, 4, 7, 10] },
      { suffix: "m7",    intervals: [0, 3, 7, 10] },
      { suffix: "mM7",   intervals: [0, 3, 7, 11] },
      { suffix: "dim7",  intervals: [0, 3, 6, 9] },
      { suffix: "m7♭5",  intervals: [0, 3, 6, 10] },
      { suffix: "aug7",  intervals: [0, 4, 8, 10] },
      { suffix: "7sus4", intervals: [0, 5, 7, 10] },
      { suffix: "7♭5",   intervals: [0, 4, 6, 10] },
      { suffix: "7♯5",   intervals: [0, 4, 8, 10] },
    ],
  },
  {
    id: "ninths",
    templates: [
      { suffix: "maj9",  intervals: [0, 2, 4, 7, 11],
        voicing: [0, 4, 7, 11, 14] },
      { suffix: "9",     intervals: [0, 2, 4, 7, 10],
        voicing: [0, 4, 7, 10, 14] },
      { suffix: "m9",    intervals: [0, 2, 3, 7, 10],
        voicing: [0, 3, 7, 10, 14] },
      { suffix: "add9",  intervals: [0, 2, 4, 7],
        voicing: [0, 4, 7, 14] },
      { suffix: "madd9", intervals: [0, 2, 3, 7],
        voicing: [0, 3, 7, 14] },
    ],
  },
  {
    id: "elevenths",
    templates: [
      { suffix: "11",    intervals: [0, 2, 4, 5, 7, 10],
        voicing: [0, 4, 7, 10, 14, 17] },
      { suffix: "m11",   intervals: [0, 2, 3, 5, 7, 10],
        voicing: [0, 3, 7, 10, 14, 17] },
      { suffix: "maj11", intervals: [0, 2, 4, 5, 7, 11],
        voicing: [0, 4, 7, 11, 14, 17] },
    ],
  },
  {
    id: "thirteenths",
    templates: [
      { suffix: "13",    intervals: [0, 2, 4, 5, 7, 9, 10],
        voicing: [0, 4, 7, 10, 14, 17, 21] },
      { suffix: "m13",   intervals: [0, 2, 3, 5, 7, 9, 10],
        voicing: [0, 3, 7, 10, 14, 17, 21] },
      { suffix: "maj13", intervals: [0, 2, 4, 5, 7, 9, 11],
        voicing: [0, 4, 7, 11, 14, 17, 21] },
    ],
  },
];

export const CHORD_TEMPLATES = CHORD_TEMPLATE_GROUPS.flatMap((g) => g.templates);

// ─────────────────────────────────────────────
// CHORD DETECTION ENGINE
// ─────────────────────────────────────────────

/**
 * Given a set of MIDI note numbers, returns an array of matching chords
 * sorted by likelihood (most complete match first).
 * `accidentals` : "sharp" | "flat" (symboles d'accords). Les notes sont renvoyées
 * en classes de hauteur (`pc`), nommées par l'interface selon la langue.
 */
export function identifyChords(midiNotes, accidentals = DEFAULT_ACCIDENTALS) {
  if (midiNotes.length < 2) return [];

  const sorted = [...midiNotes].sort((a, b) => a - b);
  const bassNote = sorted[0]; // lowest note played
  const pitchClasses = [...new Set(sorted.map(n => n % 12))];

  const results = [];

  // Try every pitch class as a potential root
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const template of CHORD_TEMPLATES) {
      // Compute the intervals present if rootPc is the root
      const intervalsFromRoot = pitchClasses.map(pc => (pc - rootPc + 12) % 12);
      const intervalSet = new Set(intervalsFromRoot);

      // Strict mode: ALL intervals of the template must be present
      const allRequiredPresent = template.intervals.every(i => intervalSet.has(i));
      if (!allRequiredPresent) continue;

      // Count how many of the template's full intervals are present (coverage)
      const templateSet = new Set(template.intervals);
      const matchedOptional = template.intervals.filter(i => intervalSet.has(i)).length;
      const extraNotes = [...intervalSet].filter(i => !templateSet.has(i)).length;
      if (extraNotes > 0) continue;

      // Score: prefer more matched intervals and fewer extra notes
      const score = matchedOptional * 10 - extraNotes * 3;

      // Determine bass note for inversion notation
      const bassPc = bassNote % 12;
      const isInversion = bassPc !== rootPc;
      const bassName = isInversion ? getRootNameEN(bassPc, accidentals) : null;

      // Build note+interval pairs aligned together, ordered bass→treble
      // Deduplicate by pitch class while preserving lowest-octave occurrence
      const seenPc = new Set();
      const noteIntervalPairs = sorted
        .filter(n => {
          const pc = n % 12;
          if (seenPc.has(pc)) return false;
          seenPc.add(pc);
          return true;
        })
        .map(n => {
          const pc = n % 12;
          const interval = (pc - rootPc + 12) % 12;
          return {
            pc,
            interval: INTERVAL_LABEL[interval] ?? `+${interval}`,
          };
        });

      results.push({
        rootPc,
        bassPc: isInversion ? bassPc : null,
        root: getRootNameEN(rootPc, accidentals),
        suffix: template.suffix,
        chordName: getRootNameEN(rootPc, accidentals) + template.suffix + (isInversion ? "/" + bassName : ""),
        isInversion,
        bassName,
        score,
        matchedOptional,
        extraNotes,
        noteIntervalPairs,
      });
    }
  }

  if (results.length === 0) return [];

  // Frequency rank per suffix (lower = more common)
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
    "mM7":    4,
    "dim":    4,
    "aug":    4,
    "aug7":   4,
    "11":     4,
    "m11":    4,
    "maj9":   5,
    "maj11":  5,
    "maj13":  5,
    "13":     5,
    "m13":    5,
  };

  const getPriority = (r) => {
    const rank = SUFFIX_RANK[r.suffix] ?? 6;
    // 1.5 > écart de rang entre "6" et "m7" : C E G A avec Do à la basse donne C6, pas Am7/C
    return rank + (r.isInversion ? 1.5 : 0);
  };

  // Sort: higher score first, then priority (frequency + inversion penalty), then alphabetical
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = getPriority(a);
    const pb = getPriority(b);
    if (pa !== pb) return pa - pb;
    return a.chordName.localeCompare(b.chordName);
  });

  // Deduplicate: keep only the best result per chordName
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    if (!seen.has(r.chordName)) {
      seen.add(r.chordName);
      deduped.push(r);
    }
  }

  // Return top 4 at most, only if they have a decent score
  const best = deduped[0].score;
  return deduped.filter(r => r.score >= best - 5).slice(0, 4);
}

/** Notes pressées → paires pour le tableau (même dédup par classe de hauteur que l'accord). */
export function buildPendingNotePairs(midiNotes) {
  const sorted = [...midiNotes].sort((a, b) => a - b);
  const seenPc = new Set();
  return sorted
    .filter((n) => {
      const pc = n % 12;
      if (seenPc.has(pc)) return false;
      seenPc.add(pc);
      return true;
    })
    .map((n) => ({
      pc: n % 12,
      interval: "—",
    }));
}

// Interval → readable label
const INTERVAL_LABEL = {
  0: "1",
  1: "♭2",
  2: "2",
  3: "♭3",
  4: "3",
  5: "4",
  6: "♭5",
  7: "5",
  8: "♯5",
  9: "6",
  10: "♭7",
  11: "7",
};

// Extensions au-delà de l'octave (voicings de l'explorateur)
const EXTENDED_INTERVAL_LABEL = {
  14: "9",
  17: "11",
  21: "13",
};

const intervalLabel = (interval) =>
  EXTENDED_INTERVAL_LABEL[interval] ?? INTERVAL_LABEL[interval % 12] ?? `+${interval}`;

// ─────────────────────────────────────────────
// CHORD EXPLORER (sens inverse : accord → touches)
// ─────────────────────────────────────────────

/** Note la plus grave possible d'un voicing (Do2, convention française). */
export const VOICING_LOWEST_NOTE = 48;

/**
 * Voicing canonique d'un accord : fondamentale (ou basse du renversement)
 * dans l'octave [VOICING_LOWEST_NOTE, +11], puis les notes de `template.voicing`
 * empilées vers le haut. Chaque renversement fait monter la note la plus grave
 * d'une octave. Renvoie [{ midi, interval }] trié du grave à l'aigu, où
 * `interval` est le degré d'origine (0, 4, 7, 14…).
 *
 * L'écart grave→aigu ne dépasse jamais 21 demi-tons, donc le voicing tient
 * dans [48, 83] (3 octaves) et dans 2 octaves visibles.
 */
export function buildChordVoicing(rootPc, template, inversion = 0) {
  const degrees = template.voicing ?? template.intervals;
  let notes = degrees.map((interval) => ({ midi: rootPc + interval, interval }));

  for (let i = 0; i < inversion % degrees.length; i++) {
    const [lowest, ...rest] = notes;
    notes = [...rest, { ...lowest, midi: lowest.midi + 12 }].sort((a, b) => a.midi - b.midi);
  }

  // Ramène la basse dans l'octave la plus grave du clavier
  const bass = notes[0].midi;
  const shift = VOICING_LOWEST_NOTE + (((bass - VOICING_LOWEST_NOTE) % 12) + 12) % 12 - bass;
  return notes.map((n) => ({ ...n, midi: n.midi + shift }));
}

/** Nombre de positions (état fondamental + renversements) d'un accord. */
export const inversionCount = (template) => (template.voicing ?? template.intervals).length;

/** Données d'affichage (même forme que identifyChords) pour un voicing choisi. */
export function describeVoicing(rootPc, template, voicing, accidentals = DEFAULT_ACCIDENTALS) {
  const root = getRootNameEN(rootPc, accidentals);
  const bassPc = voicing[0].midi % 12;
  const isInversion = bassPc !== rootPc;
  const bassName = isInversion ? getRootNameEN(bassPc, accidentals) : null;

  return {
    rootPc,
    bassPc: isInversion ? bassPc : null,
    root,
    suffix: template.suffix,
    chordName: root + template.suffix + (isInversion ? "/" + bassName : ""),
    isInversion,
    bassName,
    noteIntervalPairs: voicing.map((n) => ({
      pc: n.midi % 12,
      interval: intervalLabel(n.interval),
    })),
  };
}
