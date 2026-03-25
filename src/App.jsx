import { useState, useEffect, useRef, useCallback } from "react";
import './App.css';

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
  { suffix: "mMaj7",   intervals: [0, 3, 7, 11],            label: "Septième majeure mineure" },
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
  { suffix: "add9",    intervals: [0, 2, 4, 7],             label: "Ajouté 9" },
  { suffix: "madd9",   intervals: [0, 2, 3, 7],             label: "Mineur ajouté 9" },

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

      // Build the interval labels from the actual played notes
      const intervalLabels = pitchClasses
        .map(pc => (pc - rootPc + 12) % 12)
        .sort((a, b) => a - b)
        .map(i => INTERVAL_LABEL[i] ?? `+${i}`);

      // French note names of played notes, sorted from bass
      const noteNamesFR = sorted
        .map(n => getNoteNameFR(n % 12))
        // deduplicate while preserving order
        .filter((name, idx, arr) => arr.indexOf(name) === idx);

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
        intervalLabels,
        noteNamesFR,
      });
    }
  }

  if (results.length === 0) return [];

  // Sort: higher score first; tie-break by fewer extra notes, then alphabetical
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.extraNotes !== b.extraNotes) return a.extraNotes - b.extraNotes;
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

function useMIDI(onNoteOn, onNoteOff) {
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

    let access = null;

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

    navigator.requestMIDIAccess({ sysex: false })
      .then(midiAccess => {
        access = midiAccess;
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
  }, [handleMidiMessage]);

  return midiStatus;
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

  const midiStatus = useMIDI(handleNoteOn, handleNoteOff);

  // Compute chords whenever pressed notes change
  const midiArray = [...pressedNotes];
  const chords = identifyChords(midiArray);

  const primaryChord = chords[0] ?? null;
  const secondaryChords = chords.slice(1);

  // ── Render ────────────────────────────────
  return (
    <div className="app">

      {/* ── MIDI Status indicator ── */}
      <div className={`midi-status midi-status--${midiStatus}`}>
        <span className="midi-dot" />
        <span className="midi-label">
          {midiStatus === "pending"      && "Connexion MIDI…"}
          {midiStatus === "connected"    && "MIDI connecté"}
          {midiStatus === "disconnected" && "Aucun instrument MIDI"}
          {midiStatus === "denied"       && "MIDI non disponible"}
        </span>
      </div>

      {/* ── Main display area ── */}
      <div className="display-area">
        {midiArray.length === 0 ? (
          <div className="idle-state">
            <span className="idle-icon">🎹</span>
            <span className="idle-text">Jouez un accord…</span>
          </div>
        ) : primaryChord ? (
          <>
            {/* Primary chord — large */}
            <ChordCard chord={primaryChord} size="primary" />

            {/* Secondary chords — smaller */}
            {secondaryChords.length > 0 && (
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
        ) : (
          <div className="no-chord">
            <span className="no-chord-symbol">?</span>
            <span className="no-chord-text">Accord non reconnu</span>
            {/* Still show the notes played */}
            <div className="raw-notes">
              {midiArray.sort((a, b) => a - b).map(n => getNoteNameFR(n % 12)).join(" – ")}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────
// CHORD CARD SUB-COMPONENT
// ─────────────────────────────────────────────

function ChordCard({ chord, size }) {
  // Split chord name into root + suffix + inversion for styled rendering
  const rootPart = chord.root;
  const suffixPart = chord.suffix;
  const inversionPart = chord.isInversion ? `/${chord.bassName}` : "";

  return (
    <div className={`chord-card chord-card--${size}`}>

      {/* Chord name — very large */}
      <div className="chord-name">
        <span className="chord-root">{rootPart}</span>
        {suffixPart && <span className="chord-suffix">{suffixPart}</span>}
        {inversionPart && <span className="chord-inversion">{inversionPart}</span>}
      </div>

      {/* Secondary info */}
      <div className="chord-meta">

        {/* Notes played */}
        <div className="meta-row">
          <span className="meta-key">Notes</span>
          <span className="meta-value">{chord.noteNamesFR.join(" – ")}</span>
        </div>

        {/* Intervals */}
        <div className="meta-row">
          <span className="meta-key">Intervalles</span>
          <span className="meta-value">{chord.intervalLabels.join(" – ")}</span>
        </div>

        {/* Human-readable label */}
        <div className="meta-row">
          <span className="meta-key">Type</span>
          <span className="meta-value meta-value--dim">{chord.label}</span>
        </div>

      </div>
    </div>
  );
}
