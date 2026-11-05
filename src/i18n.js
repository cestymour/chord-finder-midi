// Gestion multilingue : tous les libellés de l'interface, les noms des types
// d'accords et les noms de notes, en anglais (par défaut), français, allemand,
// espagnol, portugais, chinois (simplifié), japonais et coréen.
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
  { code: "pt", name: "Português" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = "en";

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
  pt: ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"],
  // Chinois, japonais, coréen : lettres anglaises, l'usage courant en musique moderne
  zh: ["C", "D", "E", "F", "G", "A", "B"],
  ja: ["C", "D", "E", "F", "G", "A", "B"],
  ko: ["C", "D", "E", "F", "G", "A", "B"],
};

const LETTER_B = 6;

/** Nom d'une note orthographiée dans une langue (« Mi♭ », « E♭ », « B » allemand…). */
function formatNote(note, letters) {
  if (letters === LETTER_NAMES.de && note.letter === LETTER_B && note.alter === -1) return "B";
  return letters[note.letter] + ACCIDENTAL_SYMBOLS[note.alter + 2];
}

// Numéro d'octave : le Do central (MIDI 60) est Do3 en français, espagnol et
// portugais, C4 dans les autres langues.
const OCTAVE_OFFSET = { fr: -2, es: -2, pt: -2, en: -1, de: -1, zh: -1, ja: -1, ko: -1 };

// ─────────────────────────────────────────────
// LIBELLÉS
// ─────────────────────────────────────────────

export const MESSAGES = {
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
    "status.virtual": "Piano virtuel",

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
    "usb.prompt": "Branchez le piano en USB, touchez « Autoriser le câble USB » et acceptez l'accès MIDI (retenu pour la suite). Sur un téléphone, il faut un adaptateur USB OTG.",
    "usb.allow": "Autoriser le câble USB",

    "fallback.keyboard": "Piano virtuel",
    "fallback.prompt": "Pas de piano connecté ?",

    "idle.play": "Jouez un accord…",
    "idle.touch": "Jouez un accord au piano…",

    "chord.unknown": "Accord non reconnu",
    "chord.alternatives": "Autres possibilités",

    "keyboard.hint": "Touchez les notes de l'accord",
    "keyboard.clear": "Effacer",
    "keyboard.invert": "Renverser ↻",

    "explorer.root": "Fondamentale",
    "explorer.triad": "Triade",
    "explorer.nth": "{n}e",
    "explorer.main": "Classiques",
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
    "settings.soundHint": "Le son est celui d'un vrai piano à queue enregistré par Alexander Holm, sous licence CC-BY 3.0 :",
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
    "status.virtual": "Virtual piano",

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
    "usb.prompt": "Plug the piano in over USB, tap “Allow USB cable” and accept MIDI access (remembered next time). On a phone, you need a USB OTG adapter.",
    "usb.allow": "Allow USB cable",

    "fallback.keyboard": "Virtual piano",
    "fallback.prompt": "No piano connected?",

    "idle.play": "Play a chord…",
    "idle.touch": "Play a chord on the piano…",

    "chord.unknown": "Unrecognized chord",
    "chord.alternatives": "Other possibilities",

    "keyboard.hint": "Tap the notes of the chord",
    "keyboard.clear": "Clear",
    "keyboard.invert": "Invert ↻",

    "explorer.root": "Root",
    "explorer.triad": "Triad",
    "explorer.nth": "{n}th",
    "explorer.main": "Standard",
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
    "settings.soundHint": "The sound is a real grand piano recorded by Alexander Holm, licensed CC-BY 3.0:",
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
    "status.virtual": "Virtuelles Klavier",

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
    "usb.prompt": "Schließe das Klavier per USB an, tippe auf „USB-Kabel erlauben“ und erlaube den MIDI-Zugriff (wird gespeichert). Am Handy brauchst du einen USB-OTG-Adapter.",
    "usb.allow": "USB-Kabel erlauben",

    "fallback.keyboard": "Virtuelles Klavier",
    "fallback.prompt": "Kein Klavier verbunden?",

    "idle.play": "Spiel einen Akkord…",
    "idle.touch": "Spiel einen Akkord auf dem Klavier…",

    "chord.unknown": "Akkord nicht erkannt",
    "chord.alternatives": "Weitere Möglichkeiten",

    "keyboard.hint": "Tippe die Töne des Akkords an",
    "keyboard.clear": "Löschen",
    "keyboard.invert": "Umkehren ↻",

    "explorer.root": "Grundton",
    "explorer.triad": "Dreikl.",
    "explorer.nth": "{n}.",
    "explorer.main": "Standard",
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
    "settings.soundHint": "Der Klang stammt von einem echten Flügel, aufgenommen von Alexander Holm, Lizenz CC-BY 3.0:",
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
    "status.virtual": "Piano virtual",

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
    "usb.prompt": "Conecta el piano por USB, toca «Permitir cable USB» y acepta el acceso MIDI (se recuerda). En un teléfono necesitas un adaptador USB OTG.",
    "usb.allow": "Permitir cable USB",

    "fallback.keyboard": "Piano virtual",
    "fallback.prompt": "¿No hay ningún piano conectado?",

    "idle.play": "Toca un acorde…",
    "idle.touch": "Toca un acorde en el piano…",

    "chord.unknown": "Acorde no reconocido",
    "chord.alternatives": "Otras posibilidades",

    "keyboard.hint": "Toca las notas del acorde",
    "keyboard.clear": "Borrar",
    "keyboard.invert": "Invertir ↻",

    "explorer.root": "Fundamental",
    "explorer.triad": "Tríada",
    "explorer.nth": "{n}.ª",
    "explorer.main": "Clásicos",
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
    "settings.soundHint": "El sonido es el de un piano de cola real grabado por Alexander Holm, con licencia CC-BY 3.0:",
    "settings.source": "Código fuente en GitHub",
  },

  pt: {
    "tabs.aria": "Tela exibida",
    "tabs.notesToChord": "Notas → Acorde",
    "tabs.notesToChord.aria": "Encontrar o acorde a partir das notas",
    "tabs.chordToNotes": "Acorde → Notas",
    "tabs.chordToNotes.aria": "Ver as notas de um acorde",

    "midi.pending": "Conectando…",
    "midi.disconnected": "Nenhum piano conectado",
    "midi.denied": "MIDI não autorizado",
    "midi.unsupported": "MIDI indisponível",
    "status.connect": "Conectar um piano",
    "status.virtual": "Piano virtual",

    "connect.title": "Conecte o seu piano",

    "bt.connect": "Conectar MIDI Bluetooth",
    "bt.connectAria": "Conectar um instrumento MIDI por Bluetooth",
    "bt.scanning": "Procurando…",
    "bt.connecting": "Conectando…",
    "bt.reconnecting": "Reconectando…",
    "bt.reconnect": "Reconectar",
    "bt.other": "Conectar outro piano",
    "bt.disconnect": "Desconectar",
    "bt.piano": "Piano Bluetooth",
    "bt.statusReconnecting": "Conexão perdida · reconectando…",
    "bt.lost": "Conexão perdida",
    "bt.lost.help": "A conexão com o piano foi perdida. Verifique se ele está ligado e ao alcance e conecte-o novamente.",
    "bt.error.cancelled": "O seu piano não aparece?",
    "bt.error.cancelled.help": "Verifique se o Bluetooth dele está ligado e se ele não está já conectado a outro dispositivo ou aplicativo.",
    "bt.error.adapterOff": "Bluetooth desligado",
    "bt.error.adapterOff.help": "O Bluetooth deste dispositivo está desligado. Ligue-o e tente novamente.",
    "bt.error.denied": "Acesso ao Bluetooth negado",
    "bt.error.denied.help": "O acesso ao Bluetooth foi negado. Permita-o nas configurações do site (ícone à esquerda do endereço) e tente novamente.",
    "bt.error.failed": "Não foi possível conectar",
    "bt.error.failed.help": "Não foi possível conectar ao piano. Se ele já estiver conectado a outro dispositivo ou aplicativo, desconecte-o e tente novamente.",
    "bt.unsupported": "Bluetooth indisponível",
    "bt.unsupported.help": "Este navegador não é compatível com Web Bluetooth. Use o Chrome no Android ou no computador.",

    "usb.title": "Cabo USB",
    "usb.hint": "Conecte o piano por USB: ele é detectado automaticamente. No telefone, é preciso um adaptador USB OTG.",
    "usb.denied": "O acesso aos dispositivos MIDI foi negado. Para usar um cabo USB, permita-o nas configurações do site (ícone à esquerda do endereço).",
    "usb.unsupported": "Este navegador não suporta MIDI por cabo. Use o Chrome ou o Edge (o iPhone e o iPad não permitem).",
    "usb.prompt": "Conecte o piano por USB, toque em “Permitir cabo USB” e aceite o acesso MIDI (fica memorizado). No telefone, é preciso um adaptador USB OTG.",
    "usb.allow": "Permitir cabo USB",

    "fallback.keyboard": "Piano virtual",
    "fallback.prompt": "Nenhum piano conectado?",

    "idle.play": "Toque um acorde…",
    "idle.touch": "Toque um acorde no piano…",

    "chord.unknown": "Acorde não reconhecido",
    "chord.alternatives": "Outras possibilidades",

    "keyboard.hint": "Toque nas notas do acorde",
    "keyboard.clear": "Apagar",
    "keyboard.invert": "Inverter ↻",

    "explorer.root": "Fundamental",
    "explorer.triad": "Tríade",
    "explorer.nth": "{n}ª",
    "explorer.main": "Clássicos",
    "explorer.altered": "Alterados",

    "info.more": "Mais informações",

    "settings.open": "Configurações",
    "settings.title": "Configurações",
    "settings.close": "Fechar",
    "settings.language": "Idioma",
    "settings.accidentals": "Exibição das alterações",
    "settings.accidentalsHint": "Esta opção define o nome dos acordes: com sustenidos, sempre C♯ D♯ F♯ G♯ A♯; com bemóis, sempre D♭ E♭ G♭ A♭ B♭ (baixo incluído: E/A♭, D♯/G). Também vale para as teclas fora de um acorde. Na tabela, cada nota mantém o seu nome exato a partir da fundamental: a terça de D♯ é Fá𝄪, a de G♭m é Si𝄫.",
    "settings.sharps": "Sustenidos",
    "settings.flats": "Bemóis",
    "settings.sound": "Som",
    "settings.incomplete": "Acordes incompletos",
    "settings.incompleteHint": "Reconhecer um acorde tocado sem as suas notas opcionais, como a quinta: Dó Mi Si♭ dá C7.",
    "settings.version": "versão",
    "settings.license": "Licença MIT",
    "settings.soundHint": "O som é o de um piano de cauda real gravado por Alexander Holm, com licença CC-BY 3.0:",
    "settings.source": "Código-fonte no GitHub",
  },

  zh: {
    "tabs.aria": "显示的界面",
    "tabs.notesToChord": "音符 → 和弦",
    "tabs.notesToChord.aria": "根据音符找出和弦",
    "tabs.chordToNotes": "和弦 → 音符",
    "tabs.chordToNotes.aria": "查看和弦的音符",

    "midi.pending": "正在连接…",
    "midi.disconnected": "未连接钢琴",
    "midi.denied": "MIDI 未获授权",
    "midi.unsupported": "MIDI 不可用",
    "status.connect": "连接钢琴",
    "status.virtual": "虚拟钢琴",

    "connect.title": "连接你的钢琴",

    "bt.connect": "连接蓝牙 MIDI",
    "bt.connectAria": "通过蓝牙连接 MIDI 乐器",
    "bt.scanning": "正在搜索…",
    "bt.connecting": "正在连接…",
    "bt.reconnecting": "正在重新连接…",
    "bt.reconnect": "重新连接",
    "bt.other": "连接其他钢琴",
    "bt.disconnect": "断开连接",
    "bt.piano": "蓝牙钢琴",
    "bt.statusReconnecting": "连接已断开 · 正在重新连接…",
    "bt.lost": "连接已断开",
    "bt.lost.help": "与钢琴的连接已断开。请确认钢琴已开启且在范围内，然后重新连接。",
    "bt.error.cancelled": "找不到你的钢琴？",
    "bt.error.cancelled.help": "请确认钢琴的蓝牙已开启，并且没有连接到其他设备或应用。",
    "bt.error.adapterOff": "蓝牙已关闭",
    "bt.error.adapterOff.help": "此设备的蓝牙已关闭。请打开蓝牙后重试。",
    "bt.error.denied": "蓝牙访问被拒绝",
    "bt.error.denied.help": "蓝牙访问被拒绝。请在网站设置（地址左侧的图标）中允许，然后重试。",
    "bt.error.failed": "无法连接",
    "bt.error.failed.help": "无法连接到钢琴。如果它已连接到其他设备或应用，请先断开，然后重试。",
    "bt.unsupported": "蓝牙不可用",
    "bt.unsupported.help": "此浏览器不支持 Web Bluetooth。请在 Android 或电脑上使用 Chrome。",

    "usb.title": "USB 线",
    "usb.hint": "用 USB 线连接钢琴，会自动识别。在手机上需要 USB OTG 转接头。",
    "usb.denied": "MIDI 设备访问被拒绝。如需使用 USB 线，请在网站设置（地址左侧的图标）中允许。",
    "usb.unsupported": "此浏览器不支持有线 MIDI。请使用 Chrome 或 Edge（iPhone 和 iPad 不支持）。",
    "usb.prompt": "用 USB 线连接钢琴，点按“允许 USB 线”并允许 MIDI 访问（之后会记住）。在手机上需要 USB OTG 转接头。",
    "usb.allow": "允许 USB 线",

    "fallback.keyboard": "虚拟钢琴",
    "fallback.prompt": "没有连接钢琴？",

    "idle.play": "弹一个和弦…",
    "idle.touch": "在钢琴上弹一个和弦…",

    "chord.unknown": "无法识别的和弦",
    "chord.alternatives": "其他可能",

    "keyboard.hint": "点按和弦的音",
    "keyboard.clear": "清除",
    "keyboard.invert": "转位 ↻",

    "explorer.root": "根音",
    "explorer.triad": "三和弦",
    "explorer.nth": "{n}度",
    "explorer.main": "常用",
    "explorer.altered": "变化",

    "info.more": "更多信息",

    "settings.open": "设置",
    "settings.title": "设置",
    "settings.close": "关闭",
    "settings.language": "语言",
    "settings.accidentals": "升降号显示",
    "settings.accidentalsHint": "此选项决定和弦名称：选择升号时始终为 C♯ D♯ F♯ G♯ A♯，选择降号时始终为 D♭ E♭ G♭ A♭ B♭（包括低音：E/A♭、D♯/G）。和弦以外的琴键也按此命名。在表格中，每个音都按根音保持准确的名称：D♯ 的三音是 F𝄪，G♭m 的三音是 B𝄫。",
    "settings.sharps": "升号",
    "settings.flats": "降号",
    "settings.sound": "声音",
    "settings.incomplete": "不完整和弦",
    "settings.incompleteHint": "识别缺少可省略音（如五音）的和弦：C E B♭ 识别为 C7。",
    "settings.version": "版本",
    "settings.license": "MIT 许可证",
    "settings.soundHint": "声音来自 Alexander Holm 录制的真实三角钢琴，采用 CC-BY 3.0 许可：",
    "settings.source": "GitHub 上的源代码",
  },

  ja: {
    "tabs.aria": "表示する画面",
    "tabs.notesToChord": "音 → コード",
    "tabs.notesToChord.aria": "音からコードを探す",
    "tabs.chordToNotes": "コード → 音",
    "tabs.chordToNotes.aria": "コードの構成音を見る",

    "midi.pending": "接続中…",
    "midi.disconnected": "ピアノ未接続",
    "midi.denied": "MIDI が許可されていません",
    "midi.unsupported": "MIDI は使用できません",
    "status.connect": "ピアノを接続",
    "status.virtual": "バーチャルピアノ",

    "connect.title": "ピアノを接続しましょう",

    "bt.connect": "Bluetooth MIDI で接続",
    "bt.connectAria": "Bluetooth で MIDI 楽器を接続",
    "bt.scanning": "検索中…",
    "bt.connecting": "接続中…",
    "bt.reconnecting": "再接続中…",
    "bt.reconnect": "再接続",
    "bt.other": "別のピアノを接続",
    "bt.disconnect": "切断",
    "bt.piano": "Bluetooth ピアノ",
    "bt.statusReconnecting": "接続が切れました · 再接続中…",
    "bt.lost": "接続が切れました",
    "bt.lost.help": "ピアノとの接続が切れました。電源が入っていて近くにあることを確認してから、再接続してください。",
    "bt.error.cancelled": "ピアノが表示されませんか？",
    "bt.error.cancelled.help": "ピアノの Bluetooth がオンになっていて、ほかの機器やアプリに接続されていないことを確認してください。",
    "bt.error.adapterOff": "Bluetooth がオフです",
    "bt.error.adapterOff.help": "この端末の Bluetooth がオフになっています。オンにしてから、もう一度お試しください。",
    "bt.error.denied": "Bluetooth へのアクセスが拒否されました",
    "bt.error.denied.help": "Bluetooth へのアクセスが拒否されました。サイトの設定（アドレスの左のアイコン）で許可してから、もう一度お試しください。",
    "bt.error.failed": "接続できません",
    "bt.error.failed.help": "ピアノに接続できません。ほかの機器やアプリに接続されている場合は切断してから、もう一度お試しください。",
    "bt.unsupported": "Bluetooth は使用できません",
    "bt.unsupported.help": "このブラウザは Web Bluetooth に対応していません。Android またはパソコンの Chrome をお使いください。",

    "usb.title": "USB ケーブル",
    "usb.hint": "ピアノを USB で接続すると、自動的に認識されます。スマートフォンでは USB OTG アダプターが必要です。",
    "usb.denied": "MIDI 機器へのアクセスが拒否されました。USB ケーブルを使うには、サイトの設定（アドレスの左のアイコン）で許可してください。",
    "usb.unsupported": "このブラウザはケーブル接続の MIDI に対応していません。Chrome または Edge をお使いください（iPhone と iPad は非対応です）。",
    "usb.prompt": "ピアノを USB で接続し、「USB ケーブルを許可」をタップして MIDI へのアクセスを許可してください（次回以降も記憶されます）。スマートフォンでは USB OTG アダプターが必要です。",
    "usb.allow": "USB ケーブルを許可",

    "fallback.keyboard": "バーチャルピアノ",
    "fallback.prompt": "ピアノが接続されていませんか？",

    "idle.play": "コードを弾いてください…",
    "idle.touch": "ピアノでコードを弾いてください…",

    "chord.unknown": "認識できないコード",
    "chord.alternatives": "ほかの候補",

    "keyboard.hint": "コードの音をタップしてください",
    "keyboard.clear": "クリア",
    "keyboard.invert": "転回 ↻",

    "explorer.root": "ルート",
    "explorer.triad": "三和音",
    "explorer.nth": "{n}度",
    "explorer.main": "基本",
    "explorer.altered": "オルタード",

    "info.more": "詳しい情報",

    "settings.open": "設定",
    "settings.title": "設定",
    "settings.close": "閉じる",
    "settings.language": "言語",
    "settings.accidentals": "臨時記号の表示",
    "settings.accidentalsHint": "この設定でコード名が決まります。シャープなら常に C♯ D♯ F♯ G♯ A♯、フラットなら常に D♭ E♭ G♭ A♭ B♭ です（ベースも含む：E/A♭、D♯/G）。コード外の鍵盤にも使われます。表では、各音はルートから見た正確な名前のままです：D♯ の3度は F𝄪、G♭m の3度は B𝄫 です。",
    "settings.sharps": "シャープ",
    "settings.flats": "フラット",
    "settings.sound": "サウンド",
    "settings.incomplete": "不完全なコード",
    "settings.incompleteHint": "5度などの省略できる音がなくてもコードを認識します：C E B♭ は C7 になります。",
    "settings.version": "バージョン",
    "settings.license": "MIT ライセンス",
    "settings.soundHint": "サウンドは Alexander Holm が録音した本物のグランドピアノで、CC-BY 3.0 ライセンスです：",
    "settings.source": "GitHub のソースコード",
  },

  ko: {
    "tabs.aria": "표시할 화면",
    "tabs.notesToChord": "음 → 코드",
    "tabs.notesToChord.aria": "음으로 코드 찾기",
    "tabs.chordToNotes": "코드 → 음",
    "tabs.chordToNotes.aria": "코드의 구성음 보기",

    "midi.pending": "연결 중…",
    "midi.disconnected": "연결된 피아노 없음",
    "midi.denied": "MIDI 허용 안 됨",
    "midi.unsupported": "MIDI 사용 불가",
    "status.connect": "피아노 연결",
    "status.virtual": "가상 피아노",

    "connect.title": "피아노를 연결하세요",

    "bt.connect": "블루투스 MIDI 연결",
    "bt.connectAria": "블루투스로 MIDI 악기 연결",
    "bt.scanning": "검색 중…",
    "bt.connecting": "연결 중…",
    "bt.reconnecting": "다시 연결 중…",
    "bt.reconnect": "다시 연결",
    "bt.other": "다른 피아노 연결",
    "bt.disconnect": "연결 해제",
    "bt.piano": "블루투스 피아노",
    "bt.statusReconnecting": "연결 끊김 · 다시 연결 중…",
    "bt.lost": "연결 끊김",
    "bt.lost.help": "피아노와의 연결이 끊겼습니다. 피아노가 켜져 있고 가까이 있는지 확인한 다음 다시 연결하세요.",
    "bt.error.cancelled": "피아노가 보이지 않나요?",
    "bt.error.cancelled.help": "피아노의 블루투스가 켜져 있는지, 다른 기기나 앱에 이미 연결되어 있지 않은지 확인하세요.",
    "bt.error.adapterOff": "블루투스 꺼짐",
    "bt.error.adapterOff.help": "이 기기의 블루투스가 꺼져 있습니다. 블루투스를 켠 다음 다시 시도하세요.",
    "bt.error.denied": "블루투스 접근 거부됨",
    "bt.error.denied.help": "블루투스 접근이 거부되었습니다. 사이트 설정(주소 왼쪽 아이콘)에서 허용한 다음 다시 시도하세요.",
    "bt.error.failed": "연결할 수 없음",
    "bt.error.failed.help": "피아노에 연결할 수 없습니다. 다른 기기나 앱에 이미 연결되어 있다면 연결을 해제한 다음 다시 시도하세요.",
    "bt.unsupported": "블루투스 사용 불가",
    "bt.unsupported.help": "이 브라우저는 Web Bluetooth를 지원하지 않습니다. Android나 컴퓨터에서 Chrome을 사용하세요.",

    "usb.title": "USB 케이블",
    "usb.hint": "피아노를 USB로 연결하면 자동으로 인식됩니다. 휴대폰에서는 USB OTG 어댑터가 필요합니다.",
    "usb.denied": "MIDI 기기 접근이 거부되었습니다. USB 케이블을 사용하려면 사이트 설정(주소 왼쪽 아이콘)에서 허용하세요.",
    "usb.unsupported": "이 브라우저는 케이블 MIDI를 지원하지 않습니다. Chrome이나 Edge를 사용하세요(iPhone과 iPad에서는 사용할 수 없습니다).",
    "usb.prompt": "피아노를 USB로 연결하고 “USB 케이블 허용”을 누른 다음 MIDI 접근을 허용하세요(다음에도 기억됩니다). 휴대폰에서는 USB OTG 어댑터가 필요합니다.",
    "usb.allow": "USB 케이블 허용",

    "fallback.keyboard": "가상 피아노",
    "fallback.prompt": "연결된 피아노가 없나요?",

    "idle.play": "코드를 연주하세요…",
    "idle.touch": "피아노로 코드를 연주하세요…",

    "chord.unknown": "인식할 수 없는 코드",
    "chord.alternatives": "다른 가능성",

    "keyboard.hint": "코드의 음을 누르세요",
    "keyboard.clear": "지우기",
    "keyboard.invert": "전위 ↻",

    "explorer.root": "근음",
    "explorer.triad": "3화음",
    "explorer.nth": "{n}도",
    "explorer.main": "기본",
    "explorer.altered": "알터드",

    "info.more": "자세한 정보",

    "settings.open": "설정",
    "settings.title": "설정",
    "settings.close": "닫기",
    "settings.language": "언어",
    "settings.accidentals": "임시표 표시",
    "settings.accidentalsHint": "이 설정으로 코드 이름이 정해집니다. 샵을 고르면 항상 C♯ D♯ F♯ G♯ A♯, 플랫을 고르면 항상 D♭ E♭ G♭ A♭ B♭입니다(베이스 포함: E/A♭, D♯/G). 코드 밖의 건반에도 적용됩니다. 표에서는 각 음이 근음에서 본 정확한 이름을 유지합니다: D♯의 3음은 F𝄪, G♭m의 3음은 B𝄫입니다.",
    "settings.sharps": "샵",
    "settings.flats": "플랫",
    "settings.sound": "소리",
    "settings.incomplete": "불완전한 코드",
    "settings.incompleteHint": "5음처럼 생략할 수 있는 음 없이 연주한 코드도 인식합니다: C E B♭은 C7이 됩니다.",
    "settings.version": "버전",
    "settings.license": "MIT 라이선스",
    "settings.soundHint": "소리는 Alexander Holm이 녹음한 실제 그랜드 피아노이며, CC-BY 3.0 라이선스입니다:",
    "settings.source": "GitHub 소스 코드",
  },
};

// Groupes de types d'accords (dictionnaire), indexés par `id` de groupe (src/chords.js)
export const GROUP_NAMES = {
  fr: { triads: "Triades", sixths: "Sixtes", sevenths: "Septièmes", ninths: "Neuvièmes", elevenths: "Onzièmes", thirteenths: "Treizièmes" },
  en: { triads: "Triads", sixths: "Sixths", sevenths: "Sevenths", ninths: "Ninths", elevenths: "Elevenths", thirteenths: "Thirteenths" },
  de: { triads: "Dreiklänge", sixths: "Sextakkorde", sevenths: "Septakkorde", ninths: "Nonakkorde", elevenths: "Undezimakkorde", thirteenths: "Tredezimakkorde" },
  es: { triads: "Tríadas", sixths: "Sextas", sevenths: "Séptimas", ninths: "Novenas", elevenths: "Oncenas", thirteenths: "Trecenas" },
  pt: { triads: "Tríades", sixths: "Sextas", sevenths: "Sétimas", ninths: "Nonas", elevenths: "Décimas primeiras", thirteenths: "Décimas terceiras" },
  zh: { triads: "三和弦", sixths: "六和弦", sevenths: "七和弦", ninths: "九和弦", elevenths: "十一和弦", thirteenths: "十三和弦" },
  ja: { triads: "三和音", sixths: "シックス", sevenths: "セブンス", ninths: "ナインス", elevenths: "イレブンス", thirteenths: "サーティーンス" },
  ko: { triads: "3화음", sixths: "6화음", sevenths: "7화음", ninths: "9화음", elevenths: "11화음", thirteenths: "13화음" },
};

// Noms des types d'accords, indexés par `suffix` (src/chords.js)
export const CHORD_TYPE_NAMES = {
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
  pt: {
    "": "Maior", "m": "Menor", "dim": "Diminuto", "aug": "Aumentado",
    "sus2": "Suspenso 2", "sus4": "Suspenso 4", "5": "Quinta (power chord)",
    "6": "Sexta maior", "m6": "Menor com sexta", "6/9": "Sexta/nona", "m6/9": "Menor com sexta/nona",
    "maj7": "Sétima maior", "7": "Sétima dominante", "m7": "Sétima menor",
    "mM7": "Menor com sétima maior", "dim7": "Sétima diminuta", "m7♭5": "Meio-diminuto",
    "aug7": "Sétima aumentada", "7sus4": "Sétima sus4", "7♭5": "Sétima, quinta diminuta",
    "7♯5": "Sétima, quinta aumentada", "maj7♯5": "Sétima maior, quinta aumentada",
    "dimM7": "Diminuto com sétima maior",
    "maj9": "Nona maior", "9": "Nona dominante", "m9": "Nona menor",
    "add9": "Nona adicionada", "madd9": "Menor com nona adicionada",
    "mM9": "Nona menor com sétima maior", "9sus4": "Nona sus4",
    "7♭9": "Sétima, nona menor", "7♯9": "Sétima, nona aumentada",
    "7♯5♭9": "Sétima, quinta aumentada, nona menor", "7♯5♯9": "Sétima, quinta e nona aumentadas",
    "11": "Décima primeira", "m11": "Décima primeira menor", "maj11": "Décima primeira maior",
    "add11": "Décima primeira adicionada", "7♯11": "Sétima, décima primeira aumentada",
    "maj7♯11": "Sétima maior, décima primeira aumentada",
    "13": "Décima terceira", "m13": "Décima terceira menor", "maj13": "Décima terceira maior",
    "13♯11": "Décima terceira, décima primeira aumentada", "13♭9": "Décima terceira, nona menor",
    "7♭13": "Sétima, décima terceira menor",
  },
  zh: {
    "": "大三和弦", "m": "小三和弦", "dim": "减三和弦", "aug": "增三和弦",
    "sus2": "挂二和弦", "sus4": "挂四和弦", "5": "五度和弦（强力和弦）",
    "6": "大六和弦", "m6": "小六和弦", "6/9": "六九和弦", "m6/9": "小六九和弦",
    "maj7": "大七和弦", "7": "属七和弦", "m7": "小七和弦",
    "mM7": "小大七和弦", "dim7": "减七和弦", "m7♭5": "半减七和弦",
    "aug7": "增七和弦", "7sus4": "属七挂四和弦", "7♭5": "属七降五和弦",
    "7♯5": "属七升五和弦", "maj7♯5": "大七升五和弦", "dimM7": "减大七和弦",
    "maj9": "大九和弦", "9": "属九和弦", "m9": "小九和弦",
    "add9": "加九和弦", "madd9": "小三加九和弦",
    "mM9": "小大九和弦", "9sus4": "属九挂四和弦",
    "7♭9": "属七降九和弦", "7♯9": "属七升九和弦",
    "7♯5♭9": "属七升五降九和弦", "7♯5♯9": "属七升五升九和弦",
    "11": "属十一和弦", "m11": "小十一和弦", "maj11": "大十一和弦",
    "add11": "加十一和弦", "7♯11": "属七升十一和弦", "maj7♯11": "大七升十一和弦",
    "13": "属十三和弦", "m13": "小十三和弦", "maj13": "大十三和弦",
    "13♯11": "属十三升十一和弦", "13♭9": "属十三降九和弦", "7♭13": "属七降十三和弦",
  },
  ja: {
    "": "メジャー", "m": "マイナー", "dim": "ディミニッシュ", "aug": "オーギュメント",
    "sus2": "サスツー", "sus4": "サスフォー", "5": "パワーコード",
    "6": "シックス", "m6": "マイナーシックス", "6/9": "シックスナインス", "m6/9": "マイナーシックスナインス",
    "maj7": "メジャーセブンス", "7": "セブンス", "m7": "マイナーセブンス",
    "mM7": "マイナーメジャーセブンス", "dim7": "ディミニッシュセブンス", "m7♭5": "ハーフディミニッシュ",
    "aug7": "オーギュメントセブンス", "7sus4": "セブンスサスフォー", "7♭5": "セブンスフラットファイブ",
    "7♯5": "セブンスシャープファイブ", "maj7♯5": "メジャーセブンスシャープファイブ",
    "dimM7": "ディミニッシュメジャーセブンス",
    "maj9": "メジャーナインス", "9": "ナインス", "m9": "マイナーナインス",
    "add9": "アドナインス", "madd9": "マイナーアドナインス",
    "mM9": "マイナーメジャーナインス", "9sus4": "ナインスサスフォー",
    "7♭9": "セブンスフラットナインス", "7♯9": "セブンスシャープナインス",
    "7♯5♭9": "セブンスシャープファイブフラットナインス", "7♯5♯9": "セブンスシャープファイブシャープナインス",
    "11": "イレブンス", "m11": "マイナーイレブンス", "maj11": "メジャーイレブンス",
    "add11": "アドイレブンス", "7♯11": "セブンスシャープイレブンス", "maj7♯11": "メジャーセブンスシャープイレブンス",
    "13": "サーティーンス", "m13": "マイナーサーティーンス", "maj13": "メジャーサーティーンス",
    "13♯11": "サーティーンスシャープイレブンス", "13♭9": "サーティーンスフラットナインス",
    "7♭13": "セブンスフラットサーティーンス",
  },
  ko: {
    "": "메이저", "m": "마이너", "dim": "디미니시", "aug": "오그멘티드",
    "sus2": "서스 2", "sus4": "서스 4", "5": "파워 코드",
    "6": "식스", "m6": "마이너 식스", "6/9": "식스 나인스", "m6/9": "마이너 식스 나인스",
    "maj7": "메이저 세븐스", "7": "도미넌트 세븐스", "m7": "마이너 세븐스",
    "mM7": "마이너 메이저 세븐스", "dim7": "디미니시 세븐스", "m7♭5": "하프 디미니시",
    "aug7": "오그멘티드 세븐스", "7sus4": "세븐스 서스 4", "7♭5": "세븐스 플랫 5",
    "7♯5": "세븐스 샵 5", "maj7♯5": "메이저 세븐스 샵 5", "dimM7": "디미니시 메이저 세븐스",
    "maj9": "메이저 나인스", "9": "도미넌트 나인스", "m9": "마이너 나인스",
    "add9": "애드 나인스", "madd9": "마이너 애드 나인스",
    "mM9": "마이너 메이저 나인스", "9sus4": "나인스 서스 4",
    "7♭9": "세븐스 플랫 9", "7♯9": "세븐스 샵 9", "7♯5♭9": "세븐스 샵 5 플랫 9", "7♯5♯9": "세븐스 샵 5 샵 9",
    "11": "일레븐스", "m11": "마이너 일레븐스", "maj11": "메이저 일레븐스",
    "add11": "애드 일레븐스", "7♯11": "세븐스 샵 11", "maj7♯11": "메이저 세븐스 샵 11",
    "13": "서틴스", "m13": "마이너 서틴스", "maj13": "메이저 서틴스",
    "13♯11": "서틴스 샵 11", "13♭9": "서틴스 플랫 9", "7♭13": "세븐스 플랫 13",
  },
};

// Position de l'accord dans le dictionnaire (0 = état fondamental)
const EN_ORDINALS = ["", "1st", "2nd", "3rd"];
const ZH_NUMERALS = ["", "一", "二", "三", "四", "五", "六"];
const INVERSION_LABELS = {
  fr: (i) => (i === 0 ? "État fondamental" : i === 1 ? "1er renversement" : `${i}e renversement`),
  en: (i) => (i === 0 ? "Root position" : `${EN_ORDINALS[i] ?? `${i}th`} inversion`),
  de: (i) => (i === 0 ? "Grundstellung" : `${i}. Umkehrung`),
  es: (i) => (i === 0 ? "Estado fundamental" : `${i}.ª inversión`),
  pt: (i) => (i === 0 ? "Posição fundamental" : `${i}ª inversão`),
  zh: (i) => (i === 0 ? "原位" : `第${ZH_NUMERALS[i] ?? i}转位`),
  ja: (i) => (i === 0 ? "基本形" : `第${i}転回形`),
  ko: (i) => (i === 0 ? "기본 위치" : `제${i}전위`),
};

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

/**
 * Fonctions d'affichage pour une langue et un choix d'altérations.
 * Une clé absente dans une langue retombe sur l'anglais (langue par défaut).
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
