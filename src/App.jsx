import { useState, useEffect, useRef, useCallback } from "react";
import './App.css';
import useBluetoothMIDI from "./useBluetoothMIDI";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const NOTE_NAMES_FR = ["Do", "Do♯", "Ré", "Ré♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];

// Enharmonic alternatives (index = semitone 0–11)
const NOTE_NAMES_FR_FLAT = ["Do", "Ré♭", "Ré", "Mi♭", "Mi", "Fa", "Sol♭", "Sol", "La♭", "La", "Si♭", "Si"];

// English note names (for chord root labels)
const NOTE_NAMES_EN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_EN_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Prefer flats for these roots (common musical convention)
const PREFER_FLAT_ROOTS = new Set([1, 3, 6, 8, 10]); // C#/Db, D#/Eb, F#/Gb, G#/Ab, A#/Bb

function getRootNameEN(semitone) {
  return PREFER_FLAT_ROOTS.has(semitone % 12)
    ? NOTE_NAMES_EN_FLAT[semitone % 12]
    : NOTE_NAMES_EN[semitone % 12];
}

function getNoteNameFR(semitone) {
  return PREFER_FLAT_ROOTS.has(semitone % 12)
    ? NOTE_NAMES_FR_FLAT[semitone % 12]
    : NOTE_NAMES_FR[semitone % 12];
}

// ─────────────────────────────────────────────
// CHORD DEFINITIONS
// Intervals are semitones from root, sorted ascending.
// ALL intervals must be present for a match (strict mode).
// ─────────────────────────────────────────────

const CHORD_TEMPLATES = [
  // ── Triads ──────────────────────────────────────────────
  { suffix: "",        intervals: [0, 4, 7],                label: "Majeur" },
  { suffix: "m",       intervals: [0, 3, 7],                label: "Mineur" },
  { suffix: "dim",     intervals: [0, 3, 6],                label: "Diminué" },
  { suffix: "aug",     intervals: [0, 4, 8],                label: "Augmenté" },
  { suffix: "sus2",    intervals: [0, 2, 7],                label: "Suspendu 2" },
  { suffix: "sus4",    intervals: [0, 5, 7],                label: "Suspendu 4" },
  { suffix: "5",       intervals: [0, 7],                   label: "Quinte (power)" },

  // ── 6th chords ──────────────────────────────────────────
  { suffix: "6",       intervals: [0, 4, 7, 9],             label: "Sixte majeure" },
  { suffix: "m6",      intervals: [0, 3, 7, 9],             label: "Sixte mineure" },
  { suffix: "6/9",     intervals: [0, 2, 4, 7, 9],          label: "Sixte/Neuvième" },

  // ── 7th chords ──────────────────────────────────────────
  { suffix: "maj7",    intervals: [0, 4, 7, 11],            label: "Septième majeure" },
  { suffix: "7",       intervals: [0, 4, 7, 10],            label: "Septième dominante" },
  { suffix: "m7",      intervals: [0, 3, 7, 10],            label: "Septième mineure" },
  { suffix: "mM7",     intervals: [0, 3, 7, 11],            label: "Septième mineure majeure" },
  { suffix: "dim7",    intervals: [0, 3, 6, 9],             label: "Septième diminuée" },
  { suffix: "m7b5",    intervals: [0, 3, 6, 10],            label: "Demi-diminué" },
  { suffix: "aug7",    intervals: [0, 4, 8, 10],            label: "Septième augmentée" },
  { suffix: "7sus4",   intervals: [0, 5, 7, 10],            label: "Sept. sus4" },
  { suffix: "7b5",     intervals: [0, 4, 6, 10],            label: "Sept. quinte bémol" },
  { suffix: "7#5",     intervals: [0, 4, 8, 10],            label: "Sept. quinte augmentée" },

  // ── 9th chords ──────────────────────────────────────────
  { suffix: "maj9",    intervals: [0, 2, 4, 7, 11],         label: "Neuvième majeure" },
  { suffix: "9",       intervals: [0, 2, 4, 7, 10],         label: "Neuvième dominante" },
  { suffix: "m9",      intervals: [0, 2, 3, 7, 10],         label: "Neuvième mineure" },
  { suffix: "add9",    intervals: [0, 2, 4, 7],             label: "Neuvième ajouté" },
  { suffix: "madd9",   intervals: [0, 2, 3, 7],             label: "Neuvième mineure ajoutée" },

  // ── 11th chords ─────────────────────────────────────────
  { suffix: "11",      intervals: [0, 2, 4, 5, 7, 10],      label: "Onzième" },
  { suffix: "m11",     intervals: [0, 2, 3, 5, 7, 10],      label: "Onzième mineure" },
  { suffix: "maj11",   intervals: [0, 2, 4, 5, 7, 11],      label: "Onzième majeure" },

  // ── 13th chords ─────────────────────────────────────────
  { suffix: "13",      intervals: [0, 2, 4, 5, 7, 9, 10],   label: "Treizième" },
  { suffix: "m13",     intervals: [0, 2, 3, 5, 7, 9, 10],   label: "Treizième mineure" },
  { suffix: "maj13",   intervals: [0, 2, 4, 5, 7, 9, 11],   label: "Treizième majeure" },
];

// ─────────────────────────────────────────────
// CHORD DETECTION ENGINE
// ─────────────────────────────────────────────

/**
 * Given a set of MIDI note numbers, returns an array of matching chords
 * sorted by likelihood (most complete match first).
 */
function identifyChords(midiNotes) {
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
      const bassName = isInversion ? getRootNameEN(bassPc) : null;

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
            note: getNoteNameFR(pc),
            interval: INTERVAL_LABEL[interval] ?? `+${interval}`,
          };
        });

      results.push({
        root: getRootNameEN(rootPc),
        suffix: template.suffix,
        label: template.label,
        chordName: getRootNameEN(rootPc) + template.suffix + (isInversion ? "/" + bassName : ""),
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
    "7#5":    3,
    "7b5":    3,
    "m7b5":   3,
    "dim7":   3,
    "mMaj7":  4,
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
    return rank + (r.isInversion ? 0.5 : 0);
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
function buildPendingNotePairs(midiNotes) {
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
      note: getNoteNameFR(n % 12),
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
          {btStatus !== "scanning" && btStatus !== "connecting" && "Connecter MIDI Bluetooth"}
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

  const showBluetoothButton =
    btStatus !== "connected" && midiStatusRefreshed === "disconnected";

  // Compute chords whenever pressed notes change
  const midiArray = [...pressedNotes];
  const chords = identifyChords(midiArray);

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
          noteIntervalPairs: buildPendingNotePairs(midiArray),
        }
      : null;

  // ── Render ────────────────────────────────
  return (
    <div className="app">

      {/* ── MIDI Status indicator ── */}
      <div className={`midi-status midi-status--${displayedMidiStatus}`}>
        <span className="midi-dot" />
        <span className="midi-label">
          {displayedMidiStatus === "pending" && "Connexion MIDI…"}
          {displayedMidiStatus === "connected" && "MIDI connecté"}
          {displayedMidiStatus === "disconnected" && "Aucun instrument MIDI"}
          {displayedMidiStatus === "denied" && "MIDI non disponible"}
        </span>
      </div>

      {/* ── Main display area ── */}
      <div className="display-area">

        {showBluetoothButton && (
          <BluetoothMIDIButton
            btStatus={btStatus}
            btError={btError}
            onConnect={requestBluetoothMIDI}
          />
        )}

        {midiArray.length === 0 ? (
          !showBluetoothButton && (
            <div className="idle-state">
              <span className="idle-icon">🎹</span>
              <span className="idle-text">Jouez un accord…</span>
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

    </div>
  );
}

// ─────────────────────────────────────────────
// CHORD CARD SUB-COMPONENT
// ─────────────────────────────────────────────

function ChordCard({ chord, size, isPending = false }) {
  // Split chord name into root + suffix + inversion for styled rendering
  const rootPart = chord.root;
  const suffixPart = chord.suffix;
  const inversionPart = chord.isInversion ? `/${chord.bassName}` : "";

  return (
    <div
      className={`chord-card chord-card--${size}${isPending ? " chord-card--pending" : ""}`}
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