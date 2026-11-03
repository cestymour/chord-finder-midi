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

Almost all logic is in `src/App.jsx`, with the BLE transport split out into `src/useBluetoothMIDI.js`.

**Note input: two parallel sources feeding the same state.** `ChordIdentifier` (the main component) owns a `Set` of pressed MIDI note numbers and exposes `handleNoteOn`/`handleNoteOff`. Both input hooks call them:
- `useMIDI` (in `App.jsx`) uses `navigator.requestMIDIAccess`, attaches `onmidimessage` to every input, and re-attaches on `onstatechange`.
- `useBluetoothMIDI` connects to the standard BLE MIDI service/characteristic UUIDs, subscribes to notifications, and decodes packets with `ble-midi-parser`. This direct decoding exists because some platforms (notably Windows Chrome) don't expose a BLE MIDI device as a Web MIDI port. The hook guards against stale async work with `connectionAttemptIdRef`, retries GATT connection up to 3 times on "disconnected" errors, and treats `NotFoundError` (picker cancelled) as a return to `idle`, not an error.

A third source, the on-screen `VirtualKeyboard` (mode "Clavier virtuel", toggled from the status bar), keeps its own `virtualNotes` set (click toggles a key). In that mode the chord is computed from `virtualNotes` only, so hardware note-offs can't release clicked keys; the Bluetooth button is hidden.

Both hooks decode MIDI the same way: `0x90` with velocity > 0 is note on; `0x80`, or `0x90` with velocity 0, is note off. When BLE is not `connected`, pressed notes are cleared to avoid stuck notes. The Bluetooth button only appears when BLE isn't connected *and* Web MIDI reports no inputs (`"disconnected"`).

**Chord detection (`identifyChords`).** This is a pure function over MIDI note numbers:
- It reduces notes to pitch classes and tries each of the 12 roots against every entry in `CHORD_TEMPLATES`.
- Matching is strict: every template interval must be present and no extra pitch classes are allowed. Adding a chord type means adding a template whose interval set exactly equals the voicing.
- The lowest sounding note gives slash-chord notation (`C/E`) when it differs from the root.
- Results are sorted by score (template size), then by `SUFFIX_RANK` (how common the chord is, plus a 0.5 penalty for inversions), then alphabetically. They are deduplicated by `chordName`, filtered to within 5 points of the best score, and capped at 4. The first result is shown as the primary card and the rest as "Autres possibilités".
- When notes are held but nothing matches, a placeholder card ("Accord non reconnu") is built with `buildPendingNotePairs`.

**Naming conventions.** Chord roots use English names (`getRootNameEN`) and the note/interval table uses French solfège (`getNoteNameFR`). Both prefer flats for black keys (`BLACK_KEY_PCS`, also used for the virtual keyboard layout). Interval labels come from `INTERVAL_LABEL`.

**Known inconsistencies** in the chord tables (worth knowing before editing them):
- `SUFFIX_RANK` has the key `"mMaj7"`, but the template suffix is `"mM7"`, so that chord falls back to the default rank 6.
- `aug7` and `7#5` have identical intervals, so both always match together.
