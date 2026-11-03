// Gestion multilingue : tous les libellés de l'interface, les noms des types
// d'accords et les noms de notes, en français, anglais, allemand et espagnol.
// Les symboles d'accords (C, Dm7, F♯maj7…) sont en notation anglaise, sauf en
// allemand où la fondamentale et la basse suivent la convention H / B (voir rootName).

import { createContext, useContext } from "react";
import { DEFAULT_ACCIDENTALS, getRootNameEN } from "./chords.js"; // extension explicite : module importable tel quel depuis Node

/** Langues proposées, chacune nommée dans sa propre langue. */
export const LANGUAGES = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = "fr";

// ─────────────────────────────────────────────
// NOMS DE NOTES (tableau des notes, étiquettes du clavier)
// Index = demi-ton 0–11.
// ─────────────────────────────────────────────

const NOTE_NAMES = {
  fr: {
    sharp: ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"],
    flat:  ["Do", "Ré♭", "Ré", "Mi♭", "Mi", "Fa", "Sol♭", "Sol", "La♭", "La", "Si♭", "Si"],
  },
  en: {
    sharp: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"],
    flat:  ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"],
  },
  // Convention allemande : H = si naturel, B = si bémol
  de: {
    sharp: ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "H"],
    flat:  ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B", "H"],
  },
  es: {
    sharp: ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"],
    flat:  ["Do", "Re♭", "Re", "Mi♭", "Mi", "Fa", "Sol♭", "Sol", "La♭", "La", "Si♭", "Si"],
  },
};

// Numéro d'octave : le Do central (MIDI 60) est Do3 en français et en espagnol,
// C4 en anglais et en allemand.
const OCTAVE_OFFSET = { fr: -2, es: -2, en: -1, de: -1 };

// ─────────────────────────────────────────────
// LIBELLÉS
// ─────────────────────────────────────────────

const MESSAGES = {
  fr: {
    "tabs.aria": "Écran affiché",
    "tabs.piano": "Piano",
    "tabs.keyboard": "Clavier",
    "tabs.chords": "Accords",

    "midi.pending": "Connexion MIDI…",
    "midi.connected": "MIDI connecté",
    "midi.disconnected": "Aucun instrument MIDI",
    "midi.denied": "MIDI non disponible",

    "bt.connect": "Connexion Bluetooth MIDI",
    "bt.connectAria": "Connecter un instrument MIDI via Bluetooth",
    "bt.scanning": "Recherche…",
    "bt.connecting": "Connexion…",
    "bt.error": "Erreur de connexion Bluetooth.",
    "bt.unsupported": "Web Bluetooth n'est pas supporté par ce navigateur. Utilisez Chrome sur Android ou ordinateur.",

    "fallback.title": "Pas de piano sous la main ?",
    "fallback.keyboard": "Clavier virtuel",
    "fallback.dictionary": "Dictionnaire d'accords",

    "idle.play": "Jouez un accord…",
    "idle.touch": "Touchez le clavier…",

    "chord.unknown": "Accord non reconnu",
    "chord.alternatives": "Autres possibilités",

    "keyboard.hint": "Touchez les notes de l'accord",
    "keyboard.clear": "Effacer",
    "keyboard.invert": "Renverser ↻",

    "explorer.root": "Fondamentale",

    "settings.open": "Paramètres",
    "settings.title": "Paramètres",
    "settings.close": "Fermer",
    "settings.language": "Langue",
    "settings.accidentals": "Affichage des altérations",
    "settings.sharps": "Dièses",
    "settings.flats": "Bémols",
    "settings.sound": "Son",
    "settings.soundOn": "Son activé",
    "settings.soundOff": "Son coupé",
    "settings.version": "version",
  },

  en: {
    "tabs.aria": "Screen",
    "tabs.piano": "Piano",
    "tabs.keyboard": "Keyboard",
    "tabs.chords": "Chords",

    "midi.pending": "Connecting MIDI…",
    "midi.connected": "MIDI connected",
    "midi.disconnected": "No MIDI instrument",
    "midi.denied": "MIDI unavailable",

    "bt.connect": "Connect Bluetooth MIDI",
    "bt.connectAria": "Connect a MIDI instrument over Bluetooth",
    "bt.scanning": "Searching…",
    "bt.connecting": "Connecting…",
    "bt.error": "Bluetooth connection error.",
    "bt.unsupported": "This browser doesn't support Web Bluetooth. Use Chrome on Android or desktop.",

    "fallback.title": "No piano at hand?",
    "fallback.keyboard": "Virtual keyboard",
    "fallback.dictionary": "Chord dictionary",

    "idle.play": "Play a chord…",
    "idle.touch": "Tap the keyboard…",

    "chord.unknown": "Unrecognized chord",
    "chord.alternatives": "Other possibilities",

    "keyboard.hint": "Tap the notes of the chord",
    "keyboard.clear": "Clear",
    "keyboard.invert": "Invert ↻",

    "explorer.root": "Root",

    "settings.open": "Settings",
    "settings.title": "Settings",
    "settings.close": "Close",
    "settings.language": "Language",
    "settings.accidentals": "Accidentals display",
    "settings.sharps": "Sharps",
    "settings.flats": "Flats",
    "settings.sound": "Sound",
    "settings.soundOn": "Sound on",
    "settings.soundOff": "Sound off",
    "settings.version": "version",
  },

  de: {
    "tabs.aria": "Ansicht",
    "tabs.piano": "Klavier",
    "tabs.keyboard": "Tastatur",
    "tabs.chords": "Akkorde",

    "midi.pending": "MIDI-Verbindung…",
    "midi.connected": "MIDI verbunden",
    "midi.disconnected": "Kein MIDI-Instrument",
    "midi.denied": "MIDI nicht verfügbar",

    "bt.connect": "Bluetooth-MIDI verbinden",
    "bt.connectAria": "MIDI-Instrument über Bluetooth verbinden",
    "bt.scanning": "Suche…",
    "bt.connecting": "Verbinde…",
    "bt.error": "Bluetooth-Verbindungsfehler.",
    "bt.unsupported": "Dieser Browser unterstützt Web Bluetooth nicht. Verwende Chrome auf Android oder am Computer.",

    "fallback.title": "Kein Klavier zur Hand?",
    "fallback.keyboard": "Virtuelle Tastatur",
    "fallback.dictionary": "Akkordlexikon",

    "idle.play": "Spiel einen Akkord…",
    "idle.touch": "Tippe auf die Tastatur…",

    "chord.unknown": "Akkord nicht erkannt",
    "chord.alternatives": "Weitere Möglichkeiten",

    "keyboard.hint": "Tippe die Töne des Akkords an",
    "keyboard.clear": "Löschen",
    "keyboard.invert": "Umkehren ↻",

    "explorer.root": "Grundton",

    "settings.open": "Einstellungen",
    "settings.title": "Einstellungen",
    "settings.close": "Schließen",
    "settings.language": "Sprache",
    "settings.accidentals": "Anzeige der Vorzeichen",
    "settings.sharps": "Kreuze",
    "settings.flats": "Bes",
    "settings.sound": "Ton",
    "settings.soundOn": "Ton an",
    "settings.soundOff": "Ton aus",
    "settings.version": "Version",
  },

  es: {
    "tabs.aria": "Pantalla",
    "tabs.piano": "Piano",
    "tabs.keyboard": "Teclado",
    "tabs.chords": "Acordes",

    "midi.pending": "Conectando MIDI…",
    "midi.connected": "MIDI conectado",
    "midi.disconnected": "Ningún instrumento MIDI",
    "midi.denied": "MIDI no disponible",

    "bt.connect": "Conectar MIDI Bluetooth",
    "bt.connectAria": "Conectar un instrumento MIDI por Bluetooth",
    "bt.scanning": "Buscando…",
    "bt.connecting": "Conectando…",
    "bt.error": "Error de conexión Bluetooth.",
    "bt.unsupported": "Este navegador no es compatible con Web Bluetooth. Usa Chrome en Android o en el ordenador.",

    "fallback.title": "¿No tienes un piano a mano?",
    "fallback.keyboard": "Teclado virtual",
    "fallback.dictionary": "Diccionario de acordes",

    "idle.play": "Toca un acorde…",
    "idle.touch": "Toca el teclado…",

    "chord.unknown": "Acorde no reconocido",
    "chord.alternatives": "Otras posibilidades",

    "keyboard.hint": "Toca las notas del acorde",
    "keyboard.clear": "Borrar",
    "keyboard.invert": "Invertir ↻",

    "explorer.root": "Fundamental",

    "settings.open": "Ajustes",
    "settings.title": "Ajustes",
    "settings.close": "Cerrar",
    "settings.language": "Idioma",
    "settings.accidentals": "Visualización de alteraciones",
    "settings.sharps": "Sostenidos",
    "settings.flats": "Bemoles",
    "settings.sound": "Sonido",
    "settings.soundOn": "Sonido activado",
    "settings.soundOff": "Sonido desactivado",
    "settings.version": "versión",
  },
};

// Groupes de types d'accords (dictionnaire), indexés par `id` de groupe (src/chords.js)
const GROUP_NAMES = {
  fr: { triads: "Triades", sixths: "Sixtes", sevenths: "Septièmes", ninths: "Neuvièmes", elevenths: "Onzièmes", thirteenths: "Treizièmes" },
  en: { triads: "Triads", sixths: "Sixths", sevenths: "Sevenths", ninths: "Ninths", elevenths: "Elevenths", thirteenths: "Thirteenths" },
  de: { triads: "Dreiklänge", sixths: "Sextakkorde", sevenths: "Septakkorde", ninths: "Nonakkorde", elevenths: "Undezimakkorde", thirteenths: "Tredezimakkorde" },
  es: { triads: "Tríadas", sixths: "Sextas", sevenths: "Séptimas", ninths: "Novenas", elevenths: "Oncenas", thirteenths: "Trecenas" },
};

// Noms des types d'accords, indexés par `suffix` (src/chords.js)
const CHORD_TYPE_NAMES = {
  fr: {
    "": "Majeur", "m": "Mineur", "dim": "Diminué", "aug": "Augmenté",
    "sus2": "Suspendu 2", "sus4": "Suspendu 4", "5": "Quinte (power)",
    "6": "Sixte majeure", "m6": "Sixte mineure", "6/9": "Sixte/Neuvième",
    "maj7": "Septième majeure", "7": "Septième dominante", "m7": "Septième mineure",
    "mM7": "Septième mineure majeure", "dim7": "Septième diminuée", "m7♭5": "Demi-diminué",
    "aug7": "Septième augmentée", "7sus4": "Sept. sus4", "7♭5": "Sept. quinte bémol",
    "7♯5": "Sept. quinte augmentée",
    "maj9": "Neuvième majeure", "9": "Neuvième dominante", "m9": "Neuvième mineure",
    "add9": "Neuvième ajoutée", "madd9": "Neuvième mineure ajoutée",
    "11": "Onzième", "m11": "Onzième mineure", "maj11": "Onzième majeure",
    "13": "Treizième", "m13": "Treizième mineure", "maj13": "Treizième majeure",
  },
  en: {
    "": "Major", "m": "Minor", "dim": "Diminished", "aug": "Augmented",
    "sus2": "Suspended 2nd", "sus4": "Suspended 4th", "5": "Fifth (power chord)",
    "6": "Major 6th", "m6": "Minor 6th", "6/9": "Six-nine",
    "maj7": "Major 7th", "7": "Dominant 7th", "m7": "Minor 7th",
    "mM7": "Minor-major 7th", "dim7": "Diminished 7th", "m7♭5": "Half-diminished",
    "aug7": "Augmented 7th", "7sus4": "7th sus4", "7♭5": "7th flat 5",
    "7♯5": "7th sharp 5",
    "maj9": "Major 9th", "9": "Dominant 9th", "m9": "Minor 9th",
    "add9": "Added 9th", "madd9": "Minor added 9th",
    "11": "Dominant 11th", "m11": "Minor 11th", "maj11": "Major 11th",
    "13": "Dominant 13th", "m13": "Minor 13th", "maj13": "Major 13th",
  },
  de: {
    "": "Dur", "m": "Moll", "dim": "Vermindert", "aug": "Übermäßig",
    "sus2": "Sekundvorhalt", "sus4": "Quartvorhalt", "5": "Quinte (Powerchord)",
    "6": "Dur mit Sexte", "m6": "Moll mit Sexte", "6/9": "Sexte/None",
    "maj7": "Großer Septakkord", "7": "Dominantseptakkord", "m7": "Moll-Septakkord",
    "mM7": "Moll mit großer Septime", "dim7": "Verminderter Septakkord", "m7♭5": "Halbvermindert",
    "aug7": "Übermäßiger Septakkord", "7sus4": "Septakkord mit Quartvorhalt", "7♭5": "Septakkord, verminderte Quinte",
    "7♯5": "Septakkord, übermäßige Quinte",
    "maj9": "Großer Nonakkord", "9": "Dominantnonakkord", "m9": "Moll-Nonakkord",
    "add9": "Dur mit None", "madd9": "Moll mit None",
    "11": "Undezimakkord", "m11": "Moll-Undezimakkord", "maj11": "Großer Undezimakkord",
    "13": "Tredezimakkord", "m13": "Moll-Tredezimakkord", "maj13": "Großer Tredezimakkord",
  },
  es: {
    "": "Mayor", "m": "Menor", "dim": "Disminuido", "aug": "Aumentado",
    "sus2": "Suspendido 2", "sus4": "Suspendido 4", "5": "Quinta (power chord)",
    "6": "Sexta mayor", "m6": "Sexta menor", "6/9": "Sexta/novena",
    "maj7": "Séptima mayor", "7": "Séptima dominante", "m7": "Séptima menor",
    "mM7": "Menor con séptima mayor", "dim7": "Séptima disminuida", "m7♭5": "Semidisminuido",
    "aug7": "Séptima aumentada", "7sus4": "Séptima sus4", "7♭5": "Séptima, quinta disminuida",
    "7♯5": "Séptima, quinta aumentada",
    "maj9": "Novena mayor", "9": "Novena dominante", "m9": "Novena menor",
    "add9": "Novena añadida", "madd9": "Menor con novena añadida",
    "11": "Oncena", "m11": "Oncena menor", "maj11": "Oncena mayor",
    "13": "Trecena", "m13": "Trecena menor", "maj13": "Trecena mayor",
  },
};

// Position de l'accord dans le dictionnaire (0 = état fondamental)
const EN_ORDINALS = ["", "1st", "2nd", "3rd"];
const INVERSION_LABELS = {
  fr: (i) => (i === 0 ? "État fondamental" : i === 1 ? "1er renversement" : `${i}e renversement`),
  en: (i) => (i === 0 ? "Root position" : `${EN_ORDINALS[i] ?? `${i}th`} inversion`),
  de: (i) => (i === 0 ? "Grundstellung" : `${i}. Umkehrung`),
  es: (i) => (i === 0 ? "Estado fundamental" : `${i}.ª inversión`),
};

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

/**
 * Fonctions d'affichage pour une langue et un choix d'altérations.
 * Une clé absente dans une langue retombe sur le français.
 */
export function createI18n(language, accidentals) {
  const lang = MESSAGES[language] ? language : DEFAULT_LANGUAGE;
  const acc = accidentals === "flat" || accidentals === "sharp" ? accidentals : DEFAULT_ACCIDENTALS;
  const noteName = (pc) => NOTE_NAMES[lang][acc][pc % 12];

  return {
    language: lang,
    accidentals: acc,
    t: (key) => MESSAGES[lang][key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key,
    chordTypeName: (suffix) => CHORD_TYPE_NAMES[lang][suffix] ?? CHORD_TYPE_NAMES[DEFAULT_LANGUAGE][suffix] ?? suffix,
    groupName: (id) => GROUP_NAMES[lang][id] ?? id,
    inversionLabel: (i) => INVERSION_LABELS[lang](i),
    noteName,
    /** Nom de touche avec octave (ex. « Do3 », « C4 ») */
    keyLabel: (midi) => `${noteName(midi)}${Math.floor(midi / 12) + OCTAVE_OFFSET[lang]}`,
    /** Fondamentale / basse d'un symbole d'accord : notation anglaise, sauf en
     *  allemand (H = si, B = si bémol), pour rester cohérent avec le tableau des notes. */
    rootName: (pc) => (lang === "de" ? noteName(pc) : getRootNameEN(pc, acc)),
  };
}

export const I18nContext = createContext(createI18n(DEFAULT_LANGUAGE, DEFAULT_ACCIDENTALS));

/** Accès aux libellés et noms de notes de la langue choisie. */
export const useI18n = () => useContext(I18nContext);
