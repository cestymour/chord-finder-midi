import { useState, useEffect, useRef, useCallback } from "react";
import './App.css';
import useBluetoothMIDI from "./useBluetoothMIDI";
import {
  ACCIDENTALS,
  BLACK_KEY_PCS,
  CHORD_TEMPLATE_GROUPS,
  CHORD_TEMPLATES,
  DEFAULT_ACCIDENTALS,
  buildChordVoicing,
  buildPendingNotePairs,
  describeVoicing,
  getNoteNameFR,
  getRootNameEN,
  identifyChords,
  inversionCount,
} from "./chords";

// ─────────────────────────────────────────────
// MIDI CONNECTION HOOK
// ─────────────────────────────────────────────

function useMIDI(onNoteOn, onNoteOff, refreshKey) {
  const [midiStatus, setMidiStatus] = useState("pending"); // pending | connected | disconnected | denied
  const inputsRef = useRef([]);

  const handleMidiMessage = useCallback((event) => {
    const [status, note, velocity] = event.data;
    const type = status & 0xf0;

    if (type === 0x90 && velocity > 0) {
      onNoteOn(note);
    } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
      onNoteOff(note);
    }
  }, [onNoteOn, onNoteOff]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setMidiStatus("denied");
      return;
    }

    setMidiStatus("pending");

    const attachListeners = (midiAccess) => {
      // Detach old listeners
      inputsRef.current.forEach(inp => {
        inp.onmidimessage = null;
      });
      inputsRef.current = [];

      let count = 0;
      midiAccess.inputs.forEach(input => {
        input.onmidimessage = handleMidiMessage;
        inputsRef.current.push(input);
        count++;
      });

      setMidiStatus(count > 0 ? "connected" : "disconnected");
    };

    navigator.requestMIDIAccess()
      .then(midiAccess => {
        attachListeners(midiAccess);

        midiAccess.onstatechange = () => {
          attachListeners(midiAccess);
        };
      })
      .catch(() => {
        setMidiStatus("denied");
      });

    return () => {
      if (inputsRef.current) {
        inputsRef.current.forEach(inp => {
          inp.onmidimessage = null;
        });
      }
    };
  }, [handleMidiMessage, refreshKey]);

  return midiStatus;
}

// ─────────────────────────────────────────────
// BLUETOOTH MIDI BUTTON COMPONENT
// ─────────────────────────────────────────────

function BluetoothMIDIButton({ btStatus, btError, onConnect }) {
  const isLoading = btStatus === "scanning" || btStatus === "connecting";

  return (
    <div className="bt-connect-container">
      <button
        className={`bt-connect-btn ${isLoading ? "bt-connect-btn--loading" : ""}`}
        onClick={onConnect}
        disabled={isLoading}
        aria-label="Connecter un instrument MIDI via Bluetooth"
      >
        <svg
          className="bt-connect-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6.5 6.5 17.5 17.5" />
          <polyline points="6.5 17.5 17.5 6.5" />
          <polyline points="12 2 17.5 6.5 12 11 17.5 17.5 12 22" />
          <line x1="12" y1="2" x2="12" y2="22" />
        </svg>

        <span className="bt-connect-label">
          {btStatus === "scanning" && "Recherche…"}
          {btStatus === "connecting" && "Connexion…"}
          {btStatus !== "scanning" && btStatus !== "connecting" && "Connexion Bluetooth MIDI"}
        </span>
      </button>

      {btStatus === "error" && btError && (
        <p className="bt-connect-error">{btError}</p>
      )}

      {btStatus === "unsupported" && (
        <p className="bt-connect-error">
          Web Bluetooth n'est pas supporté par ce navigateur.
          Utilisez Chrome sur Android ou ordinateur.
        </p>
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

// Convention française : le Do central (MIDI 60) est Do3
const octaveOfFR = (n) => Math.floor(n / 12) - 2;
const keyLabel = (n, accidentals) => `${getNoteNameFR(n % 12, accidentals)}${octaveOfFR(n)}`;

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
 */
function VirtualKeyboard({ activeNotes, onKeyClick, scrollToNotes, toolbar, accidentals }) {
  const scrollerRef = useRef(null);
  const interactive = Boolean(onKeyClick);
  const KeyTag = interactive ? "button" : "div";

  useScrollIntoView(
    scrollerRef,
    scrollToNotes?.length ? Math.min(...scrollToNotes) : null,
    scrollToNotes?.length ? Math.max(...scrollToNotes) : null
  );

  const keyProps = (n, color) => {
    const isDown = activeNotes.has(n);
    return {
      isDown,
      props: {
        className: `vk-key vk-key--${color}${isDown ? " vk-key--down" : ""}${interactive ? "" : " vk-key--static"}`,
        ...(interactive
          ? { onClick: () => onKeyClick(n), "aria-pressed": isDown, "aria-label": keyLabel(n, accidentals) }
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
                    {n % 12 === 0 ? keyLabel(n, accidentals) : getNoteNameFR(n % 12, accidentals)}
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

function ChordExplorer({ rootPc, suffix, onRootChange, onSuffixChange, accidentals }) {
  return (
    <div className="explorer">
      <div className="explorer__section">
        <div className="explorer__label">Fondamentale</div>
        <div className="explorer__roots">
          {ROOT_PCS.map((pc) => (
            <button
              key={pc}
              className={`explorer-chip${pc === rootPc ? " explorer-chip--active" : ""}`}
              onClick={() => onRootChange(pc)}
              aria-pressed={pc === rootPc}
            >
              {getRootNameEN(pc, accidentals)}
            </button>
          ))}
        </div>
      </div>
      {CHORD_TEMPLATE_GROUPS.map((group) => (
        <div className="explorer__section" key={group.label}>
          <div className="explorer__label">{group.label}</div>
          <div className="explorer__types">
            {group.templates.map((t) => (
              <button
                key={t.suffix}
                className={`explorer-chip${t.suffix === suffix ? " explorer-chip--active" : ""}`}
                onClick={() => onSuffixChange(t.suffix)}
                aria-pressed={t.suffix === suffix}
                title={t.label}
              >
                {getRootNameEN(rootPc, accidentals)}{t.suffix}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const inversionLabel = (i) =>
  i === 0 ? "État fondamental" : i === 1 ? "1er renversement" : `${i}e renversement`;

// ─────────────────────────────────────────────
// TOP BAR : onglets d'écran + paramètres
// ─────────────────────────────────────────────

const MODE_TABS = [
  { mode: "midi",    label: "Piano" },
  { mode: "virtual", label: "Clavier", icon: "👆" },
  { mode: "explore", label: "Accords", icon: "📖" },
];

function TopBar({ mode, onModeChange, midiStatus, onOpenSettings }) {
  return (
    <header className="top-bar">
      <nav className="mode-tabs" role="tablist" aria-label="Écran affiché">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.mode}
            role="tab"
            aria-selected={mode === tab.mode}
            className={`mode-tab${mode === tab.mode ? " mode-tab--active" : ""}`}
            onClick={() => onModeChange(tab.mode)}
          >
            {/* L'onglet Piano porte le voyant MIDI, visible depuis tous les écrans */}
            {tab.mode === "midi"
              ? <span className={`midi-dot midi-dot--${midiStatus}`} aria-hidden="true" />
              : <span aria-hidden="true">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </nav>
      <button className="settings-btn" onClick={onOpenSettings} aria-label="Paramètres">
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
  return (
    <div className="no-piano">
      <span className="no-piano__label">Pas de piano sous la main ?</span>
      <div className="no-piano__actions">
        <button className="no-piano__btn" onClick={() => onModeChange("virtual")}>
          👆 Clavier virtuel
        </button>
        <button className="no-piano__btn" onClick={() => onModeChange("explore")}>
          📖 Dictionnaire d'accords
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

const ACCIDENTAL_OPTIONS = [
  { value: "sharp", symbol: "♯", label: "Dièses" },
  { value: "flat",  symbol: "♭", label: "Bémols" },
];

function loadAccidentals() {
  try {
    const stored = localStorage.getItem(ACCIDENTALS_STORAGE_KEY);
    return ACCIDENTALS.includes(stored) ? stored : DEFAULT_ACCIDENTALS;
  } catch {
    return DEFAULT_ACCIDENTALS;
  }
}

function SettingsDialog({ open, onClose, accidentals, onAccidentalsChange }) {
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
          <h2 className="settings__title">Paramètres</h2>
          <button className="settings__close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="settings__row">
          <span className="settings__label" id="settings-accidentals">Affichage des altérations</span>
          <div className="settings__choices" role="group" aria-labelledby="settings-accidentals">
            {ACCIDENTAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings__choice${accidentals === opt.value ? " settings__choice--active" : ""}`}
                onClick={() => onAccidentalsChange(opt.value)}
                aria-pressed={accidentals === opt.value}
                aria-label={opt.label}
                title={opt.label}
              >
                {opt.symbol}
              </button>
            ))}
          </div>
        </div>

        <div className="settings__footer">InstantChordBT · version {APP_VERSION}</div>
      </div>
    </dialog>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function ChordIdentifier() {
  // Set of currently pressed MIDI note numbers
  const [pressedNotes, setPressedNotes] = useState(new Set());

  const handleNoteOn = useCallback((note) => {
    setPressedNotes(prev => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });
  }, []);

  const handleNoteOff = useCallback((note) => {
    setPressedNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  const {
    btStatus,
    btError,
    requestBluetoothMIDI,
  } = useBluetoothMIDI({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff });

  useEffect(() => {
    // Lors d'une déconnexion Bluetooth, évite de garder des notes "bloquées".
    if (btStatus === "connected") return;
    const t = setTimeout(() => setPressedNotes(new Set()), 0);
    return () => clearTimeout(t);
  }, [btStatus]);

  const midiStatusRefreshed = useMIDI(handleNoteOn, handleNoteOff);

  const displayedMidiStatus =
    btStatus === "scanning" || btStatus === "connecting"
      ? "pending"
      : btStatus === "connected"
        ? "connected"
        : midiStatusRefreshed;

  // Mode d'affichage : "midi" (piano connecté), "virtual" (clavier virtuel)
  // ou "explore" (dictionnaire : choisir un accord pour voir ses touches)
  const [mode, setMode] = useState("midi");
  const virtualMode = mode === "virtual";
  const exploreMode = mode === "explore";

  // Mode clavier virtuel : notes séparées de celles du piano physique,
  // pour qu'un note-off MIDI ne relâche pas une touche cliquée à l'écran.
  const [virtualNotes, setVirtualNotes] = useState(new Set());

  const toggleVirtualNote = useCallback((note) => {
    setVirtualNotes(prev => {
      const next = new Set(prev);
      if (next.has(note)) next.delete(note);
      else next.add(note);
      return next;
    });
  }, []);

  const clearVirtualNotes = useCallback(() => {
    setVirtualNotes(new Set());
  }, []);

  const changeMode = (target) => {
    setMode(target);
    clearVirtualNotes();
  };

  // Paramètres
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accidentals, setAccidentals] = useState(loadAccidentals);

  useEffect(() => {
    try {
      localStorage.setItem(ACCIDENTALS_STORAGE_KEY, accidentals);
    } catch {
      // stockage indisponible (navigation privée…) : le choix vaut pour la session
    }
  }, [accidentals]);

  // Explorateur d'accords
  const [exploreRoot, setExploreRoot] = useState(0); // Do
  const [exploreSuffix, setExploreSuffix] = useState(""); // majeur
  const [exploreInversion, setExploreInversion] = useState(0);

  const exploreTemplate = CHORD_TEMPLATES.find(t => t.suffix === exploreSuffix);
  const exploreVoicing = buildChordVoicing(exploreRoot, exploreTemplate, exploreInversion);
  const exploreChord = describeVoicing(exploreRoot, exploreTemplate, exploreVoicing, accidentals);
  const exploreNotes = exploreVoicing.map(n => n.midi);
  const exploreActive = new Set(exploreNotes);

  const changeExploreRoot = (pc) => {
    setExploreRoot(pc);
    setExploreInversion(0);
  };

  const changeExploreSuffix = (suffix) => {
    setExploreSuffix(suffix);
    setExploreInversion(0);
  };

  const nextInversion = () => {
    setExploreInversion(i => (i + 1) % inversionCount(exploreTemplate));
  };

  // Écran de démarrage sans piano : toujours proposer la connexion (valeur ajoutée de l'appli),
  // y compris quand Web MIDI est indisponible ; le clavier virtuel et le dictionnaire
  // ne sont que des solutions de secours.
  const showBluetoothButton =
    mode === "midi" &&
    btStatus !== "connected" &&
    (midiStatusRefreshed === "disconnected" || midiStatusRefreshed === "denied");

  // Compute chords whenever pressed notes change
  const midiArray = [...(virtualMode ? virtualNotes : pressedNotes)];
  const chords = identifyChords(midiArray, accidentals);

  const primaryChord = chords[0] ?? null;
  const secondaryChords = chords.slice(1);

  const pendingChordPlaceHolder =
    midiArray.length > 0 && !primaryChord
      ? {
          root: "?",
          suffix: "",
          label: "Accord non reconnu",
          isInversion: false,
          bassName: null,
          noteIntervalPairs: buildPendingNotePairs(midiArray, accidentals),
        }
      : null;

  // ── Render ────────────────────────────────
  return (
    <div className={`app${mode !== "midi" ? " app--keyboard" : ""}`}>

      <TopBar
        mode={mode}
        onModeChange={changeMode}
        midiStatus={displayedMidiStatus}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* ── MIDI Status (écran Piano uniquement) ── */}
      {mode === "midi" && (
        <div className={`midi-status midi-status--${displayedMidiStatus}`}>
          <span className="midi-dot" />
          <span className="midi-label">
            {displayedMidiStatus === "pending" && "Connexion MIDI…"}
            {displayedMidiStatus === "connected" && "MIDI connecté"}
            {displayedMidiStatus === "disconnected" && "Aucun instrument MIDI"}
            {displayedMidiStatus === "denied" && "MIDI non disponible"}
          </span>
        </div>
      )}

      {/* ── Main display area ── */}
      <div className="display-area">

        {showBluetoothButton && (
          <div className="connect-screen">
            <BluetoothMIDIButton
              btStatus={btStatus}
              btError={btError}
              onConnect={requestBluetoothMIDI}
            />
            <NoPianoFallback onModeChange={changeMode} />
          </div>
        )}

        {exploreMode ? (
          <>
            {/* Carte compacte : les sélecteurs doivent tenir sous elle sur mobile */}
            <ChordCard chord={exploreChord} size="secondary" className="chord-card--explore" />
            <ChordExplorer
              rootPc={exploreRoot}
              suffix={exploreSuffix}
              onRootChange={changeExploreRoot}
              onSuffixChange={changeExploreSuffix}
              accidentals={accidentals}
            />
          </>
        ) : midiArray.length === 0 ? (
          !showBluetoothButton && (
            <div className="idle-state">
              <span className="idle-icon">🎹</span>
              <span className="idle-text">
                {virtualMode ? "Touchez le clavier…" : "Jouez un accord…"}
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
                <div className="secondary-label">Autres possibilités</div>
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
          accidentals={accidentals}
          toolbar={
            <>
              <span className="virtual-kb__hint">Touchez les notes de l'accord</span>
              <button
                className="virtual-kb__clear"
                onClick={clearVirtualNotes}
                disabled={virtualNotes.size === 0}
              >
                Effacer
              </button>
            </>
          }
        />
      )}

      {exploreMode && (
        <VirtualKeyboard
          activeNotes={exploreActive}
          scrollToNotes={exploreNotes}
          accidentals={accidentals}
          toolbar={
            <>
              <span className="virtual-kb__hint">{inversionLabel(exploreInversion)}</span>
              <button className="virtual-kb__action" onClick={nextInversion}>
                Renverser ↻
              </button>
            </>
          }
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        accidentals={accidentals}
        onAccidentalsChange={setAccidentals}
      />

    </div>
  );
}

// ─────────────────────────────────────────────
// CHORD CARD SUB-COMPONENT
// ─────────────────────────────────────────────

function ChordCard({ chord, size, isPending = false, className = "" }) {
  // Split chord name into root + suffix + inversion for styled rendering
  const rootPart = chord.root;
  const suffixPart = chord.suffix;
  const inversionPart = chord.isInversion ? `/${chord.bassName}` : "";

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
        {chord.noteIntervalPairs.map((pair, i) => (
          <span key={`n${i}`} className="chord-table__note">{pair.note}</span>
        ))}
        {chord.noteIntervalPairs.map((pair, i) => (
          <span key={`i${i}`} className="chord-table__interval">{pair.interval}</span>
        ))}
      </div>

      {/* Human-readable label */}
      <div className="chord-type">{chord.label}</div>
    </div>
  );
}