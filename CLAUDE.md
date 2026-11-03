# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

InstantChordBT: a React 19 + Vite PWA that identifies the chord being played on a MIDI keyboard, connected either by cable/OS-level MIDI (Web MIDI API) or directly over Bluetooth LE (Web Bluetooth API). Plain JavaScript (no TypeScript), no tests, no router, no state library. The UI text and most code comments are in French.

## Commands

```bash
npm install        # .npmrc sets legacy-peer-deps=true (added so the CI npm install succeeds)
npm run dev        # Vite dev server, served at base "/"
npm run build      # Production build to dist/, base "/chord-finder-midi/"
npm run preview    # Serve the production build
npm run lint       # ESLint (flat config, eslint.config.js)
```

There is no test suite. Web MIDI and Web Bluetooth only work in Chromium-based browsers and need a secure context (localhost or HTTPS).

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with the Node version from `.nvmrc` (24) and deploys `dist/` to GitHub Pages. The `base` path in `vite.config.js` switches on `NODE_ENV` (`/chord-finder-midi/` in production), and the PWA manifest `scope`/`start_url` reuse it, so renaming the repo means updating that value. The PWA manifest (name, icons, theme colors) is also defined in `vite.config.js`; icon files live in `public/`.

## Architecture

UI, hooks and components are in `src/App.jsx`. The chord engine (templates, detection, explorer voicings) is a pure, React-free module in `src/chords.js`, so it can be imported from plain Node for quick checks. The BLE transport is in `src/useBluetoothMIDI.js`.

**Note input: two parallel sources feeding the same state.** `ChordIdentifier` (the main component) owns a `Set` of pressed MIDI note numbers and exposes `handleNoteOn`/`handleNoteOff`. Both input hooks call them:
- `useMIDI` (in `App.jsx`) uses `navigator.requestMIDIAccess`, attaches `onmidimessage` to every input, and re-attaches on `onstatechange`.
- `useBluetoothMIDI` connects to the standard BLE MIDI service/characteristic UUIDs, subscribes to notifications, and decodes packets with `ble-midi-parser`. This direct decoding exists because some platforms (notably Windows Chrome) don't expose a BLE MIDI device as a Web MIDI port. The hook guards against stale async work with `connectionAttemptIdRef`, retries GATT connection up to 3 times on "disconnected" errors, and treats `NotFoundError` (picker cancelled) as a return to `idle`, not an error.

**Screens.** `mode` is `"midi"` (tab "Piano"), `"virtual"` (tab "Clavier") or `"explore"` (tab "Accords"), chosen in the segmented `TopBar` (exactly one tab is always active; the Piano tab carries the MIDI status dot). The app always starts on Piano: connecting a real piano is the app's main purpose, and the other two screens are fallbacks. When no piano is connected, the Piano screen shows the big Bluetooth button plus `NoPianoFallback` links to the other two screens.
- `"virtual"` ("Clavier virtuel"): a third note source, the on-screen `VirtualKeyboard`, keeps its own `virtualNotes` set (click toggles a key). The chord is computed from `virtualNotes` only, so hardware note-offs can't release clicked keys.
- `"explore"` ("Dictionnaire"): the reverse direction. `ChordExplorer` picks a root and a template; `buildChordVoicing` turns it into concrete keys, shown read-only on the keyboard (only the voicing keys are lit). "Renverser" cycles inversions by moving the lowest note up an octave.

**Virtual keyboard.** 3 octaves (MIDI 48–83) inside a horizontal scroller: the key track is 150% wide in portrait (2 octaves visible, scroll for the third) and 100% in landscape (phone on its side, desktop), so all 3 octaves show there. Key positions are percentages from `VK_KEY_SPANS`. In explore mode, `useScrollIntoView` smooth-scrolls (respecting `prefers-reduced-motion`) to put the bass at the left only when part of the voicing is hidden.

Both hooks decode MIDI the same way: `0x90` with velocity > 0 is note on; `0x80`, or `0x90` with velocity 0, is note off. When BLE is not `connected`, pressed notes are cleared to avoid stuck notes. The Bluetooth button appears on the Piano screen when BLE isn't connected *and* Web MIDI has no inputs (`"disconnected"`) or is unavailable (`"denied"`).

**Chord detection (`identifyChords`).** This is a pure function over MIDI note numbers:
- It reduces notes to pitch classes and tries each of the 12 roots against every entry in `CHORD_TEMPLATES`.
- Matching is strict: every template interval must be present and no extra pitch classes are allowed. Adding a chord type means adding a template whose interval set exactly equals the voicing.
- The lowest sounding note gives slash-chord notation (`C/E`) when it differs from the root.
- Results are sorted by score (template size), then by `SUFFIX_RANK` (how common the chord is, plus a 1.5 penalty for inversions), then alphabetically. They are deduplicated by `chordName`, filtered to within 5 points of the best score, and capped at 4. The first result is shown as the primary card and the rest as "Autres possibilités".
- When notes are held but nothing matches, a placeholder card ("Accord non reconnu") is built with `buildPendingNotePairs`.

**Naming conventions.** Chord roots use English names (`getRootNameEN`) and the note/interval table uses French solfège (`getNoteNameFR`). Accidentals are always the real symbols ♯ and ♭ (never ASCII `#` or `b`), in note names and in chord suffixes (`7♯5`, `m7♭5`). Black keys are named with sharps or flats everywhere according to one `accidentals` value (`"sharp"` | `"flat"`). It is passed explicitly to every naming function (`identifyChords`, `describeVoicing`, `buildPendingNotePairs`, the explorer and keyboard components). Its default is `DEFAULT_ACCIDENTALS` in `chords.js` (currently sharps). The user can switch it in the settings dialog, and the choice is saved in `localStorage` (`instantchordbt.accidentals`). Interval labels come from `INTERVAL_LABEL`.

**Settings.** The gear button opens `SettingsDialog`, a native `<dialog>` (Escape or a backdrop click closes it). It holds the sharps/flats choice and shows the app version, which `vite.config.js` injects from `package.json` as `import.meta.env.VITE_APP_VERSION`.

**Explorer voicings.** A template's optional `voicing` lays out extensions above the octave (9 → 14, 11 → 17, 13 → 21); its pitch classes must equal `intervals`. `buildChordVoicing` puts the bass in [48, 59]; the bass-to-top span never exceeds 21 semitones, so every voicing and inversion fits in 48–83 and within 2 visible octaves. Round trip `identifyChords(voicing)` always lists the chosen chord, and in root position it comes first (except `aug7`, which ties with `7♯5`). Inversions may come out under another name when chords share notes: aug, dim7, sus2/sus4, 6/m7, m6/m7♭5, 13ths.

**Chord table notes.** `SUFFIX_RANK` keys must match template suffixes exactly; a missing key silently falls back to rank 6. `aug7` and `7♯5` have identical intervals, so both always match together (intentional: several chord names can share the same keys).
