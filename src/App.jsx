import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import './App.css';
import useBluetoothMIDI from "./useBluetoothMIDI";
import {
  playPianoNote,
  playPianoArpeggio,
  stopPianoNote,
  stopAllPianoNotes,
  setPianoSoundEnabled,
  subscribePianoNotes,
} from "./pianoSound";
import {
  ACCIDENTALS,
  BLACK_KEY_PCS,
  CHORD_TEMPLATE_GROUPS,
  CHORD_TEMPLATES,
  DEFAULT_ACCIDENTALS,
  buildChordVoicing,
  buildPendingNotePairs,
  describeVoicing,
  identifyChords,
  inversionCount,
  spellRoot,
} from "./chords";
import {
  DEFAULT_LANGUAGE,
  I18nContext,
  LANGUAGES,
  LANGUAGE_CODES,
  createI18n,
  useI18n,
} from "./i18n";

// ─────────────────────────────────────────────
// MIDI CONNECTION HOOK
// ─────────────────────────────────────────────

// Pédale de sustain : contrôleur 64, enfoncée à partir de 64
const SUSTAIN_CONTROLLER = 64;

// Ports MIDI virtuels du système (« Midi Through » sous Linux) : ce ne sont pas des instruments.
const VIRTUAL_MIDI_PORT = /\bthrough\b/i;

/**
 * Entrées Web MIDI : câble USB, ou piano Bluetooth jumelé au niveau du système.
 * Retourne { status, devices } :
 * - status : "pending" | "connected" | "disconnected" | "denied" (accès refusé) | "unsupported"
 * - devices : noms des instruments écoutés
 */
function useMIDI(onNoteOn, onNoteOff, onSustain) {
  const [midiState, setMidiState] = useState(() => ({
    status: navigator.requestMIDIAccess ? "pending" : "unsupported",
    devices: [],
  }));
  const inputsRef = useRef([]);

  const handleMidiMessage = useCallback((event) => {
    const [status, note, velocity] = event.data;
    const type = status & 0xf0;

    if (type === 0x90 && velocity > 0) {
      onNoteOn(note);
    } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
      onNoteOff(note);
    } else if (type === 0xb0 && note === SUSTAIN_CONTROLLER) {
      onSustain(velocity >= 64);
    }
  }, [onNoteOn, onNoteOff, onSustain]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return; // état initial "unsupported"

    const attachListeners = (midiAccess) => {
      // Detach old listeners
      inputsRef.current.forEach(inp => {
        inp.onmidimessage = null;
      });
      inputsRef.current = [];

      const names = new Set();
      midiAccess.inputs.forEach(input => {
        if (input.state === "disconnected" || VIRTUAL_MIDI_PORT.test(input.name ?? "")) return;
        input.onmidimessage = handleMidiMessage;
        inputsRef.current.push(input);
        names.add(input.name || "MIDI");
      });

      const devices = [...names];
      setMidiState(prev =>
        prev.devices.join("\n") === devices.join("\n") && prev.status !== "pending"
          ? prev
          : { status: devices.length > 0 ? "connected" : "disconnected", devices }
      );
    };

    navigator.requestMIDIAccess()
      .then(midiAccess => {
        attachListeners(midiAccess);

        midiAccess.onstatechange = () => {
          attachListeners(midiAccess);
        };
      })
      .catch(() => {
        setMidiState({ status: "denied", devices: [] });
      });

    return () => {
      if (inputsRef.current) {
        inputsRef.current.forEach(inp => {
          inp.onmidimessage = null;
        });
      }
    };
  }, [handleMidiMessage]);

  return midiState;
}

// ─────────────────────────────────────────────
// BLUETOOTH MIDI BUTTON COMPONENT
// ─────────────────────────────────────────────

function BluetoothIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6.5 6.5 17.5 17.5" />
      <polyline points="6.5 17.5 17.5 6.5" />
      <polyline points="12 2 17.5 6.5 12 11 17.5 17.5 12 22" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  );
}

const BT_LOADING_LABELS = {
  scanning: "bt.scanning",
  connecting: "bt.connecting",
  reconnecting: "bt.reconnecting",
};

/**
 * Gros bouton rond de connexion Bluetooth. Quand un piano est déjà connu (choisi avant
 * une coupure, une déconnexion, ou retrouvé à l'ouverture), il propose de s'y reconnecter
 * sans sélecteur, avec un lien pour choisir un autre piano.
 */
function BluetoothMIDIButton({ btStatus, btError, knownDevice, onConnect, onReconnect }) {
  const { t } = useI18n();
  const loadingLabel = BT_LOADING_LABELS[btStatus];
  const isLoading = Boolean(loadingLabel);
  const offerReconnect = knownDevice && !isLoading && btStatus !== "unsupported";

  return (
    <div className="bt-connect-container">
      <button
        className={`bt-connect-btn ${isLoading ? "bt-connect-btn--loading" : ""}`}
        onClick={offerReconnect ? onReconnect : onConnect}
        disabled={isLoading}
        aria-label={offerReconnect ? undefined : t("bt.connectAria")}
      >
        <BluetoothIcon className="bt-connect-icon" />

        <span className="bt-connect-label">
          {isLoading ? (
            t(loadingLabel)
          ) : offerReconnect ? (
            <>
              {t("bt.reconnect")}
              {knownDevice.name && <span className="bt-connect-device">{knownDevice.name}</span>}
            </>
          ) : (
            t("bt.connect")
          )}
        </span>
      </button>

      {btStatus === "lost" && <p className="bt-connect-error">{t("bt.lost")}</p>}

      {/* Sélecteur fermé : simple conseil, pas une erreur */}
      {btStatus === "error" && btError === "cancelled" && (
        <p className="bt-connect-hint">{t("bt.error.cancelled")}</p>
      )}
      {btStatus === "error" && btError && btError !== "cancelled" && (
        <p className="bt-connect-error">{t(`bt.error.${btError}`)}</p>
      )}

      {btStatus === "unsupported" && (
        <p className="bt-connect-error">{t("bt.unsupported")}</p>
      )}

      {offerReconnect && (
        <button className="bt-connect-other" onClick={onConnect}>
          {t("bt.other")}
        </button>
      )}
    </div>
  );
}

/** Branchement par câble : détecté tout seul par Web MIDI, on explique seulement comment faire. */
function UsbHint({ midiStatus }) {
  const { t } = useI18n();
  const textKey =
    midiStatus === "denied" ? "usb.denied" : midiStatus === "unsupported" ? "usb.unsupported" : "usb.hint";
  return (
    <div className="usb-hint">
      <span className="usb-hint__title">🔌 {t("usb.title")}</span>
      <p className={`usb-hint__text${textKey === "usb.hint" ? "" : " usb-hint__text--warn"}`}>{t(textKey)}</p>
    </div>
  );
}

/** Ligne d'état sous les onglets (écran Piano) : nom du piano connecté et moyen de connexion. */
function ConnectionStatus({ btStatus, btKnownDevice, midi, onDisconnect }) {
  const { t } = useI18n();
  let status;
  let label;
  let bluetooth = false;

  if (btStatus === "connected") {
    status = "connected";
    bluetooth = true;
    label = btKnownDevice?.name || t("bt.piano");
  } else if (btStatus === "reconnecting") {
    status = "pending";
    bluetooth = true;
    label = t("bt.statusReconnecting");
  } else if (btStatus === "scanning" || btStatus === "connecting") {
    status = "pending";
    label = t("midi.pending");
  } else if (midi.status === "connected") {
    // Web MIDI ne dit pas si l'instrument est en USB ou jumelé en Bluetooth : icône neutre
    status = "connected";
    label = `🎹 ${midi.devices.join(", ")}`;
  } else {
    status = midi.status === "unsupported" ? "denied" : midi.status;
    label = t(`midi.${midi.status}`);
  }

  return (
    <div className={`midi-status midi-status--${status}`}>
      <span className="midi-dot" />
      {bluetooth && <BluetoothIcon className="midi-status__icon" />}
      <span className="midi-label">{label}</span>
      {bluetooth && (
        <button className="midi-status__action" onClick={onDisconnect}>
          {t("bt.disconnect")}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// VIRTUAL KEYBOARD COMPONENT (mode clavier virtuel et explorateur d'accords)
// ─────────────────────────────────────────────

const VIRTUAL_KB_FIRST_NOTE = 48; // Do2 en convention française (C3 en convention anglaise)
const VIRTUAL_KB_OCTAVES = 3; // dont 2 visibles sur écran étroit, le reste par défilement horizontal

// Disposition statique du clavier, calculée une seule fois
const VK_NOTES = Array.from(
  { length: VIRTUAL_KB_OCTAVES * 12 },
  (_, i) => VIRTUAL_KB_FIRST_NOTE + i
);
const VK_WHITE_NOTES = VK_NOTES.filter((n) => !BLACK_KEY_PCS.has(n % 12));
const VK_WHITE_WIDTH = 100 / VK_WHITE_NOTES.length;
const VK_BLACK_WIDTH = VK_WHITE_WIDTH * 0.6;

// Position horizontale de chaque touche, en % de la largeur totale du clavier.
// Une touche noire est centrée sur la frontière entre deux touches blanches.
const VK_KEY_SPANS = (() => {
  const spans = new Map();
  let whiteIndex = 0;
  for (const n of VK_NOTES) {
    if (BLACK_KEY_PCS.has(n % 12)) {
      const center = whiteIndex * VK_WHITE_WIDTH;
      spans.set(n, { left: center - VK_BLACK_WIDTH / 2, right: center + VK_BLACK_WIDTH / 2 });
    } else {
      spans.set(n, { left: whiteIndex * VK_WHITE_WIDTH, right: (whiteIndex + 1) * VK_WHITE_WIDTH });
      whiteIndex++;
    }
  }
  return spans;
})();
const VK_BLACK_NOTES = VK_NOTES.filter((n) => BLACK_KEY_PCS.has(n % 12));

/**
 * Fait défiler le clavier pour que [lowNote, highNote] soit visible :
 * si une des deux extrémités est masquée, la note grave est amenée à gauche.
 * Sinon, le clavier ne bouge pas.
 */
function useScrollIntoView(scrollerRef, lowNote, highNote) {
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || lowNote == null || highNote == null) return;

    const total = el.scrollWidth;
    const view = el.clientWidth;
    if (total <= view) return; // tout le clavier est visible

    const left = (VK_KEY_SPANS.get(lowNote).left / 100) * total;
    const right = (VK_KEY_SPANS.get(highNote).right / 100) * total;
    if (left >= el.scrollLeft && right <= el.scrollLeft + view) return;

    const margin = (VK_WHITE_WIDTH / 100) * total * 0.5;
    const target = Math.max(0, Math.min(left - margin, total - view));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target, behavior: reduceMotion ? "auto" : "smooth" });
  }, [scrollerRef, lowNote, highNote]);
}

/**
 * Clavier de 3 octaves défilant horizontalement.
 * - activeNotes : touches allumées (couleur pleine)
 * - onKeyClick  : absent → clavier en lecture seule
 * - scrollToNotes : notes à garder visibles (défilement automatique)
 * - noteLabels : Map classe de hauteur → note orthographiée (noms des touches
 *   enfoncées selon l'accord : Si♯ et non Do dans Mi augmenté)
 */
function VirtualKeyboard({ activeNotes, onKeyClick, scrollToNotes, noteLabels, toolbar }) {
  const { keyLabel, noteName, pcName } = useI18n();
  const scrollerRef = useRef(null);
  const interactive = Boolean(onKeyClick);
  const KeyTag = interactive ? "button" : "div";

  // Bref éclat de la touche quand sa note sonne (synchronisé avec l'arpège).
  useEffect(() => subscribePianoNotes((midi, delay) => {
    const key = scrollerRef.current?.querySelector(`[data-midi="${midi}"]`);
    key?.animate(
      [{ filter: "brightness(1.7)", boxShadow: "0 0 22px #7fffd4" }, {}],
      { duration: 450, delay: delay * 1000, easing: "ease-out" }
    );
  }), []);

  useScrollIntoView(
    scrollerRef,
    scrollToNotes?.length ? Math.min(...scrollToNotes) : null,
    scrollToNotes?.length ? Math.max(...scrollToNotes) : null
  );

  // Touche blanche : les Do portent leur octave (« Do3 »), les touches enfoncées
  // leur nom dans l'accord (un Do enfoncé peut s'appeler Si♯).
  const whiteKeyLabel = (n, isDown) => {
    const spelled = isDown ? noteLabels?.get(n % 12) : undefined;
    if (spelled && (spelled.letter !== 0 || spelled.alter !== 0)) return noteName(spelled);
    return n % 12 === 0 ? keyLabel(n) : pcName(n);
  };

  const keyProps = (n, color) => {
    const isDown = activeNotes.has(n);
    return {
      isDown,
      props: {
        "data-midi": n,
        className: `vk-key vk-key--${color}${isDown ? " vk-key--down" : ""}${interactive ? "" : " vk-key--static"}`,
        ...(interactive
          ? { onClick: () => onKeyClick(n), "aria-pressed": isDown, "aria-label": keyLabel(n) }
          : {}),
      },
    };
  };

  return (
    <div className="virtual-kb">
      <div className="virtual-kb__toolbar">{toolbar}</div>
      <div className="virtual-kb__scroller" ref={scrollerRef}>
        <div className="virtual-kb__keys" aria-hidden={interactive ? undefined : true}>
          {VK_WHITE_NOTES.map((n) => {
            const { isDown, props } = keyProps(n, "white");
            return (
              <KeyTag key={n} {...props} style={{ width: `${VK_WHITE_WIDTH}%` }}>
                {(n % 12 === 0 || isDown) && (
                  <span className="vk-key__label">
                    {whiteKeyLabel(n, isDown)}
                  </span>
                )}
              </KeyTag>
            );
          })}
          {VK_BLACK_NOTES.map((n) => {
            const { props } = keyProps(n, "black");
            return (
              <KeyTag
                key={n}
                {...props}
                style={{ left: `${VK_KEY_SPANS.get(n).left}%`, width: `${VK_BLACK_WIDTH}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CHORD EXPLORER (sens inverse : choisir un accord → voir ses touches)
// ─────────────────────────────────────────────

const ROOT_PCS = Array.from({ length: 12 }, (_, pc) => pc);

function ChordExplorer({ rootPc, template, onRootChange, onSuffixChange }) {
  const { t, rootName, groupName, chordTypeName, accidentals } = useI18n();
  const suffix = template.suffix;
  return (
    <div className="explorer">
      <div className="explorer__section">
        <div className="explorer__label">{t("explorer.root")}</div>
        <div className="explorer__roots">
          {ROOT_PCS.map((pc) => (
            <button
              key={pc}
              className={`explorer-chip${pc === rootPc ? " explorer-chip--active" : ""}`}
              onClick={() => onRootChange(pc)}
              aria-pressed={pc === rootPc}
            >
              {/* Nom selon le type choisi : D♭ en majeur, C♯ en mineur */}
              {rootName(spellRoot(pc, template, accidentals))}
            </button>
          ))}
        </div>
      </div>
      {CHORD_TEMPLATE_GROUPS.map((group) => (
        <div className="explorer__section" key={group.id}>
          <div className="explorer__label">{groupName(group.id)}</div>
          <div className="explorer__types">
            {group.templates.map((tpl) => (
              <button
                key={tpl.suffix}
                className={`explorer-chip${tpl.suffix === suffix ? " explorer-chip--active" : ""}`}
                onClick={() => onSuffixChange(tpl.suffix)}
                aria-pressed={tpl.suffix === suffix}
                title={chordTypeName(tpl.suffix)}
              >
                {rootName(spellRoot(rootPc, tpl, accidentals))}{tpl.suffix}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// TOP BAR : onglets d'écran + paramètres
// ─────────────────────────────────────────────

const MODE_TABS = [
  { mode: "midi",    labelKey: "tabs.piano",    icon: "🎹" },
  { mode: "virtual", labelKey: "tabs.keyboard", icon: "👆" },
  { mode: "explore", labelKey: "tabs.chords",   icon: "📖" },
];

function TopBar({ mode, onModeChange, onOpenSettings }) {
  const { t } = useI18n();
  return (
    <header className="top-bar">
      <nav className="mode-tabs" role="tablist" aria-label={t("tabs.aria")}>
        {MODE_TABS.map((tab) => (
          <button
            key={tab.mode}
            role="tab"
            aria-selected={mode === tab.mode}
            className={`mode-tab${mode === tab.mode ? " mode-tab--active" : ""}`}
            onClick={() => onModeChange(tab.mode)}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>
      <button className="settings-btn" onClick={onOpenSettings} aria-label={t("settings.open")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  );
}

/** Solutions de secours proposées sous le bouton Bluetooth quand aucun piano n'est connecté. */
function NoPianoFallback({ onModeChange }) {
  const { t } = useI18n();
  return (
    <div className="no-piano">
      <span className="no-piano__label">{t("fallback.title")}</span>
      <div className="no-piano__actions">
        <button className="no-piano__btn" onClick={() => onModeChange("virtual")}>
          👆 {t("fallback.keyboard")}
        </button>
        <button className="no-piano__btn" onClick={() => onModeChange("explore")}>
          📖 {t("fallback.dictionary")}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SETTINGS DIALOG
// ─────────────────────────────────────────────

const APP_VERSION = import.meta.env.VITE_APP_VERSION;
const ACCIDENTALS_STORAGE_KEY = "instantchordbt.accidentals";
const LANGUAGE_STORAGE_KEY = "instantchordbt.language";
const SOUND_STORAGE_KEY = "instantchordbt.sound";
const INCOMPLETE_STORAGE_KEY = "instantchordbt.incomplete";

const ACCIDENTAL_OPTIONS = [
  { value: "sharp", symbol: "♯", labelKey: "settings.sharps" },
  { value: "flat",  symbol: "♭", labelKey: "settings.flats" },
];

const SOUND_OPTIONS = [
  { value: "on",  symbol: "🔊", labelKey: "settings.soundOn" },
  { value: "off", symbol: "🔇", labelKey: "settings.soundOff" },
];

// Accords incomplets : reconnaître un accord sans ses notes facultatives (quinte…)
const INCOMPLETE_OPTIONS = [
  { value: "on",  labelKey: "settings.yes" },
  { value: "off", labelKey: "settings.no" },
];

/** Réglage mémorisé dans le navigateur (valeur par défaut si absent ou invalide). */
function usePersistentSetting(storageKey, allowedValues, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return allowedValues.includes(stored) ? stored : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // stockage indisponible (navigation privée…) : le choix vaut pour la session
    }
  }, [storageKey, value]);

  return [value, setValue];
}

// Drapeaux en SVG : les emoji drapeaux ne s'affichent pas sous Windows
// (le système affiche les lettres « FR », « DE »… à la place).
// Affichés en 3:2 ; le drapeau britannique (2:1) est recadré au centre.
const FLAGS = {
  fr: (
    <svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice">
      <rect width="1" height="2" fill="#002654" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ce1126" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice">
      <clipPath id="flag-uk-diagonals">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" strokeWidth="4" clipPath="url(#flag-uk-diagonals)" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  ),
  de: (
    <svg viewBox="0 0 5 3" preserveAspectRatio="xMidYMid slice">
      <rect width="5" height="1" fill="#000" />
      <rect y="1" width="5" height="1" fill="#dd0000" />
      <rect y="2" width="5" height="1" fill="#ffce00" />
    </svg>
  ),
  es: (
    <svg viewBox="0 0 4 4" preserveAspectRatio="xMidYMid slice">
      <rect width="4" height="4" fill="#aa151b" />
      <rect y="1" width="4" height="2" fill="#f1bf00" />
    </svg>
  ),
};

function SettingsDialog({
  open, onClose, onLanguageChange, onAccidentalsChange, sound, onSoundChange, incomplete, onIncompleteChange,
}) {
  const { t, language, accidentals } = useI18n();
  const dialogRef = useRef(null);

  // <dialog> natif : fond assombri, Échap pour fermer, focus gardé dans la fenêtre
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="settings"
      onClose={onClose}
      // Un clic sur le fond (hors du contenu) ferme la fenêtre
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className="settings__content">
        <div className="settings__header">
          <h2 className="settings__title">{t("settings.title")}</h2>
          <button className="settings__close" onClick={onClose} aria-label={t("settings.close")}>✕</button>
        </div>

        <div className="settings__row">
          <span className="settings__label" id="settings-language">{t("settings.language")}</span>
          <div className="settings__choices settings__choices--flags" role="group" aria-labelledby="settings-language">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                lang={lang.code}
                className={`settings__choice${language === lang.code ? " settings__choice--active" : ""}`}
                onClick={() => onLanguageChange(lang.code)}
                aria-pressed={language === lang.code}
                aria-label={lang.name}
                title={lang.name}
              >
                <span className="settings__flag" aria-hidden="true">{FLAGS[lang.code]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings__row">
          <span className="settings__label" id="settings-accidentals">{t("settings.accidentals")}</span>
          <div className="settings__choices" role="group" aria-labelledby="settings-accidentals">
            {ACCIDENTAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings__choice${accidentals === opt.value ? " settings__choice--active" : ""}`}
                onClick={() => onAccidentalsChange(opt.value)}
                aria-pressed={accidentals === opt.value}
                aria-label={t(opt.labelKey)}
                title={t(opt.labelKey)}
              >
                <span className="settings__symbol" aria-hidden="true">{opt.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings__row">
          <span className="settings__label" id="settings-sound">{t("settings.sound")}</span>
          <div className="settings__choices" role="group" aria-labelledby="settings-sound">
            {SOUND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings__choice${sound === opt.value ? " settings__choice--active" : ""}`}
                onClick={() => onSoundChange(opt.value)}
                aria-pressed={sound === opt.value}
                aria-label={t(opt.labelKey)}
                title={t(opt.labelKey)}
              >
                <span className="settings__emoji" aria-hidden="true">{opt.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings__row">
          <span className="settings__label" id="settings-incomplete">{t("settings.incomplete")}</span>
          <p className="settings__hint">{t("settings.incompleteHint")}</p>
          <div className="settings__choices" role="group" aria-labelledby="settings-incomplete">
            {INCOMPLETE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings__choice${incomplete === opt.value ? " settings__choice--active" : ""}`}
                onClick={() => onIncompleteChange(opt.value)}
                aria-pressed={incomplete === opt.value}
              >
                <span className="settings__text">{t(opt.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings__footer">InstantChordBT · {t("settings.version")} {APP_VERSION}</div>
      </div>
    </dialog>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

const EMPTY_PIANO_NOTES = { held: new Set(), sustained: new Set(), pedal: false };

export default function ChordIdentifier() {
  // Notes du piano physique :
  // - held : touches enfoncées
  // - sustained : touches relâchées pendant que la pédale de sustain est enfoncée
  //   (elles sonnent encore, donc elles comptent pour l'accord)
  const [pianoNotes, setPianoNotes] = useState(EMPTY_PIANO_NOTES);

  const handleNoteOn = useCallback((note) => {
    setPianoNotes(prev => {
      const held = new Set(prev.held).add(note);
      const sustained = new Set(prev.sustained);
      sustained.delete(note);
      return { ...prev, held, sustained };
    });
  }, []);

  const handleNoteOff = useCallback((note) => {
    setPianoNotes(prev => {
      const held = new Set(prev.held);
      held.delete(note);
      const sustained = prev.pedal ? new Set(prev.sustained).add(note) : prev.sustained;
      return { ...prev, held, sustained };
    });
  }, []);

  const handleSustain = useCallback((down) => {
    setPianoNotes(prev => {
      if (down === prev.pedal) return prev;
      // Pédale relâchée : les notes qu'elle tenait s'arrêtent
      return down ? { ...prev, pedal: true } : { ...prev, pedal: false, sustained: new Set() };
    });
  }, []);

  const pressedNotes = useMemo(
    () => new Set([...pianoNotes.held, ...pianoNotes.sustained]),
    [pianoNotes]
  );

  const {
    btStatus,
    btError,
    btKnownDevice,
    requestBluetoothMIDI,
    reconnectBluetooth,
    disconnectBluetooth,
  } = useBluetoothMIDI({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff, onSustain: handleSustain });

  const midi = useMIDI(handleNoteOn, handleNoteOff, handleSustain);
  const midiDevicesKey = midi.devices.join("\n");

  useEffect(() => {
    // À chaque changement de connexion (Bluetooth coupé, câble débranché…),
    // évite de garder des notes "bloquées".
    const timer = setTimeout(() => setPianoNotes(EMPTY_PIANO_NOTES), 0);
    return () => clearTimeout(timer);
  }, [btStatus, midiDevicesKey]);

  // Mode d'affichage : "midi" (piano connecté), "virtual" (clavier virtuel)
  // ou "explore" (dictionnaire : choisir un accord pour voir ses touches)
  const [mode, setMode] = useState("midi");
  const virtualMode = mode === "virtual";
  const exploreMode = mode === "explore";

  // Mode clavier virtuel : notes séparées de celles du piano physique,
  // pour qu'un note-off MIDI ne relâche pas une touche cliquée à l'écran.
  const [virtualNotes, setVirtualNotes] = useState(new Set());

  // Une touche enfoncée joue sa note ; relâchée, elle est étouffée.
  // (Le son est déclenché hors du updater de setState, que StrictMode exécute deux fois.)
  const toggleVirtualNote = useCallback((note) => {
    if (virtualNotes.has(note)) stopPianoNote(note);
    else playPianoNote(note);
    setVirtualNotes(prev => {
      const next = new Set(prev);
      if (next.has(note)) next.delete(note);
      else next.add(note);
      return next;
    });
  }, [virtualNotes]);

  const clearVirtualNotes = useCallback(() => {
    stopAllPianoNotes();
    setVirtualNotes(new Set());
  }, []);

  const changeMode = (target) => {
    setMode(target);
    clearVirtualNotes();
  };

  // Paramètres (mémorisés pour les ouvertures suivantes)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = usePersistentSetting(LANGUAGE_STORAGE_KEY, LANGUAGE_CODES, DEFAULT_LANGUAGE);
  const [accidentals, setAccidentals] = usePersistentSetting(ACCIDENTALS_STORAGE_KEY, ACCIDENTALS, DEFAULT_ACCIDENTALS);
  const [sound, setSound] = usePersistentSetting(SOUND_STORAGE_KEY, ["on", "off"], "on");
  const [incomplete, setIncomplete] = usePersistentSetting(INCOMPLETE_STORAGE_KEY, ["on", "off"], "on");

  useEffect(() => {
    setPianoSoundEnabled(sound === "on");
  }, [sound]);

  const i18n = useMemo(() => createI18n(language, accidentals), [language, accidentals]);
  const { t, inversionLabel } = i18n;

  // Langue du document (lecteurs d'écran, césure, traduction automatique du navigateur)
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Explorateur d'accords
  const [exploreRoot, setExploreRoot] = useState(0); // Do
  const [exploreSuffix, setExploreSuffix] = useState(""); // majeur
  const [exploreInversion, setExploreInversion] = useState(0);

  const exploreTemplate = CHORD_TEMPLATES.find(t => t.suffix === exploreSuffix);
  const exploreVoicing = buildChordVoicing(exploreRoot, exploreTemplate, exploreInversion);
  const exploreChord = describeVoicing(exploreRoot, exploreTemplate, exploreVoicing, accidentals);
  const exploreNotes = exploreVoicing.map(n => n.midi);
  const exploreActive = new Set(exploreNotes);

  // Chaque choix dans le dictionnaire fait entendre l'accord en arpège.
  const playExploreChord = (rootPc, template, inversion) => {
    playPianoArpeggio(buildChordVoicing(rootPc, template, inversion).map(n => n.midi));
  };

  const changeExploreRoot = (pc) => {
    setExploreRoot(pc);
    setExploreInversion(0);
    playExploreChord(pc, exploreTemplate, 0);
  };

  const changeExploreSuffix = (suffix) => {
    setExploreSuffix(suffix);
    setExploreInversion(0);
    playExploreChord(exploreRoot, CHORD_TEMPLATES.find(t => t.suffix === suffix), 0);
  };

  const nextInversion = () => {
    const inversion = (exploreInversion + 1) % inversionCount(exploreTemplate);
    setExploreInversion(inversion);
    playExploreChord(exploreRoot, exploreTemplate, inversion);
  };

  // Écran de démarrage sans piano : toujours proposer la connexion (valeur ajoutée de l'appli),
  // y compris quand Web MIDI est indisponible ; le clavier virtuel et le dictionnaire
  // ne sont que des solutions de secours.
  // (Aussi pendant que Web MIDI attend : la demande d'autorisation du navigateur
  // peut rester sans réponse, et le Bluetooth ne doit pas en dépendre.)
  const showBluetoothButton =
    mode === "midi" &&
    btStatus !== "connected" &&
    midi.status !== "connected";

  // Compute chords whenever pressed notes change
  const midiArray = [...(virtualMode ? virtualNotes : pressedNotes)];
  const chords = identifyChords(midiArray, accidentals, { allowIncomplete: incomplete === "on" });

  const primaryChord = chords[0] ?? null;
  const secondaryChords = chords.slice(1);

  // Pas d'accord reconnu : un point par touche enfoncée à la place du nom
  const pendingChordPlaceHolder =
    midiArray.length > 0 && !primaryChord
      ? {
          placeholder: ".".repeat(midiArray.length),
          suffix: "",
          isInversion: false,
          noteIntervalPairs: buildPendingNotePairs(midiArray, accidentals),
        }
      : null;

  // Noms des touches enfoncées du clavier virtuel, orthographiés selon l'accord affiché
  const virtualNoteLabels = new Map(
    (primaryChord ?? pendingChordPlaceHolder)?.noteIntervalPairs.map((p) => [p.pc, p.note]) ?? []
  );

  // ── Render ────────────────────────────────
  return (
    <I18nContext.Provider value={i18n}>
      <div className={`app${mode !== "midi" ? " app--keyboard" : ""}`}>

        <TopBar
          mode={mode}
          onModeChange={changeMode}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* ── MIDI Status (écran Piano uniquement) ── */}
        {mode === "midi" && (
          <ConnectionStatus
            btStatus={btStatus}
            btKnownDevice={btKnownDevice}
            midi={midi}
            onDisconnect={disconnectBluetooth}
          />
        )}

        {/* ── Main display area ── */}
        <div className="display-area">

          {showBluetoothButton && (
            <div className="connect-screen">
              <h2 className="connect-screen__title">{t("connect.title")}</h2>
              <BluetoothMIDIButton
                btStatus={btStatus}
                btError={btError}
                knownDevice={btKnownDevice}
                onConnect={requestBluetoothMIDI}
                onReconnect={reconnectBluetooth}
              />
              <UsbHint midiStatus={midi.status} />
              <NoPianoFallback onModeChange={changeMode} />
            </div>
          )}

          {exploreMode ? (
            <>
              {/* Carte compacte : les sélecteurs doivent tenir sous elle sur mobile */}
              <ChordCard chord={exploreChord} size="secondary" className="chord-card--explore" />
              <ChordExplorer
                rootPc={exploreRoot}
                template={exploreTemplate}
                onRootChange={changeExploreRoot}
                onSuffixChange={changeExploreSuffix}
              />
            </>
          ) : midiArray.length === 0 ? (
            !showBluetoothButton && (
              <div className="idle-state">
                <span className="idle-icon">🎹</span>
                <span className="idle-text">
                  {virtualMode ? t("idle.touch") : t("idle.play")}
                </span>
              </div>
            )
          ) : (
            <>
              {primaryChord ? (
                <ChordCard chord={primaryChord} size="primary" />
              ) : (
                pendingChordPlaceHolder && (
                  <ChordCard chord={pendingChordPlaceHolder} size="primary" isPending />
                )
              )}
              {primaryChord && secondaryChords.length > 0 && (
                <div className="secondary-chords">
                  <div className="secondary-label">{t("chord.alternatives")}</div>
                  <div className="secondary-list">
                    {secondaryChords.map((c, i) => (
                      <ChordCard key={i} chord={c} size="secondary" />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {virtualMode && (
          <VirtualKeyboard
            activeNotes={virtualNotes}
            onKeyClick={toggleVirtualNote}
            noteLabels={virtualNoteLabels}
            toolbar={
              <>
                <span className="virtual-kb__hint">{t("keyboard.hint")}</span>
                <button
                  className="virtual-kb__clear"
                  onClick={clearVirtualNotes}
                  disabled={virtualNotes.size === 0}
                >
                  {t("keyboard.clear")}
                </button>
              </>
            }
          />
        )}

        {exploreMode && (
          <VirtualKeyboard
            activeNotes={exploreActive}
            scrollToNotes={exploreNotes}
            noteLabels={new Map(exploreChord.noteIntervalPairs.map((p) => [p.pc, p.note]))}
            toolbar={
              <>
                <span className="virtual-kb__hint">{inversionLabel(exploreInversion)}</span>
                <button className="virtual-kb__action" onClick={nextInversion}>
                  {t("keyboard.invert")}
                </button>
              </>
            }
          />
        )}

        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onLanguageChange={setLanguage}
          onAccidentalsChange={setAccidentals}
          sound={sound}
          onSoundChange={setSound}
          incomplete={incomplete}
          onIncompleteChange={setIncomplete}
        />

      </div>
    </I18nContext.Provider>
  );
}

// ─────────────────────────────────────────────
// CHORD CARD SUB-COMPONENT
// ─────────────────────────────────────────────

function ChordCard({ chord, size, isPending = false, className = "" }) {
  const { t, noteName, rootName, chordTypeName } = useI18n();
  // Split chord name into root + suffix + inversion for styled rendering.
  // Fondamentale et basse nommées selon la langue (H/B en allemand).
  const rootPart = isPending ? chord.placeholder : rootName(chord.root);
  const suffixPart = chord.suffix;
  const inversionPart = chord.isInversion ? `/${rootName(chord.bass)}` : "";

  return (
    <div
      className={`chord-card chord-card--${size}${isPending ? " chord-card--pending" : ""}${className ? ` ${className}` : ""}`}
    >

      {/* Chord name — very large */}
      <div className="chord-name">
        <span className="chord-root">{rootPart}</span>
        {suffixPart && <span className="chord-suffix">{suffixPart}</span>}
        {inversionPart && <span className="chord-inversion">{inversionPart}</span>}
      </div>

      {/* Note / Interval table — 2 rows × N columns */}
      <div
        className="chord-table"
        style={{ gridTemplateColumns: `repeat(${chord.noteIntervalPairs.length}, 1fr)` }}
      >
        {/* Placement explicite (colonne i, ligne 1 ou 2) : les parenthèses d'une
            note non jouée se superposent à sa colonne sur les deux lignes. */}
        {chord.noteIntervalPairs.map((pair, i) => (
          <span
            key={`n${i}`}
            className={`chord-table__note${pair.missing ? " chord-table__note--missing" : ""}`}
            style={{ gridColumn: i + 1, gridRow: 1 }}
          >
            {noteName(pair.note)}
          </span>
        ))}
        {chord.noteIntervalPairs.map((pair, i) => (
          <span
            key={`i${i}`}
            className={`chord-table__interval${pair.missing ? " chord-table__interval--missing" : ""}`}
            style={{ gridColumn: i + 1, gridRow: 2 }}
          >
            {pair.interval}
          </span>
        ))}
        {/* Note facultative non jouée : entre deux grandes parenthèses */}
        {chord.noteIntervalPairs.map((pair, i) => pair.missing && (
          <span
            key={`p${i}`}
            className="chord-table__brackets"
            style={{ gridColumn: i + 1, gridRow: "1 / 3" }}
            aria-hidden="true"
          >
            <span>(</span><span>)</span>
          </span>
        ))}
      </div>

      {/* Human-readable label */}
      <div className="chord-type">{isPending ? t("chord.unknown") : chordTypeName(chord.suffix)}</div>
    </div>
  );
}