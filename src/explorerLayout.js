// Disposition des types d'accords dans le dictionnaire (« Accord → Notes »).
// Module sans React, vérifié par src/explorerLayout.test.js : chaque modèle de
// src/chords.js doit y figurer exactement une fois.

// Types d'accords en deux grilles de 6 colonnes alignées. Une case = un suffixe
// de CHORD_TEMPLATES, null = case vide ; chaque suffixe apparaît exactement une fois.
//
// 1) Qualité (lignes) × extension la plus haute (colonnes). "triad" s'affiche
//    « Triade », les nombres en ordinal (7e, 7th, 7., 7.ª). « add » / « m add » :
//    notes ajoutées ; « no3 » : accord de puissance (quinte sans tierce).
export const MATRIX_COLUMNS = ["triad", "6", "7", "9", "11", "13"];
export const MATRIX_ROWS = [
  { label: "M",     cells: ["",     "6",    "maj7",  "maj9",  "maj11", "maj13"] },
  { label: "add",   cells: [null,   "6/9",  null,    "add9",  "add11", null] },
  { label: "m",     cells: ["m",    "m6",   "m7",    "m9",    "m11",   "m13"] },
  { label: "m add", cells: [null,   "m6/9", null,    "madd9", null,    null] },
  { label: "mM",    cells: [null,   null,   "mM7",   "mM9",   null,    null] },
  { label: "dom",   cells: [null,   null,   "7",     "9",     "11",    "13"] },
  { label: "sus4",  cells: ["sus4", null,   "7sus4", "9sus4", null,    null] },
  { label: "sus2",  cells: ["sus2", null,   null,    null,    null,    null] },
  { label: "dim",   cells: ["dim",  null,   "dim7",  null,    null,    null] },
  { label: "aug",   cells: ["aug",  null,   "aug7",  null,    null,    null] },
  { label: "no3",   cells: ["5",    null,   null,    null,    null,    null] },
];
// 2) Altérés, repliés par défaut : accord de base (lignes) + altération (colonnes),
//    m7 + ♭5 = m7♭5, 7 + ♭5 = 7♭5, mM7 + ♭5 = dimM7…
export const ALTERED_COLUMNS = ["♭5", "♯5", "♭9", "♯9", "♯11", "♭13"];
export const ALTERED_ROWS = [
  { label: "7",    cells: ["7♭5",  "7♯5",    "7♭9",   "7♯9",   "7♯11",    "7♭13"] },
  { label: "7♯5",  cells: [null,   null,     "7♯5♭9", "7♯5♯9", null,      null] },
  { label: "maj7", cells: [null,   "maj7♯5", null,    null,    "maj7♯11", null] },
  { label: "m7",   cells: ["m7♭5", null,     null,    null,    null,      null] },
  { label: "mM7",  cells: ["dimM7", null,    null,    null,    null,      null] },
  { label: "13",   cells: [null,   null,     "13♭9",  null,    "13♯11",   null] },
];
