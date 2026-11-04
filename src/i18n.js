// Gestion multilingue : tous les libellés de l'interface, les noms des types
// d'accords et les noms de notes, en français, anglais, allemand et espagnol.
// Les symboles d'accords (C, Dm7, F♯maj7…) sont en notation anglaise, sauf en
// allemand où la fondamentale et la basse suivent la convention H / B (voir rootName).

import { createContext, useContext } from "react";
import { ACCIDENTAL_SYMBOLS, DEFAULT_ACCIDENTALS, spellPc } from "./chords.js"; // extension explicite : module importable tel quel depuis Node

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
// Une note est un objet { letter, alter } (voir src/chords.js) :
// lettre (0–6 = Do Ré Mi Fa Sol La Si) + altération (𝄫 ♭ ♯ 𝄪).
// ─────────────────────────────────────────────

const LETTER_NAMES = {
  fr: ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"],
  en: ["C", "D", "E", "F", "G", "A", "B"],
  // Convention allemande : H = si naturel, B = si bémol (voir formatNote)
  de: ["C", "D", "E", "F", "G", "A", "H"],
  es: ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"],
};

const LETTER_B = 6;

/** Nom d'une note orthographiée dans une langue (« Mi♭ », « E♭ », « B » allemand…). */
function formatNote(note, letters) {
  if (letters === LETTER_NAMES.de && note.letter === LETTER_B && note.alter === -1) return "B";
  return letters[note.letter] + ACCIDENTAL_SYMBOLS[note.alter + 2];
}

// Numéro d'octave : le Do central (MIDI 60) est Do3 en français et en espagnol,
// C4 en anglais et en allemand.
const OCTAVE_OFFSET = { fr: -2, es: -2, en: -1, de: -1 };

// ─────────────────────────────────────────────
// LIBELLÉS
// ─────────────────────────────────────────────

const MESSAGES = {
  fr: {
    "tabs.aria": "Écran affiché",
    "tabs.notesToChord": "Notes → Accord",
    "tabs.notesToChord.aria": "Trouver l'accord à partir des notes",
    "tabs.chordToNotes": "Accord → Notes",
    "tabs.chordToNotes.aria": "Voir les notes d'un accord",

    "midi.pending": "Connexion…",
    "midi.disconnected": "Aucun piano connecté",
    "midi.denied": "MIDI non autorisé",
    "midi.unsupported": "MIDI non disponible",
    "status.connect": "Connecter un piano",
    "status.virtual": "Clavier virtuel",

    "connect.title": "Connectez votre piano",

    "bt.connect": "Connexion Bluetooth MIDI",
    "bt.connectAria": "Connecter un instrument MIDI via Bluetooth",
    "bt.scanning": "Recherche…",
    "bt.connecting": "Connexion…",
    "bt.reconnecting": "Reconnexion…",
    "bt.reconnect": "Reconnecter",
    "bt.other": "Connecter un autre piano",
    "bt.disconnect": "Déconnecter",
    "bt.piano": "Piano Bluetooth",
    "bt.statusReconnecting": "Connexion perdue · reconnexion…",
    "bt.lost": "Connexion perdue",
    "bt.lost.help": "La connexion avec le piano a été perdue. Vérifiez qu'il est allumé et à portée, puis reconnectez-le.",
    "bt.error.cancelled": "Votre piano n'apparaît pas ?",
    "bt.error.cancelled.help": "Vérifiez que son Bluetooth est allumé et qu'il n'est pas déjà connecté à un autre appareil ou à une autre application.",
    "bt.error.adapterOff": "Bluetooth désactivé",
    "bt.error.adapterOff.help": "Le Bluetooth de cet appareil est désactivé. Activez-le, puis réessayez.",
    "bt.error.denied": "Accès au Bluetooth refusé",
    "bt.error.denied.help": "L'accès au Bluetooth a été refusé. Autorisez-le dans les paramètres du site (icône à gauche de l'adresse), puis réessayez.",
    "bt.error.failed": "Connexion impossible",
    "bt.error.failed.help": "Impossible de se connecter au piano. S'il est déjà connecté à un autre appareil ou à une autre application, déconnectez-le, puis réessayez.",
    "bt.unsupported": "Bluetooth non disponible",
    "bt.unsupported.help": "Web Bluetooth n'est pas supporté par ce navigateur. Utilisez Chrome sur Android ou ordinateur.",

    "usb.title": "Câble USB",
    "usb.hint": "Branchez le piano en USB : il est détecté tout seul. Sur un téléphone, il faut un adaptateur USB OTG.",
    "usb.denied": "L'accès aux appareils MIDI a été refusé. Pour utiliser un câble USB, autorisez-le dans les paramètres du site (icône à gauche de l'adresse).",
    "usb.unsupported": "Ce navigateur ne gère pas le MIDI par câble. Utilisez Chrome ou Edge (l'iPhone et l'iPad ne le permettent pas).",
    "usb.prompt": "Branchez le piano en USB, puis touchez « Autoriser le câble USB » et acceptez l'accès aux appareils MIDI. Ce choix est retenu pour les fois suivantes. Sur un téléphone, il faut un adaptateur USB OTG.",
    "usb.allow": "Autoriser le câble USB",

    "fallback.title": "Pas de piano sous la main ?",
    "fallback.keyboard": "Clavier virtuel",

    "idle.play": "Jouez un accord…",
    "idle.touch": "Touchez le clavier…",

    "chord.unknown": "Accord non reconnu",
    "chord.alternatives": "Autres possibilités",

    "keyboard.hint": "Touchez les notes de l'accord",
    "keyboard.clear": "Effacer",
    "keyboard.invert": "Renverser ↻",

    "explorer.root": "Fondamentale",
    "explorer.triad": "Triade",
    "explorer.nth": "{n}e",
    "explorer.altered": "Altérés",

    "info.more": "Plus d'informations",

    "settings.open": "Paramètres",
    "settings.title": "Paramètres",
    "settings.close": "Fermer",
    "settings.language": "Langue",
    "settings.accidentals": "Affichage des altérations",
    "settings.accidentalsHint": "Ce choix donne le nom des accords : avec les dièses, toujours C♯ D♯ F♯ G♯ A♯ ; avec les bémols, toujours D♭ E♭ G♭ A♭ B♭ (basse comprise : E/A♭, D♯/G). Il sert aussi pour les touches hors accord. Dans le tableau, chaque note garde son nom exact à partir de la fondamentale : la tierce de D♯ est Fa𝄪, celle de G♭m est Si𝄫.",
    "settings.sharps": "Dièses",
    "settings.flats": "Bémols",
    "settings.sound": "Son",
    "settings.incomplete": "Accords incomplets",
    "settings.incompleteHint": "Reconnaître un accord joué sans ses notes facultatives, comme la quinte : Do Mi Si♭ donne C7.",
    "settings.version": "version",
    "settings.license": "Licence MIT",
    "settings.source": "Code source sur GitHub",
  },

  en: {
    "tabs.aria": "Screen",
    "tabs.notesToChord": "Notes → Chord",
    "tabs.notesToChord.aria": "Find the chord from the notes",
    "tabs.chordToNotes": "Chord → Notes",
    "tabs.chordToNotes.aria": "See the notes of a chord",

    "midi.pending": "Connecting…",
    "midi.disconnected": "No piano connected",
    "midi.denied": "MIDI not allowed",
    "midi.unsupported": "MIDI unavailable",
    "status.connect": "Connect a piano",
    "status.virtual": "Virtual keyboard",

    "connect.title": "Connect your piano",

    "bt.connect": "Connect Bluetooth MIDI",
    "bt.connectAria": "Connect a MIDI instrument over Bluetooth",
    "bt.scanning": "Searching…",
    "bt.connecting": "Connecting…",
    "bt.reconnecting": "Reconnecting…",
    "bt.reconnect": "Reconnect",
    "bt.other": "Connect another piano",
    "bt.disconnect": "Disconnect",
    "bt.piano": "Bluetooth piano",
    "bt.statusReconnecting": "Connection lost · reconnecting…",
    "bt.lost": "Connection lost",
    "bt.lost.help": "The connection to the piano was lost. Check that it is on and within range, then reconnect it.",
    "bt.error.cancelled": "Piano not in the list?",
    "bt.error.cancelled.help": "Check that its Bluetooth is on and that it isn't already connected to another device or app.",
    "bt.error.adapterOff": "Bluetooth is off",
    "bt.error.adapterOff.help": "Bluetooth is turned off on this device. Turn it on, then try again.",
    "bt.error.denied": "Bluetooth access denied",
    "bt.error.denied.help": "Bluetooth access was denied. Allow it in the site settings (icon left of the address), then try again.",
    "bt.error.failed": "Couldn't connect",
    "bt.error.failed.help": "Couldn't connect to the piano. If it is already connected to another device or app, disconnect it, then try again.",
    "bt.unsupported": "Bluetooth unavailable",
    "bt.unsupported.help": "This browser doesn't support Web Bluetooth. Use Chrome on Android or desktop.",

    "usb.title": "USB cable",
    "usb.hint": "Plug the piano in over USB: it is detected automatically. On a phone, you need a USB OTG adapter.",
    "usb.denied": "Access to MIDI devices was denied. To use a USB cable, allow it in the site settings (icon left of the address).",
    "usb.unsupported": "This browser doesn't support wired MIDI. Use Chrome or Edge (iPhone and iPad don't allow it).",
    "usb.prompt": "Plug the piano in over USB, then tap “Allow USB cable” and accept access to MIDI devices. Your choice is remembered next time. On a phone, you need a USB OTG adapter.",
    "usb.allow": "Allow USB cable",

    "fallback.title": "No piano at hand?",
    "fallback.keyboard": "Virtual keyboard",

    "idle.play": "Play a chord…",
    "idle.touch": "Tap the keyboard…",

    "chord.unknown": "Unrecognized chord",
    "chord.alternatives": "Other possibilities",

    "keyboard.hint": "Tap the notes of the chord",
    "keyboard.clear": "Clear",
    "keyboard.invert": "Invert ↻",

    "explorer.root": "Root",
    "explorer.triad": "Triad",
    "explorer.nth": "{n}th",
    "explorer.altered": "Altered",

    "info.more": "More information",

    "settings.open": "Settings",
    "settings.title": "Settings",
    "settings.close": "Close",
    "settings.language": "Language",
    "settings.accidentals": "Accidentals display",
    "settings.accidentalsHint": "This choice sets chord names: with sharps, always C♯ D♯ F♯ G♯ A♯; with flats, always D♭ E♭ G♭ A♭ B♭ (bass included: E/A♭, D♯/G). It also applies to keys outside a chord. In the table, each note keeps its exact name from the root: the third of D♯ is F𝄪, the third of G♭m is B𝄫.",
    "settings.sharps": "Sharps",
    "settings.flats": "Flats",
    "settings.sound": "Sound",
    "settings.incomplete": "Incomplete chords",
    "settings.incompleteHint": "Recognize a chord played without its optional notes, such as the fifth: C E B♭ gives C7.",
    "settings.version": "version",
    "settings.license": "MIT License",
    "settings.source": "Source code on GitHub",
  },

  de: {
    "tabs.aria": "Ansicht",
    "tabs.notesToChord": "Noten → Akkord",
    "tabs.notesToChord.aria": "Akkord aus den Noten bestimmen",
    "tabs.chordToNotes": "Akkord → Noten",
    "tabs.chordToNotes.aria": "Noten eines Akkords anzeigen",

    "midi.pending": "Verbinde…",
    "midi.disconnected": "Kein Klavier verbunden",
    "midi.denied": "MIDI nicht erlaubt",
    "midi.unsupported": "MIDI nicht verfügbar",
    "status.connect": "Klavier verbinden",
    "status.virtual": "Virtuelle Tastatur",

    "connect.title": "Verbinde dein Klavier",

    "bt.connect": "Bluetooth-MIDI verbinden",
    "bt.connectAria": "MIDI-Instrument über Bluetooth verbinden",
    "bt.scanning": "Suche…",
    "bt.connecting": "Verbinde…",
    "bt.reconnecting": "Neu verbinden…",
    "bt.reconnect": "Neu verbinden",
    "bt.other": "Anderes Klavier verbinden",
    "bt.disconnect": "Trennen",
    "bt.piano": "Bluetooth-Klavier",
    "bt.statusReconnecting": "Verbindung verloren · neu verbinden…",
    "bt.lost": "Verbindung abgebrochen",
    "bt.lost.help": "Die Verbindung zum Klavier ist abgebrochen. Prüfe, ob es eingeschaltet und in Reichweite ist, und verbinde es neu.",
    "bt.error.cancelled": "Klavier nicht in der Liste?",
    "bt.error.cancelled.help": "Prüfe, ob sein Bluetooth eingeschaltet ist und ob es nicht schon mit einem anderen Gerät oder einer anderen App verbunden ist.",
    "bt.error.adapterOff": "Bluetooth ausgeschaltet",
    "bt.error.adapterOff.help": "Bluetooth ist auf diesem Gerät ausgeschaltet. Schalte es ein und versuche es erneut.",
    "bt.error.denied": "Bluetooth-Zugriff verweigert",
    "bt.error.denied.help": "Der Bluetooth-Zugriff wurde verweigert. Erlaube ihn in den Website-Einstellungen (Symbol links neben der Adresse) und versuche es erneut.",
    "bt.error.failed": "Verbindung nicht möglich",
    "bt.error.failed.help": "Verbindung zum Klavier nicht möglich. Wenn es schon mit einem anderen Gerät oder einer anderen App verbunden ist, trenne es und versuche es erneut.",
    "bt.unsupported": "Bluetooth nicht verfügbar",
    "bt.unsupported.help": "Dieser Browser unterstützt Web Bluetooth nicht. Verwende Chrome auf Android oder am Computer.",

    "usb.title": "USB-Kabel",
    "usb.hint": "Schließe das Klavier per USB an: Es wird automatisch erkannt. Am Handy brauchst du einen USB-OTG-Adapter.",
    "usb.denied": "Der Zugriff auf MIDI-Geräte wurde verweigert. Um ein USB-Kabel zu nutzen, erlaube ihn in den Website-Einstellungen (Symbol links neben der Adresse).",
    "usb.unsupported": "Dieser Browser unterstützt kein MIDI per Kabel. Verwende Chrome oder Edge (auf iPhone und iPad nicht möglich).",
    "usb.prompt": "Schließe das Klavier per USB an, tippe dann auf „USB-Kabel erlauben“ und erlaube den Zugriff auf MIDI-Geräte. Die Wahl wird für das nächste Mal gespeichert. Am Handy brauchst du einen USB-OTG-Adapter.",
    "usb.allow": "USB-Kabel erlauben",

    "fallback.title": "Kein Klavier zur Hand?",
    "fallback.keyboard": "Virtuelle Tastatur",

    "idle.play": "Spiel einen Akkord…",
    "idle.touch": "Tippe auf die Tastatur…",

    "chord.unknown": "Akkord nicht erkannt",
    "chord.alternatives": "Weitere Möglichkeiten",

    "keyboard.hint": "Tippe die Töne des Akkords an",
    "keyboard.clear": "Löschen",
    "keyboard.invert": "Umkehren ↻",

    "explorer.root": "Grundton",
    "explorer.triad": "Dreikl.",
    "explorer.nth": "{n}.",
    "explorer.altered": "Alteriert",

    "info.more": "Mehr Informationen",

    "settings.open": "Einstellungen",
    "settings.title": "Einstellungen",
    "settings.close": "Schließen",
    "settings.language": "Sprache",
    "settings.accidentals": "Anzeige der Vorzeichen",
    "settings.accidentalsHint": "Diese Wahl bestimmt die Akkordnamen: mit Kreuzen immer C♯ D♯ F♯ G♯ A♯, mit Bes immer D♭ E♭ G♭ A♭ B (Bass inbegriffen: E/A♭, D♯/G). Sie gilt auch für Tasten außerhalb eines Akkords. In der Tabelle behält jeder Ton seinen genauen Namen ab dem Grundton: Die Terz von D♯ ist F𝄪, die von G♭m ist H𝄫.",
    "settings.sharps": "Kreuze",
    "settings.flats": "Bes",
    "settings.sound": "Ton",
    "settings.incomplete": "Unvollständige Akkorde",
    "settings.incompleteHint": "Einen Akkord auch ohne seine optionalen Töne erkennen, etwa ohne Quinte: C E B ergibt C7.",
    "settings.version": "Version",
    "settings.license": "MIT-Lizenz",
    "settings.source": "Quellcode auf GitHub",
  },

  es: {
    "tabs.aria": "Pantalla",
    "tabs.notesToChord": "Notas → Acorde",
    "tabs.notesToChord.aria": "Encontrar el acorde a partir de las notas",
    "tabs.chordToNotes": "Acorde → Notas",
    "tabs.chordToNotes.aria": "Ver las notas de un acorde",

    "midi.pending": "Conectando…",
    "midi.disconnected": "Ningún piano conectado",
    "midi.denied": "MIDI no autorizado",
    "midi.unsupported": "MIDI no disponible",
    "status.connect": "Conectar un piano",
    "status.virtual": "Teclado virtual",

    "connect.title": "Conecta tu piano",

    "bt.connect": "Conectar MIDI Bluetooth",
    "bt.connectAria": "Conectar un instrumento MIDI por Bluetooth",
    "bt.scanning": "Buscando…",
    "bt.connecting": "Conectando…",
    "bt.reconnecting": "Reconectando…",
    "bt.reconnect": "Reconectar",
    "bt.other": "Conectar otro piano",
    "bt.disconnect": "Desconectar",
    "bt.piano": "Piano Bluetooth",
    "bt.statusReconnecting": "Conexión perdida · reconectando…",
    "bt.lost": "Conexión perdida",
    "bt.lost.help": "Se perdió la conexión con el piano. Comprueba que está encendido y al alcance, y vuelve a conectarlo.",
    "bt.error.cancelled": "¿Tu piano no aparece?",
    "bt.error.cancelled.help": "Comprueba que su Bluetooth está activado y que no está ya conectado a otro dispositivo o a otra aplicación.",
    "bt.error.adapterOff": "Bluetooth desactivado",
    "bt.error.adapterOff.help": "El Bluetooth de este dispositivo está desactivado. Actívalo y vuelve a intentarlo.",
    "bt.error.denied": "Acceso al Bluetooth denegado",
    "bt.error.denied.help": "Se denegó el acceso al Bluetooth. Permítelo en la configuración del sitio (icono a la izquierda de la dirección) y vuelve a intentarlo.",
    "bt.error.failed": "No se pudo conectar",
    "bt.error.failed.help": "No se pudo conectar con el piano. Si ya está conectado a otro dispositivo o a otra aplicación, desconéctalo y vuelve a intentarlo.",
    "bt.unsupported": "Bluetooth no disponible",
    "bt.unsupported.help": "Este navegador no es compatible con Web Bluetooth. Usa Chrome en Android o en el ordenador.",

    "usb.title": "Cable USB",
    "usb.hint": "Conecta el piano por USB: se detecta automáticamente. En un teléfono necesitas un adaptador USB OTG.",
    "usb.denied": "Se denegó el acceso a los dispositivos MIDI. Para usar un cable USB, permítelo en la configuración del sitio (icono a la izquierda de la dirección).",
    "usb.unsupported": "Este navegador no admite MIDI por cable. Usa Chrome o Edge (el iPhone y el iPad no lo permiten).",
    "usb.prompt": "Conecta el piano por USB, toca «Permitir cable USB» y acepta el acceso a los dispositivos MIDI. La elección se recuerda para la próxima vez. En un teléfono necesitas un adaptador USB OTG.",
    "usb.allow": "Permitir cable USB",

    "fallback.title": "¿No tienes un piano a mano?",
    "fallback.keyboard": "Teclado virtual",

    "idle.play": "Toca un acorde…",
    "idle.touch": "Toca el teclado…",

    "chord.unknown": "Acorde no reconocido",
    "chord.alternatives": "Otras posibilidades",

    "keyboard.hint": "Toca las notas del acorde",
    "keyboard.clear": "Borrar",
    "keyboard.invert": "Invertir ↻",

    "explorer.root": "Fundamental",
    "explorer.triad": "Tríada",
    "explorer.nth": "{n}.ª",
    "explorer.altered": "Alterados",

    "info.more": "Más información",

    "settings.open": "Ajustes",
    "settings.title": "Ajustes",
    "settings.close": "Cerrar",
    "settings.language": "Idioma",
    "settings.accidentals": "Visualización de alteraciones",
    "settings.accidentalsHint": "Esta opción da el nombre de los acordes: con sostenidos, siempre C♯ D♯ F♯ G♯ A♯; con bemoles, siempre D♭ E♭ G♭ A♭ B♭ (bajo incluido: E/A♭, D♯/G). También sirve para las teclas fuera de un acorde. En la tabla, cada nota conserva su nombre exacto a partir de la fundamental: la tercera de D♯ es Fa𝄪, la de G♭m es Si𝄫.",
    "settings.sharps": "Sostenidos",
    "settings.flats": "Bemoles",
    "settings.sound": "Sonido",
    "settings.incomplete": "Acordes incompletos",
    "settings.incompleteHint": "Reconocer un acorde tocado sin sus notas opcionales, como la quinta: Do Mi Si♭ da C7.",
    "settings.version": "versión",
    "settings.license": "Licencia MIT",
    "settings.source": "Código fuente en GitHub",
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
    "6": "Sixte majeure", "m6": "Mineur sixte", "6/9": "Sixte/Neuvième", "m6/9": "Mineur sixte/neuvième",
    "maj7": "Septième majeure", "7": "Septième dominante", "m7": "Septième mineure",
    "mM7": "Septième mineure majeure", "dim7": "Septième diminuée", "m7♭5": "Demi-diminué",
    "aug7": "Septième augmentée", "7sus4": "Sept. sus4", "7♭5": "Sept. quinte bémol",
    "7♯5": "Sept. quinte augmentée", "maj7♯5": "Sept. majeure quinte augmentée",
    "dimM7": "Diminué septième majeure",
    "maj9": "Neuvième majeure", "9": "Neuvième dominante", "m9": "Neuvième mineure",
    "add9": "Neuvième ajoutée", "madd9": "Neuvième mineure ajoutée",
    "mM9": "Neuvième mineure majeure", "9sus4": "Neuvième sus4",
    "7♭9": "Sept. neuvième bémol", "7♯9": "Sept. neuvième augmentée",
    "7♯5♭9": "Sept. quinte augmentée neuvième bémol", "7♯5♯9": "Sept. quinte et neuvième augmentées",
    "11": "Onzième", "m11": "Onzième mineure", "maj11": "Onzième majeure",
    "add11": "Onzième ajoutée", "7♯11": "Sept. onzième augmentée", "maj7♯11": "Sept. majeure onzième augmentée",
    "13": "Treizième", "m13": "Treizième mineure", "maj13": "Treizième majeure",
    "13♯11": "Treizième onzième augmentée", "13♭9": "Treizième neuvième bémol", "7♭13": "Sept. treizième bémol",
  },
  en: {
    "": "Major", "m": "Minor", "dim": "Diminished", "aug": "Augmented",
    "sus2": "Suspended 2nd", "sus4": "Suspended 4th", "5": "Fifth (power chord)",
    "6": "Major 6th", "m6": "Minor 6th", "6/9": "Six-nine", "m6/9": "Minor six-nine",
    "maj7": "Major 7th", "7": "Dominant 7th", "m7": "Minor 7th",
    "mM7": "Minor-major 7th", "dim7": "Diminished 7th", "m7♭5": "Half-diminished",
    "aug7": "Augmented 7th", "7sus4": "7th sus4", "7♭5": "7th flat 5",
    "7♯5": "7th sharp 5", "maj7♯5": "Major 7th sharp 5", "dimM7": "Diminished major 7th",
    "maj9": "Major 9th", "9": "Dominant 9th", "m9": "Minor 9th",
    "add9": "Added 9th", "madd9": "Minor added 9th",
    "mM9": "Minor-major 9th", "9sus4": "9th sus4",
    "7♭9": "7th flat 9", "7♯9": "7th sharp 9", "7♯5♭9": "7th sharp 5 flat 9", "7♯5♯9": "7th sharp 5 sharp 9",
    "11": "Dominant 11th", "m11": "Minor 11th", "maj11": "Major 11th",
    "add11": "Added 11th", "7♯11": "7th sharp 11", "maj7♯11": "Major 7th sharp 11",
    "13": "Dominant 13th", "m13": "Minor 13th", "maj13": "Major 13th",
    "13♯11": "13th sharp 11", "13♭9": "13th flat 9", "7♭13": "7th flat 13",
  },
  de: {
    "": "Dur", "m": "Moll", "dim": "Vermindert", "aug": "Übermäßig",
    "sus2": "Sekundvorhalt", "sus4": "Quartvorhalt", "5": "Quinte (Powerchord)",
    "6": "Dur mit Sexte", "m6": "Moll mit Sexte", "6/9": "Sexte/None", "m6/9": "Moll mit Sexte/None",
    "maj7": "Großer Septakkord", "7": "Dominantseptakkord", "m7": "Moll-Septakkord",
    "mM7": "Moll mit großer Septime", "dim7": "Verminderter Septakkord", "m7♭5": "Halbvermindert",
    "aug7": "Übermäßiger Septakkord", "7sus4": "Septakkord mit Quartvorhalt", "7♭5": "Septakkord, verminderte Quinte",
    "7♯5": "Septakkord, übermäßige Quinte", "maj7♯5": "Großer Septakkord, übermäßige Quinte",
    "dimM7": "Vermindert mit großer Septime",
    "maj9": "Großer Nonakkord", "9": "Dominantnonakkord", "m9": "Moll-Nonakkord",
    "add9": "Dur mit None", "madd9": "Moll mit None",
    "mM9": "Moll-Nonakkord mit großer Septime", "9sus4": "Nonakkord mit Quartvorhalt",
    "7♭9": "Septakkord, kleine None", "7♯9": "Septakkord, übermäßige None",
    "7♯5♭9": "Septakkord, übermäßige Quinte, kleine None", "7♯5♯9": "Septakkord, übermäßige Quinte und None",
    "11": "Undezimakkord", "m11": "Moll-Undezimakkord", "maj11": "Großer Undezimakkord",
    "add11": "Dur mit Undezime", "7♯11": "Septakkord, übermäßige Undezime",
    "maj7♯11": "Großer Septakkord, übermäßige Undezime",
    "13": "Tredezimakkord", "m13": "Moll-Tredezimakkord", "maj13": "Großer Tredezimakkord",
    "13♯11": "Tredezimakkord, übermäßige Undezime", "13♭9": "Tredezimakkord, kleine None",
    "7♭13": "Septakkord, kleine Tredezime",
  },
  es: {
    "": "Mayor", "m": "Menor", "dim": "Disminuido", "aug": "Aumentado",
    "sus2": "Suspendido 2", "sus4": "Suspendido 4", "5": "Quinta (power chord)",
    "6": "Sexta mayor", "m6": "Menor con sexta", "6/9": "Sexta/novena", "m6/9": "Menor con sexta/novena",
    "maj7": "Séptima mayor", "7": "Séptima dominante", "m7": "Séptima menor",
    "mM7": "Menor con séptima mayor", "dim7": "Séptima disminuida", "m7♭5": "Semidisminuido",
    "aug7": "Séptima aumentada", "7sus4": "Séptima sus4", "7♭5": "Séptima, quinta disminuida",
    "7♯5": "Séptima, quinta aumentada", "maj7♯5": "Séptima mayor, quinta aumentada",
    "dimM7": "Disminuido con séptima mayor",
    "maj9": "Novena mayor", "9": "Novena dominante", "m9": "Novena menor",
    "add9": "Novena añadida", "madd9": "Menor con novena añadida",
    "mM9": "Novena menor con séptima mayor", "9sus4": "Novena sus4",
    "7♭9": "Séptima, novena menor", "7♯9": "Séptima, novena aumentada",
    "7♯5♭9": "Séptima, quinta aumentada, novena menor", "7♯5♯9": "Séptima, quinta y novena aumentadas",
    "11": "Oncena", "m11": "Oncena menor", "maj11": "Oncena mayor",
    "add11": "Oncena añadida", "7♯11": "Séptima, oncena aumentada", "maj7♯11": "Séptima mayor, oncena aumentada",
    "13": "Trecena", "m13": "Trecena menor", "maj13": "Trecena mayor",
    "13♯11": "Trecena, oncena aumentada", "13♭9": "Trecena, novena menor", "7♭13": "Séptima, trecena menor",
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
  /** Nom d'une note orthographiée ({ letter, alter }) dans la langue choisie. */
  const noteName = (note) => formatNote(note, LETTER_NAMES[lang]);
  /** Nom d'une touche hors accord : dièse ou bémol selon le réglage. */
  const pcName = (pc) => noteName(spellPc(pc, acc));

  return {
    language: lang,
    accidentals: acc,
    t: (key) => MESSAGES[lang][key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key,
    chordTypeName: (suffix) => CHORD_TYPE_NAMES[lang][suffix] ?? CHORD_TYPE_NAMES[DEFAULT_LANGUAGE][suffix] ?? suffix,
    groupName: (id) => GROUP_NAMES[lang][id] ?? id,
    inversionLabel: (i) => INVERSION_LABELS[lang](i),
    noteName,
    pcName,
    /** Nom de touche avec octave (ex. « Do3 », « C4 ») */
    keyLabel: (midi) => `${pcName(midi)}${Math.floor(midi / 12) + OCTAVE_OFFSET[lang]}`,
    /** Fondamentale / basse d'un symbole d'accord : lettres anglaises, sauf en
     *  allemand (H = si, B = si bémol), pour rester cohérent avec le tableau des notes. */
    rootName: (note) => formatNote(note, lang === "de" ? LETTER_NAMES.de : LETTER_NAMES.en),
  };
}

export const I18nContext = createContext(createI18n(DEFAULT_LANGUAGE, DEFAULT_ACCIDENTALS));

/** Accès aux libellés et noms de notes de la langue choisie. */
export const useI18n = () => useContext(I18nContext);
