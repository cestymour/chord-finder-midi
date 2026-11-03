import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useId } from "react";
import './App.css';
import useBluetoothMIDI from "./useBluetoothMIDI";
import { dispatchMidiMessage } from "./midiMessages";
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

// Ports MIDI virtuels du système (« Midi Through » sous Linux) : ce ne sont pas des instruments.
const VIRTUAL_MIDI_PORT = /\bthrough\b/i;

/**
 * Entrées Web MIDI : câble USB, ou piano Bluetooth jumelé au niveau du système.
 * Chaque callback reçoit d'abord la source (`midi:<id du port>`), pour que les notes
 * et la pédale de chaque instrument restent séparées. onRelease(source) signale un port
 * disparu : ses touches tenues ne recevront plus de note off.
 *
 * L'accès n'est demandé tout seul que s'il est déjà accordé (permissions.query) :
 * sinon, la demande du navigateur arriverait à l'ouverture, sans explication.
 * requestAccess() la déclenche sur un geste de l'utilisateur (bouton « Autoriser »).
 *
 * Retourne { status, devices, requestAccess } :
 * - status : "pending" | "prompt" (accès à demander) | "connected" | "disconnected"
 *   | "denied" (accès refusé) | "unsupported"
 * - devices : noms des instruments écoutés
 */
function useMIDI(callbacks) {
  const [midiState, setMidiState] = useState(() => ({
    status: navigator.requestMIDIAccess ? "pending" : "unsupported",
    devices: [],
  }));

  // Callbacks lus au moment du message : l'accès MIDI n'est demandé qu'une fois.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Demande d'accès, fournie par l'effet ci-dessous (appelée sur un geste de l'utilisateur)
  const requestRef = useRef(() => {});
  const requestAccess = useCallback(() => requestRef.current(), []);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return; // état initial "unsupported"

    let cancelled = false;
    let access = null;
    let requested = false; // demande en cours ou accordée
    let permission = null; // PermissionStatus "midi", si le navigateur le fournit
    let inputs = new Map(); // source → port écouté

    const handleMidiMessage = (event) => {
      const [status, data1 = 0, data2 = 0] = event.data;
      const source = `midi:${event.currentTarget?.id ?? event.target?.id}`;
      const { onNoteOn, onNoteOff, onSustain } = callbacksRef.current;
      dispatchMidiMessage(status, data1, data2, {
        onNoteOn: (note) => onNoteOn(source, note),
        onNoteOff: (note) => onNoteOff(source, note),
        onSustain: (down) => onSustain(source, down),
      });
    };

    const attachListeners = () => {
      const next = new Map();
      const names = new Set();
      access.inputs.forEach(input => {
        if (input.state === "disconnected" || VIRTUAL_MIDI_PORT.test(input.name ?? "")) return;
        input.onmidimessage = handleMidiMessage;
        next.set(`midi:${input.id}`, input);
        names.add(input.name || "MIDI");
      });
      // Ports disparus : on ne les écoute plus, et seules leurs notes sont relâchées
      // (brancher ou débrancher un autre instrument ne touche pas à l'accord en cours).
      inputs.forEach((input, source) => {
        if (next.has(source)) return;
        input.onmidimessage = null;
        callbacksRef.current.onRelease(source);
      });
      inputs = next;

      const devices = [...names];
      setMidiState(prev =>
        prev.devices.join("\n") === devices.join("\n") && prev.status !== "pending"
          ? prev
          : { status: devices.length > 0 ? "connected" : "disconnected", devices }
      );
    };

    const request = () => {
      if (requested || cancelled) return;
      requested = true;
      setMidiState({ status: "pending", devices: [] });
      navigator.requestMIDIAccess()
        .then(midiAccess => {
          if (cancelled) return;
          access = midiAccess;
          attachListeners();
          access.onstatechange = attachListeners;
        })
        .catch(() => {
          if (cancelled) return;
          requested = false;
          // Demande fermée sans répondre : on la propose de nouveau. Sinon, accès refusé.
          const state = permission?.state === "prompt" ? "prompt" : "denied";
          setMidiState({ status: state, devices: [] });
        });
    };
    requestRef.current = request;

    // Autorisation déjà accordée : écoute immédiate. À demander : bouton « Autoriser ».
    // Un changement dans les paramètres du site est suivi (onchange).
    const applyPermission = (state) => {
      if (cancelled || requested) return;
      if (state === "granted") request();
      else setMidiState({ status: state === "denied" ? "denied" : "prompt", devices: [] });
    };

    (async () => {
      try {
        permission = await navigator.permissions.query({ name: "midi" });
      } catch {
        permission = null; // autorisation "midi" inconnue de ce navigateur
      }
      if (cancelled) return;
      if (!permission) {
        applyPermission("prompt");
        return;
      }
      permission.onchange = () => applyPermission(permission.state);
      applyPermission(permission.state);
    })();

    return () => {
      cancelled = true;
      if (permission) permission.onchange = null;
      if (access) access.onstatechange = null;
      inputs.forEach((input, source) => {
        input.onmidimessage = null;
        callbacksRef.current.onRelease(source);
      });
      inputs = new Map();
    };
  }, []);

  return { ...midiState, requestAccess };
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
  const offerReconnect = knownDevice && !isLoading;

  // Sélecteur fermé sans choix : simple conseil, pas une erreur
  let notice = null;
  if (btStatus === "lost") notice = { key: "bt.lost", tone: "error" };
  else if (btStatus === "error" && btError) {
    notice = { key: `bt.error.${btError}`, tone: btError === "cancelled" ? "hint" : "error" };
  }

  // Navigateur sans Web Bluetooth (iPhone, Firefox…) : pas de gros bouton inutile,
  // seulement le message ; les solutions de secours passent au premier plan.
  if (btStatus === "unsupported") {
    return (
      <div className="bt-connect-container">
        <InfoTip tone="warn" label={t("bt.unsupported")}>{t("bt.unsupported.help")}</InfoTip>
      </div>
    );
  }

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

      {/* Message court ; l'explication s'ouvre avec le bouton ⓘ.
          (key : un nouveau message repart fermé) */}
      {notice && (
        <InfoTip key={notice.key} tone={notice.tone} label={t(notice.key)}>
          {t(`${notice.key}.help`)}
        </InfoTip>
      )}

      {offerReconnect && (
        <button className="bt-connect-other" onClick={onConnect}>
          {t("bt.other")}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BULLES D'INFORMATION : les longues explications restent cachées
// derrière un bouton ⓘ, pour garder des écrans épurés.
// ─────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** Bouton ⓘ seul (ouvre ou ferme la bulle associée, identifiée par bubbleId). */
function InfoButton({ open, onToggle, bubbleId }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`info-btn${open ? " info-btn--open" : ""}`}
      aria-expanded={open}
      aria-controls={bubbleId}
      aria-label={t("info.more")}
      title={t("info.more")}
      onClick={onToggle}
    >
      <InfoIcon />
    </button>
  );
}

function InfoBubble({ id, children }) {
  return <p id={id} className="info-bubble">{children}</p>;
}

/** Libellé court suivi d'un bouton ⓘ ; l'explication (children) s'affiche dessous. */
function InfoTip({ label, children, tone, className = "" }) {
  const [open, setOpen] = useState(false);
  const bubbleId = useId();
  return (
    <div className={`info-tip${tone ? ` info-tip--${tone}` : ""}${className ? ` ${className}` : ""}`}>
      <div className="info-tip__head">
        <span className="info-tip__label">{label}</span>
        <InfoButton open={open} onToggle={() => setOpen((o) => !o)} bubbleId={bubbleId} />
      </div>
      {open && <InfoBubble id={bubbleId}>{children}</InfoBubble>}
    </div>
  );
}

/** Interrupteur marche/arrêt (son, accords incomplets). */
function Switch({ checked, onChange, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      className={`switch${checked ? " switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__thumb" />
    </button>
  );
}

const USB_TEXT_KEYS = { denied: "usb.denied", unsupported: "usb.unsupported", prompt: "usb.prompt" };

/**
 * Branchement par câble : détecté tout seul par Web MIDI une fois l'accès accordé.
 * Accès pas encore demandé : bouton « Autoriser » (onAllow), qui ouvre la demande du navigateur.
 */
function UsbHint({ midiStatus, onAllow }) {
  const { t } = useI18n();
  const textKey = USB_TEXT_KEYS[midiStatus] ?? "usb.hint";
  const warn = midiStatus === "denied" || midiStatus === "unsupported";
  return (
    <>
      <InfoTip className="usb-hint" tone={warn ? "warn" : undefined} label={<>🔌 {t("usb.title")}</>}>
        {t(textKey)}
      </InfoTip>
      {midiStatus === "prompt" && (
        <button className="usb-allow" onClick={onAllow}>
          {t("usb.allow")}
        </button>
      )}
    </>
  );
}

/**
 * Ligne d'état sous les onglets (écran Piano) : nom du piano connecté et moyen de connexion.
 * onConnect (clavier virtuel choisi, aucun piano) : bouton qui ramène à l'écran de connexion,
 * pour que la connexion du piano reste toujours proposée.
 */
function ConnectionStatus({ btStatus, btKnownDevice, midi, onDisconnect, onConnect }) {
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
  } else if (onConnect) {
    // Clavier virtuel choisi sans piano : état neutre (l'absence de MIDI n'est pas une erreur ici)
    status = "virtual";
    label = t("status.virtual");
  } else if (midi.status === "prompt") {
    status = "disconnected";
    label = t("midi.disconnected");
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
      {!bluetooth && status !== "connected" && onConnect && (
        <button className="midi-status__action" onClick={onConnect}>
          {t("status.connect")}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// VIRTUAL KEYBOARD COMPONENT (écran Piano et explorateur d'accords)
// ─────────────────────────────────────────────

// Clavier de piano complet (88 touches, La0 à Do8 en convention anglaise),
// dont 2 octaves visibles sur écran étroit, le reste par défilement horizontal.
const VIRTUAL_KB_FIRST_NOTE = 21;
const VIRTUAL_KB_KEY_COUNT = 88;
// Touche placée à gauche à l'ouverture : Do2 en convention française (C3 en anglais)
const VIRTUAL_KB_START_NOTE = 48;

// Disposition statique du clavier, calculée une seule fois
const VK_NOTES = Array.from(
  { length: VIRTUAL_KB_KEY_COUNT },
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
 * Clavier de 88 touches défilant horizontalement.
 * - activeNotes : touches allumées (couleur pleine)
 * - onKeyClick  : absent → clavier en lecture seule
 * - scrollToNotes : notes à garder visibles (défilement automatique ; si l'accord
 *   est trop large, les notes aiguës peuvent rester masquées)
 * - noteLabels : Map classe de hauteur → note orthographiée (noms des touches
 *   enfoncées selon l'accord : Si♯ et non Do dans Mi augmenté)
 */
function VirtualKeyboard({ activeNotes, onKeyClick, scrollToNotes, noteLabels, toolbar }) {
  const { keyLabel, noteName, pcName } = useI18n();
  const scrollerRef = useRef(null);
  const interactive = Boolean(onKeyClick);
  const KeyTag = interactive ? "button" : "div";

  // À l'ouverture, le clavier montre la zone centrale (Do2 à gauche), sans animation.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = (VK_KEY_SPANS.get(VIRTUAL_KB_START_NOTE).left / 100) * el.scrollWidth;
  }, []);

  // Bref éclat de la touche quand sa note sonne (synchronisé avec l'arpège).
  useEffect(() => subscribePianoNotes((midi, delay) => {
    const key = scrollerRef.current?.querySelector(`[data-midi="${midi}"]`);
    key?.animate(
      [{ filter: "brightness(1.7)", boxShadow: "0 0 22px #7fffd4" }, {}],
      { duration: 450, delay: delay * 1000, easing: "ease-out" }
    );
  }), []);

  // Un clavier MIDI transposé peut envoyer des notes hors des 88 touches : ignorées.
  const scrollNotes = scrollToNotes?.filter((n) => VK_KEY_SPANS.has(n)) ?? [];
  useScrollIntoView(
    scrollerRef,
    scrollNotes.length ? Math.min(...scrollNotes) : null,
    scrollNotes.length ? Math.max(...scrollNotes) : null
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
        <div
          className="virtual-kb__keys"
          aria-hidden={interactive ? undefined : true}
          style={{ "--vk-white-keys": VK_WHITE_NOTES.length }}
        >
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
      {/* Fondamentales hors de la zone qui défile : toujours visibles, sans titre */}
      <div className="explorer__roots" role="group" aria-label={t("explorer.root")}>
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
      <div className="explorer__scroll">
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
    </div>
  );
}

// ─────────────────────────────────────────────
// TOP BAR : onglets d'écran + paramètres
// ─────────────────────────────────────────────

const MODE_TABS = [
  { mode: "midi",    labelKey: "tabs.piano",  icon: "🎹" },
  { mode: "explore", labelKey: "tabs.chords", icon: "📖" },
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

/**
 * Solution de secours proposée sous le bouton Bluetooth quand aucun piano n'est connecté
 * (le dictionnaire reste accessible par l'onglet Accords).
 * prominent : mise en avant (navigateur sans Bluetooth, où elle devient l'essentiel).
 */
function NoPianoFallback({ onUseKeyboard, prominent }) {
  const { t } = useI18n();
  return (
    <div className={`no-piano${prominent ? " no-piano--prominent" : ""}`}>
      <span className="no-piano__label">{t("fallback.title")}</span>
      <div className="no-piano__actions">
        <button className="no-piano__btn" onClick={onUseKeyboard}>
          🎹 {t("fallback.keyboard")}
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

// Auteur et dépôt (licence MIT, voir le fichier LICENSE)
const APP_AUTHOR = "cestymour";
const APP_REPOSITORY = "https://github.com/cestymour/chord-finder-midi";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

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
  const [incompleteInfo, setIncompleteInfo] = useState(false);
  const incompleteInfoId = useId();
  const [accidentalsInfo, setAccidentalsInfo] = useState(false);
  const accidentalsInfoId = useId();

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
          <div className="settings__row--inline">
            <span className="settings__label-group">
              <span className="settings__label" id="settings-accidentals">{t("settings.accidentals")}</span>
              {/* Pourquoi des bémols restent affichés avec les dièses (et inversement) */}
              <InfoButton
                open={accidentalsInfo}
                onToggle={() => setAccidentalsInfo((o) => !o)}
                bubbleId={accidentalsInfoId}
              />
            </span>
            <div className="settings__segmented" role="group" aria-labelledby="settings-accidentals">
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
          {accidentalsInfo && <InfoBubble id={accidentalsInfoId}>{t("settings.accidentalsHint")}</InfoBubble>}
        </div>

        <div className="settings__row settings__row--inline">
          <span className="settings__label" id="settings-sound">{t("settings.sound")}</span>
          <Switch
            checked={sound === "on"}
            onChange={(on) => onSoundChange(on ? "on" : "off")}
            labelledBy="settings-sound"
          />
        </div>

        <div className="settings__row">
          <div className="settings__row--inline">
            <span className="settings__label-group">
              <span className="settings__label" id="settings-incomplete">{t("settings.incomplete")}</span>
              <InfoButton
                open={incompleteInfo}
                onToggle={() => setIncompleteInfo((o) => !o)}
                bubbleId={incompleteInfoId}
              />
            </span>
            <Switch
              checked={incomplete === "on"}
              onChange={(on) => onIncompleteChange(on ? "on" : "off")}
              labelledBy="settings-incomplete"
            />
          </div>
          {incompleteInfo && <InfoBubble id={incompleteInfoId}>{t("settings.incompleteHint")}</InfoBubble>}
        </div>

        <footer className="settings__footer">
          <div className="settings__app">
            InstantChordBT <span className="settings__version">{t("settings.version")} {APP_VERSION}</span>
          </div>
          <div className="settings__credits">
            <a
              className="settings__author"
              href={APP_REPOSITORY}
              target="_blank"
              rel="noopener noreferrer"
              title={t("settings.source")}
            >
              <GitHubIcon />
              {APP_AUTHOR}
            </a>
            <span aria-hidden="true">·</span>
            <a href={`${APP_REPOSITORY}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
              {t("settings.license")}
            </a>
          </div>
        </footer>
      </div>
    </dialog>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

const EMPTY_SOURCE_NOTES = { held: new Set(), sustained: new Set(), pedal: false };
const BLUETOOTH_SOURCE = "bt";

export default function ChordIdentifier() {
  // Notes des pianos physiques, par source ("bt" ou "midi:<id du port>") :
  // - held : touches enfoncées
  // - sustained : touches relâchées pendant que la pédale de sustain de ce piano est enfoncée
  //   (elles sonnent encore, donc elles comptent pour l'accord)
  // Chaque source a sa pédale, et une source coupée ne relâche que ses propres notes.
  const [pianoSources, setPianoSources] = useState(() => new Map());

  const updateSource = useCallback((source, update) => {
    setPianoSources(prev => {
      const current = prev.get(source) ?? EMPTY_SOURCE_NOTES;
      const next = update(current);
      if (next === current) return prev;
      return new Map(prev).set(source, next);
    });
  }, []);

  // Source coupée (piano déconnecté, câble débranché) : ses touches ne recevront plus
  // de note off, on les relâche pour qu'elles ne restent pas bloquées.
  const releaseSource = useCallback((source) => {
    setPianoSources(prev => {
      if (!prev.has(source)) return prev;
      const next = new Map(prev);
      next.delete(source);
      return next;
    });
  }, []);

  // Touches cliquées sur le clavier virtuel : ensemble séparé des notes du piano,
  // pour qu'un note-off MIDI ne relâche pas une touche cliquée à l'écran.
  // La ref est la valeur à jour (modifiée en même temps que l'état, à chaque changement) :
  // deux touchers rapides, avant le rendu, partent bien chacun du résultat du précédent.
  const [virtualNotes, setVirtualNotes] = useState(() => new Set());
  const virtualNotesRef = useRef(virtualNotes);

  const clearVirtualNotes = useCallback(() => {
    stopAllPianoNotes();
    virtualNotesRef.current = new Set();
    setVirtualNotes(virtualNotesRef.current);
  }, []);

  const handleNoteOn = useCallback((source, note) => {
    // Jouer sur le vrai piano efface les touches cliquées : pas de mélange des deux sources.
    if (virtualNotesRef.current.size > 0) clearVirtualNotes();
    updateSource(source, prev => {
      const held = new Set(prev.held).add(note);
      const sustained = new Set(prev.sustained);
      sustained.delete(note);
      return { ...prev, held, sustained };
    });
  }, [clearVirtualNotes, updateSource]);

  const handleNoteOff = useCallback((source, note) => {
    updateSource(source, prev => {
      if (!prev.held.has(note)) return prev;
      const held = new Set(prev.held);
      held.delete(note);
      const sustained = prev.pedal ? new Set(prev.sustained).add(note) : prev.sustained;
      return { ...prev, held, sustained };
    });
  }, [updateSource]);

  const handleSustain = useCallback((source, down) => {
    updateSource(source, prev => {
      if (down === prev.pedal) return prev;
      // Pédale relâchée : les notes qu'elle tenait s'arrêtent
      return down ? { ...prev, pedal: true } : { ...prev, pedal: false, sustained: new Set() };
    });
  }, [updateSource]);

  const pressedNotes = useMemo(() => {
    const notes = new Set();
    pianoSources.forEach(({ held, sustained }) => {
      held.forEach(n => notes.add(n));
      sustained.forEach(n => notes.add(n));
    });
    return notes;
  }, [pianoSources]);

  const bluetoothCallbacks = useMemo(() => ({
    onNoteOn: (note) => handleNoteOn(BLUETOOTH_SOURCE, note),
    onNoteOff: (note) => handleNoteOff(BLUETOOTH_SOURCE, note),
    onSustain: (down) => handleSustain(BLUETOOTH_SOURCE, down),
    onRelease: () => releaseSource(BLUETOOTH_SOURCE),
  }), [handleNoteOn, handleNoteOff, handleSustain, releaseSource]);

  const {
    btStatus,
    btError,
    btKnownDevice,
    requestBluetoothMIDI,
    reconnectBluetooth,
    disconnectBluetooth,
  } = useBluetoothMIDI(bluetoothCallbacks);

  const midiCallbacks = useMemo(() => ({
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
    onSustain: handleSustain,
    onRelease: releaseSource,
  }), [handleNoteOn, handleNoteOff, handleSustain, releaseSource]);

  const midi = useMIDI(midiCallbacks);

  const pianoConnected = btStatus === "connected" || midi.status === "connected";
  // Coupure Bluetooth en cours de reconnexion automatique : l'écran Piano reste affiché
  // (seule la ligne d'état change), au lieu de basculer sur l'écran de connexion.
  const pianoLinked = pianoConnected || btStatus === "reconnecting";

  // Écran affiché : "midi" (onglet Piano : vrai piano et/ou clavier virtuel)
  // ou "explore" (dictionnaire : choisir un accord pour voir ses touches)
  const [mode, setMode] = useState("midi");
  const exploreMode = mode === "explore";

  // Sans piano, le clavier virtuel n'apparaît que si l'utilisateur le demande
  // (la connexion du piano reste la proposition principale).
  const [keyboardChosen, setKeyboardChosen] = useState(false);
  const showKeyboard = mode === "midi" && (pianoLinked || keyboardChosen);

  // Clavier masqué (piano déconnecté sans clavier choisi) : ses touches cliquées
  // ne doivent ni rester sonores ni compter pour l'accord.
  useEffect(() => {
    if (!showKeyboard && virtualNotesRef.current.size > 0) clearVirtualNotes();
  }, [showKeyboard, clearVirtualNotes]);

  // Une touche enfoncée joue sa note ; relâchée, elle est étouffée.
  // (Le son est déclenché hors du updater de setState, que StrictMode exécute deux fois.)
  const toggleVirtualNote = useCallback((note) => {
    const next = new Set(virtualNotesRef.current);
    if (next.has(note)) {
      next.delete(note);
      stopPianoNote(note);
    } else {
      next.add(note);
      playPianoNote(note);
    }
    virtualNotesRef.current = next;
    setVirtualNotes(next);
  }, []);

  const changeMode = (target) => {
    if (target === mode) return; // onglet déjà actif : garder les touches cliquées
    setMode(target);
    clearVirtualNotes();
  };

  const showConnectScreen = () => {
    setKeyboardChosen(false);
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
  // Calculé seulement sur l'écran Dictionnaire, et pas à chaque note jouée sur le piano.
  const explore = useMemo(() => {
    if (!exploreMode) return null;
    const voicing = buildChordVoicing(exploreRoot, exploreTemplate, exploreInversion);
    const notes = voicing.map(n => n.midi);
    return {
      chord: describeVoicing(exploreRoot, exploreTemplate, voicing, accidentals),
      notes,
      active: new Set(notes),
    };
  }, [exploreMode, exploreRoot, exploreTemplate, exploreInversion, accidentals]);

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
  const showBluetoothButton = mode === "midi" && !showKeyboard;

  // Accord calculé sur les touches du piano et celles cliquées à l'écran
  const playedNotes = useMemo(
    () => new Set([...pressedNotes, ...virtualNotes]),
    [pressedNotes, virtualNotes]
  );
  const midiArray = useMemo(
    () => (exploreMode ? [] : [...playedNotes]),
    [exploreMode, playedNotes]
  );
  const allowIncomplete = incomplete === "on";
  const chords = useMemo(
    () => identifyChords(midiArray, accidentals, { allowIncomplete }),
    [midiArray, accidentals, allowIncomplete]
  );

  const primaryChord = chords[0] ?? null;
  const secondaryChords = chords.slice(1);

  // Pas d'accord reconnu : un point par touche enfoncée à la place du nom
  const pendingChordPlaceHolder = useMemo(
    () =>
      midiArray.length > 0 && !primaryChord
        ? {
            placeholder: ".".repeat(midiArray.length),
            suffix: "",
            isInversion: false,
            noteIntervalPairs: buildPendingNotePairs(midiArray, accidentals),
          }
        : null,
    [midiArray, primaryChord, accidentals]
  );

  // Noms des touches enfoncées du clavier virtuel, orthographiés selon l'accord affiché
  const virtualNoteLabels = useMemo(
    () => new Map(
      (primaryChord ?? pendingChordPlaceHolder)?.noteIntervalPairs.map((p) => [p.pc, p.note]) ?? []
    ),
    [primaryChord, pendingChordPlaceHolder]
  );

  const exploreNoteLabels = useMemo(
    () => new Map(explore?.chord.noteIntervalPairs.map((p) => [p.pc, p.note]) ?? []),
    [explore]
  );

  // ── Render ────────────────────────────────
  return (
    <I18nContext.Provider value={i18n}>
      <div className={`app${showKeyboard || exploreMode ? " app--keyboard" : ""}`}>

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
            onConnect={showKeyboard && !pianoLinked ? showConnectScreen : undefined}
          />
        )}

        {/* Lecteurs d'écran : annonce de l'accord joué (zone toujours présente) */}
        <ChordAnnouncer
          chord={exploreMode ? null : primaryChord}
          unknown={!exploreMode && midiArray.length > 0}
        />

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
              <UsbHint midiStatus={midi.status} onAllow={midi.requestAccess} />
              <NoPianoFallback
                onUseKeyboard={() => setKeyboardChosen(true)}
                prominent={btStatus === "unsupported"}
              />
            </div>
          )}

          {exploreMode ? (
            <>
              {/* Carte compacte : les sélecteurs doivent tenir sous elle sur mobile */}
              <ChordCard chord={explore.chord}size="secondary" className="chord-card--explore" />
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
                  {pianoLinked ? t("idle.play") : t("idle.touch")}
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

        {showKeyboard && (
          <VirtualKeyboard
            activeNotes={playedNotes}
            onKeyClick={toggleVirtualNote}
            scrollToNotes={[...pressedNotes]}
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
            activeNotes={explore.active}
            scrollToNotes={explore.notes}
            noteLabels={exploreNoteLabels}
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
// ANNONCE POUR LES LECTEURS D'ÉCRAN
// ─────────────────────────────────────────────

// Délai avant d'annoncer : quand on pose les doigts un à un, seul l'accord final est lu.
const ANNOUNCE_DELAY_MS = 400;

/**
 * Zone `role="status"` invisible qui annonce l'accord principal (ou « accord non
 * reconnu ») quand il change. Elle reste dans la page, vide au repos : un lecteur
 * d'écran ne lit une zone live que si elle existait avant le changement.
 */
function ChordAnnouncer({ chord, unknown }) {
  const { t, rootName, chordTypeName } = useI18n();
  const text = chord
    ? `${rootName(chord.root)}${chord.suffix}${chord.isInversion ? `/${rootName(chord.bass)}` : ""}, ${chordTypeName(chord.suffix)}`
    : unknown
      ? t("chord.unknown")
      : "";
  const [spoken, setSpoken] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setSpoken(text), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {spoken}
    </div>
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