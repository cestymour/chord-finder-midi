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

// Index = semitone 0–11
const NOTE_NAMES = {
  sharp: {
    en: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"],
    fr: ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"],
  },
  flat: {
    en: ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"],
    fr: ["Do", "Ré♭", "Ré", "Mi♭", "Mi", "Fa", "Sol♭", "Sol", "La♭", "La", "Si♭", "Si"],
  },
};

// Black-key pitch classes: C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭ (virtual keyboard layout).
export const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

/** Nom anglais d'une note (fondamentale / basse des accords). */
export function getRootNameEN(semitone, accidentals) {
  return (NOTE_NAMES[accidentals] ?? NOTE_NAMES[DEFAULT_ACCIDENTALS]).en[semitone % 12];
}

/** Nom français d'une note (tableau des notes, étiquettes du clavier). */
export function getNoteNameFR(semitone, accidentals) {
  return (NOTE_NAMES[accidentals] ?? NOTE_NAMES[DEFAULT_ACCIDENTALS]).fr[semitone % 12];
}

// ─────────────────────────────────────────────
// CHORD DEFINITIONS
// `intervals`: semitones from root, sorted ascending, all within one octave.
//   ALL intervals must be present for a match (strict mode).
// `voicing` (optional): how the chord is laid out on the keyboard in the
//   chord explorer (extensions above the octave: 9 → 14, 11 → 17, 13 → 21).
//   Its pitch classes must equal `intervals`. Defaults to `intervals`.
// ─────────────────────────────────────────────

export const CHORD_TEMPLATE_GROUPS = [
  {
    label: "Triades",
    templates: [
      { suffix: "",      intervals: [0, 4, 7],              label: "Majeur" },
      { suffix: "m",     intervals: [0, 3, 7],              label: "Mineur" },
      { suffix: "dim",   intervals: [0, 3, 6],              label: "Diminué" },
      { suffix: "aug",   intervals: [0, 4, 8],              label: "Augmenté" },
      { suffix: "sus2",  intervals: [0, 2, 7],              label: "Suspendu 2" },
      { suffix: "sus4",  intervals: [0, 5, 7],              label: "Suspendu 4" },
      { suffix: "5",     intervals: [0, 7],                 label: "Quinte (power)" },
    ],
  },
  {
    label: "Sixtes",
    templates: [
      { suffix: "6",     intervals: [0, 4, 7, 9],           label: "Sixte majeure" },
      { suffix: "m6",    intervals: [0, 3, 7, 9],           label: "Sixte mineure" },
      { suffix: "6/9",   intervals: [0, 2, 4, 7, 9],        label: "Sixte/Neuvième",
        voicing: [0, 4, 7, 9, 14] },
    ],
  },
  {
    label: "Septièmes",
    templates: [
      { suffix: "maj7",  intervals: [0, 4, 7, 11],          label: "Septième majeure" },
      { suffix: "7",     intervals: [0, 4, 7, 10],          label: "Septième dominante" },
      { suffix: "m7",    intervals: [0, 3, 7, 10],          label: "Septième mineure" },
      { suffix: "mM7",   intervals: [0, 3, 7, 11],          label: "Septième mineure majeure" },
      { suffix: "dim7",  intervals: [0, 3, 6, 9],           label: "Septième diminuée" },
      { suffix: "m7♭5",  intervals: [0, 3, 6, 10],          label: "Demi-diminué" },
      { suffix: "aug7",  intervals: [0, 4, 8, 10],          label: "Septième augmentée" },
      { suffix: "7sus4", intervals: [0, 5, 7, 10],          label: "Sept. sus4" },
      { suffix: "7♭5",   intervals: [0, 4, 6, 10],          label: "Sept. quinte bémol" },
      { suffix: "7♯5",   intervals: [0, 4, 8, 10],          label: "Sept. quinte augmentée" },
    ],
  },
  {
    label: "Neuvièmes",
    templates: [
      { suffix: "maj9",  intervals: [0, 2, 4, 7, 11],       label: "Neuvième majeure",
        voicing: [0, 4, 7, 11, 14] },
      { suffix: "9",     intervals: [0, 2, 4, 7, 10],       label: "Neuvième dominante",
        voicing: [0, 4, 7, 10, 14] },
      { suffix: "m9",    intervals: [0, 2, 3, 7, 10],       label: "Neuvième mineure",
        voicing: [0, 3, 7, 10, 14] },
      { suffix: "add9",  intervals: [0, 2, 4, 7],           label: "Neuvième ajouté",
        voicing: [0, 4, 7, 14] },
      { suffix: "madd9", intervals: [0, 2, 3, 7],           label: "Neuvième mineure ajoutée",
        voicing: [0, 3, 7, 14] },
    ],
  },
  {
    label: "Onzièmes",
    templates: [
      { suffix: "11",    intervals: [0, 2, 4, 5, 7, 10],    label: "Onzième",
        voicing: [0, 4, 7, 10, 14, 17] },
      { suffix: "m11",   intervals: [0, 2, 3, 5, 7, 10],    label: "Onzième mineure",
        voicing: [0, 3, 7, 10, 14, 17] },
      { suffix: "maj11", intervals: [0, 2, 4, 5, 7, 11],    label: "Onzième majeure",
        voicing: [0, 4, 7, 11, 14, 17] },
    ],
  },
  {
    label: "Treizièmes",
    templates: [
      { suffix: "13",    intervals: [0, 2, 4, 5, 7, 9, 10], label: "Treizième",
        voicing: [0, 4, 7, 10, 14, 17, 21] },
      { suffix: "m13",   intervals: [0, 2, 3, 5, 7, 9, 10], label: "Treizième mineure",
        voicing: [0, 3, 7, 10, 14, 17, 21] },
      { suffix: "maj13", intervals: [0, 2, 4, 5, 7, 9, 11], label: "Treizième majeure",
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
 * `accidentals` : "sharp" | "flat" (noms des notes et des accords).
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
            note: getNoteNameFR(pc, accidentals),
            interval: INTERVAL_LABEL[interval] ?? `+${interval}`,
          };
        });

      results.push({
        root: getRootNameEN(rootPc, accidentals),
        suffix: template.suffix,
        label: template.label,
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
export function buildPendingNotePairs(midiNotes, accidentals = DEFAULT_ACCIDENTALS) {
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
      note: getNoteNameFR(n % 12, accidentals),
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
    root,
    suffix: template.suffix,
    label: template.label,
    chordName: root + template.suffix + (isInversion ? "/" + bassName : ""),
    isInversion,
    bassName,
    noteIntervalPairs: voicing.map((n) => ({
      note: getNoteNameFR(n.midi % 12, accidentals),
      interval: intervalLabel(n.interval),
    })),
  };
}
