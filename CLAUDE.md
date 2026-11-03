# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

InstantChordBT: a React 19 + Vite PWA that identifies the chord being played on a MIDI keyboard, connected either by cable/OS-level MIDI (Web MIDI API) or directly over Bluetooth LE (Web Bluetooth API). Plain JavaScript (no TypeScript), no tests, no router, no state library. The UI is available in French (default), English, German and Spanish; most code comments are in French.

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

## Versions

`CHANGELOG.md` (in French) lists every version, newest first, in Keep a Changelog style. Note user-visible changes under `[Non publié]` as you make them. To release: move that section under a new `[X.Y.Z] — date` heading, bump `package.json` with `npm version X.Y.Z --no-git-tag-version` (the settings dialog shows this number), update the compare links at the bottom, then tag `vX.Y.Z` on `main`.

## Architecture

UI, hooks and components are in `src/App.jsx`. The chord engine (templates, detection, explorer voicings) is a pure, React-free module in `src/chords.js`, so it can be imported from plain Node for quick checks. All translations live in `src/i18n.js` (it imports `./chords.js` with the extension so it can be loaded from Node too). The BLE transport is in `src/useBluetoothMIDI.js`. The piano sound is synthesized with the Web Audio API in `src/pianoSound.js` (no audio files): the virtual keyboard plays a note when a key goes down and damps it when it goes up, the dictionary plays each chosen chord as an arpeggio, and the Piano screen stays silent (the real piano is heard).

**Note input: two parallel sources feeding the same state.** `ChordIdentifier` (the main component) owns a `Set` of pressed MIDI note numbers and exposes `handleNoteOn`/`handleNoteOff`. Both input hooks call them:
- `useMIDI` (in `App.jsx`) uses `navigator.requestMIDIAccess`, attaches `onmidimessage` to every input, and re-attaches on `onstatechange`.
- `useBluetoothMIDI` connects to the standard BLE MIDI service/characteristic UUIDs, subscribes to notifications, and decodes packets with `ble-midi-parser`. This direct decoding exists because some platforms (notably Windows Chrome) don't expose a BLE MIDI device as a Web MIDI port. The hook guards against stale async work with `connectionAttemptIdRef`, retries GATT connection up to 3 times on "disconnected" errors, and treats `NotFoundError` (picker cancelled) as a return to `idle`, not an error.

**Screens.** `mode` is `"midi"` (tab "Piano"), `"virtual"` (tab "Clavier") or `"explore"` (tab "Accords"), chosen in the segmented `TopBar` (exactly one tab is always active). The app always starts on Piano: connecting a real piano is the app's main purpose, and the other two screens are fallbacks. When no piano is connected, the Piano screen shows the big Bluetooth button plus `NoPianoFallback` links to the other two screens.
- `"virtual"` ("Clavier virtuel"): a third note source, the on-screen `VirtualKeyboard`, keeps its own `virtualNotes` set (click toggles a key). The chord is computed from `virtualNotes` only, so hardware note-offs can't release clicked keys.
- `"explore"` ("Dictionnaire"): the reverse direction. `ChordExplorer` picks a root and a template; `buildChordVoicing` turns it into concrete keys, shown read-only on the keyboard (only the voicing keys are lit). "Renverser" cycles inversions by moving the lowest note up an octave.

**Virtual keyboard.** 3 octaves (MIDI 48–83) inside a horizontal scroller: the key track is 150% wide in portrait (2 octaves visible, scroll for the third) and 100% in landscape (phone on its side, desktop), so all 3 octaves show there. Key positions are percentages from `VK_KEY_SPANS`. In explore mode, `useScrollIntoView` smooth-scrolls (respecting `prefers-reduced-motion`) to put the bass at the left only when part of the voicing is hidden.

Both hooks decode MIDI the same way: `0x90` with velocity > 0 is note on; `0x80`, or `0x90` with velocity 0, is note off; control change 64 (`0xB0`) is the sustain pedal (down at value ≥ 64), reported through `onSustain`. The main component keeps `{ held, sustained, pedal }`: a key released while the pedal is down moves to `sustained` and still counts for the chord until the pedal goes up. When BLE is not `connected`, all piano notes are cleared to avoid stuck notes. The Bluetooth button appears on the Piano screen when BLE isn't connected *and* Web MIDI has no inputs (`"disconnected"`) or is unavailable (`"denied"`).

**Chord detection (`identifyChords`).** This is a pure function over MIDI note numbers:
- Templates are written as degrees (`degrees: ["1", "3", "5", "♭7", "9"]`), from which `buildTemplate` derives the pitch-class `intervals`, the `required` ones, `degreeByInterval`, the explorer `voicing` (9, 11, 13 above the octave) and `minor` (has a `♭3`). The degree label is also the interval shown in the note table, so detection and the dictionary show the same labels (`9`, `♯9`, `𝄫7`).
- It reduces notes to pitch classes and tries each of the 12 roots against every entry in `CHORD_TEMPLATES`.
- Matching: every degree not listed in the template's `optional` must be present, and no pitch class outside the template is allowed. `optional` holds the perfect fifth of 7th-and-beyond chords, and the 9th/11th of 13ths. Triads and sixths stay fully strict. `identifyChords(notes, accidentals, { allowIncomplete })` makes every degree required when `allowIncomplete` is false (the "Accords incomplets" setting).
- Optional degrees that weren't played are still listed in `noteIntervalPairs` with `missing: true`, inserted right after the degree that precedes them in the template (G7 without D: G B (D) F). `ChordCard` dims them and draws tall parentheses over the column; the table cells are placed explicitly (`gridColumn`/`gridRow`) so the parenthesis overlay can span both rows.
- The lowest sounding note gives slash-chord notation (`C/E`) when it differs from the root.
- Results are sorted by priority: `SUFFIX_RANK` (how common the chord is) + 1.5 for an inversion + 1 per missing optional note, then alphabetically. They are deduplicated by `chordName` and capped at 4. The first result is shown as the primary card and the rest as "Autres possibilités".
- When notes are held but nothing matches (including a single note), a placeholder card is built with `buildPendingNotePairs`: one dot per pressed key replaces the chord name, and the note table still lists the notes.
- Results carry spelled notes, not display text: `root`, `bass` and each `noteIntervalPairs` entry's `note` are `{ letter, alter }` (letter 0–6 = C…B, alter −2…+2), alongside `rootPc`/`bassPc`/`pc`. `chordName` (English symbols) is only used as the dedup key. The UI names notes and chord types through `useI18n()`.

**Internationalization (`src/i18n.js`).** No library. `createI18n(language, accidentals)` returns the display helpers, provided to every component by `I18nContext` (read them with `useI18n()`):
- `t(key)`: UI strings from `MESSAGES` (flat dotted keys such as `"midi.connected"`). A key missing in a language falls back to French. Add every new key to all four languages.
- `chordTypeName(suffix)` and `groupName(id)`: chord type and dictionary group names, keyed by template `suffix` and group `id` from `chords.js` (the templates hold no display text).
- `noteName(note)` names a spelled note, `pcName(pc)` a key outside any chord (sharps or flats from the setting), and `keyLabel(midi)` adds the octave. Note names follow the language's convention (Do Ré Mi in French, Do Re Mi in Spanish, C D E in English, C D E … A B H in German, where H is B natural and B is B♭). Octave numbers: middle C (MIDI 60) is Do3 in French and Spanish, C4 in English and German.
- `rootName(note)`: root and bass of chord symbols (spelled notes). Symbols use English letters in every language except German, which uses H/B so that symbols match the note table (`Hmaj7`, not `Bmaj7`).
- `inversionLabel(i)`: "1er renversement", "1st inversion", and so on.

French stays the default (`DEFAULT_LANGUAGE`, no browser-language detection). The main component also sets `<html lang>` to the chosen language.

**Accidentals and spelling.** They are always the real symbols ♯ ♭ 𝄪 𝄫 (never ASCII `#` or `b`), in note names, chord suffixes (`7♯5`, `m7♭5`) and degrees (`𝄫7`); `ACCIDENTAL_SYMBOLS` in `chords.js` holds them. Spelling is exact: `spellRoot` names the root, then `spellDegree` gives each chord tone the letter of its degree (Fm = F A♭ C, Eaug = E G♯ B♯). A black-key root takes the spelling whose key has fewer accidentals (`BLACK_ROOT_SPELLING`: D♭ E♭ A♭ B♭ major, C♯m F♯m G♯m B♭m minor; `minor` = template has `♭3`). The `accidentals` setting (`"sharp"` | `"flat"`, default `DEFAULT_ACCIDENTALS`) only decides ties (F♯/G♭ major, D♯m/E♭m) and keys outside a chord (`spellPc`: keyboard labels, unrecognized notes). Explorer root chips are spelled for the chosen chord type.

**Settings.** The gear button opens `SettingsDialog`, a native `<dialog>` (Escape or a backdrop click closes it). It holds the language, sharps/flats, sound on/off and incomplete chords (yes/no, default yes) choices and shows the app version, which `vite.config.js` injects from `package.json` as `import.meta.env.VITE_APP_VERSION`. All four are saved in `localStorage` (`instantchordbt.language`, `instantchordbt.accidentals`, `instantchordbt.sound`, `instantchordbt.incomplete`) by `usePersistentSetting`, so they are restored on the next launch.

**Explorer voicings.** The voicing stacks all of a template's degrees, optional ones included, with extensions above the octave (9 → 14, 11 → 17, 13 → 21). `buildChordVoicing` puts the bass in [48, 59]; the bass-to-top span never exceeds 21 semitones, so every voicing and inversion fits in 48–83 and within 2 visible octaves. Round trip `identifyChords(voicing)` always lists the chosen chord, and in root position it comes first (except `aug7`, which ties with `7♯5`). Inversions may come out under another name when chords share notes: aug, dim7, sus2/sus4, 6/m7, m6/m7♭5, 6/9 / 9sus4, 13ths.

**Chord table notes.** `SUFFIX_RANK` keys must match template suffixes exactly; a missing key silently falls back to rank 6. `aug7` and `7♯5` have identical intervals, so both always match together (intentional: several chord names can share the same keys).
