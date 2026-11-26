// Essais du mode micro : analyse d'un enregistrement de simulation (logs/sim-*.json
// et son .wav, voir src/simRecorder.js).
//
//   node scripts/sim-analyze.mjs [logs/sim-….json] [--engines A1,A2,A3,A4,A5] [--detail]
//
// La vérité : les touches du piano MIDI (et la pédale). Pour chaque accord joué,
// on compare les notes affichées par le micro :
// - « live » : ce que l'appli a affiché pendant l'enregistrement ;
// - A1, A2, A3… : le son enregistré rejoué hors ligne à travers ces moteurs, aux
//   mêmes instants d'analyse que pendant l'enregistrement.
// Critère : mêmes classes de hauteur et même basse (donc même accord et même
// renversement). Les notes hors de la plage de la dernière version du moteur A
// (MIDI 36 à 108 depuis A4 ; A1 à A3 s'arrêtent à 88) sont
// comptées à part.

import { readFileSync, readdirSync } from "node:fs";
import { CHROMA_LATEST, createChromaEngine, MIC_MIN_MIDI } from "../src/micChroma.js";
import { createNoteTracker } from "../src/micTracker.js";
import { identifyChords } from "../src/chords.js";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const detail = args.includes("--detail");
let journalPath = args.find((a) => a.endsWith(".json"));
if (!journalPath) {
  const files = readdirSync("logs").filter((f) => f.startsWith("sim-") && f.endsWith(".json")).sort();
  journalPath = `logs/${files.at(-1)}`;
}
const engines = option("--engines", "A1,A2,A3,A4,A5").split(",").filter(Boolean);
// Réglages du suivi à essayer, ajoutés à ceux du moteur : --tracker '{"attackFrames":10}'
const trackerOverride = JSON.parse(option("--tracker", "{}"));
const rulesOverride = JSON.parse(option("--rules", "{}")); // ex. '{"lowSupport":false}'

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const wavPath = journalPath.replace(/[^/\\]*$/, journal.audioFile ?? "");
const samples = readWav(readFileSync(wavPath));
const { sampleRate } = journal;

/** WAV mono PCM 16 bits → Float32Array. */
function readWav(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 12;
  while (offset < view.byteLength) {
    const id = String.fromCharCode(...buffer.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === "data") {
      const out = new Float32Array(size / 2);
      for (let i = 0; i < out.length; i++) out[i] = view.getInt16(offset + 8 + 2 * i, true) / 32768;
      return out;
    }
    offset += 8 + size;
  }
  throw new Error("WAV sans données");
}

// Instant (ms) → nombre d'échantillons reçus : interpolation entre les repères
// (le repère [n, t] est posé à l'arrivée du bloc qui commence à n : n + 1024 reçus)
const marks = journal.audioMarks.map(([n, t], i, all) => [i === all.length - 1 ? n : n + 1024, t]);
function samplesAt(t) {
  if (t <= marks[0][1]) return marks[0][0];
  for (let i = 1; i < marks.length; i++) {
    const [n1, t1] = marks[i];
    const [n0, t0] = marks[i - 1];
    if (t <= t1) return Math.round(n0 + ((t - t0) / (t1 - t0)) * (n1 - n0));
  }
  return marks.at(-1)[0];
}

// ─── Vérité : notes qui sonnent selon le MIDI (touches et pédale) ───
function midiTimeline() {
  const held = new Set();
  const sustained = new Set();
  let pedal = false;
  const changes = []; // { t, notes (triées) }
  const push = (t) => changes.push({ t, notes: [...new Set([...held, ...sustained])].sort((a, b) => a - b) });
  for (const e of journal.events) {
    if (e.type === "midiState") {
      e.held.forEach((n) => held.add(n));
      e.sustained.forEach((n) => sustained.add(n));
      pedal = e.pedal;
    } else if (e.type === "midiOn") {
      held.add(e.note);
      sustained.delete(e.note);
    } else if (e.type === "midiOff") {
      held.delete(e.note);
      if (pedal) sustained.add(e.note);
    } else if (e.type === "pedal") {
      pedal = e.down;
      if (!pedal) sustained.clear();
    } else continue;
    push(e.t);
  }
  return changes;
}

/**
 * Accords joués : de la première touche d'un groupe (touches à moins de 80 ms) au
 * premier relâchement, ou, pédale enfoncée, jusqu'à ce que la pédale remonte ou que
 * l'accord suivant commence (les notes sonnent encore). { start, end, notes,
 * velocities, pedal } : pedal indique un accord prolongé par la pédale.
 */
function chordSegments() {
  const segments = [];
  let current = null;
  let pedal = false;
  const close = (seg, t) => {
    if (seg && seg.end === null) seg.end = t;
  };
  for (const e of journal.events) {
    if (e.type === "midiState") pedal = e.pedal;
    else if (e.type === "pedal") {
      if (pedal && !e.down && current?.released) close(current, e.t);
      pedal = e.down;
    } else if (e.type === "midiOn") {
      if (!current || e.t - current.start > 80) {
        close(current, e.t);
        current = { start: e.t, end: null, notes: [], velocities: [], released: false, pedal: false };
        segments.push(current);
      }
      current.notes.push(e.note);
      current.velocities.push(e.velocity);
    } else if (e.type === "midiOff") {
      if (current && current.notes.includes(e.note) && !current.released) {
        current.released = true;
        if (pedal) current.pedal = true;
        else close(current, e.t);
      }
    }
  }
  return segments.filter((s) => s.end !== null).map((s) => ({ ...s, notes: s.notes.sort((a, b) => a - b) }));
}

// ─── Notes affichées par le micro ───
function liveTimeline() {
  const shown = new Set();
  const changes = [];
  for (const e of journal.events) {
    if (e.type === "micState") e.notes.forEach((n) => shown.add(n));
    else if (e.type === "micOn") shown.add(e.note);
    else if (e.type === "micOff") shown.delete(e.note);
    else continue;
    changes.push({ t: e.t, notes: [...shown].sort((a, b) => a - b) });
  }
  return changes;
}

/** Rejoue le son à travers un moteur, aux instants d'analyse de l'enregistrement. */
function replayTimeline(id) {
  const engine = createChromaEngine({ sampleRate, version: Number(id.slice(1)), rules: rulesOverride });
  const tracker = createNoteTracker({ ...engine.tracker, ...trackerOverride });
  const frame = new Float32Array(engine.frameSize);
  const changes = [];
  let previous = null;
  let last = "";
  for (const e of journal.events) {
    if (e.type !== "frame") continue;
    const end = samplesAt(e.t);
    frame.fill(0);
    const from = Math.max(0, end - engine.frameSize);
    frame.set(samples.subarray(from, end), engine.frameSize - (end - from));
    const held = tracker.update(engine.analyze(frame), previous === null ? 0 : e.t - previous);
    previous = e.t;
    const key = held.join(",");
    if (key !== last) {
      changes.push({ t: e.t, notes: held });
      last = key;
    }
  }
  return changes;
}

/** Notes d'une chronologie à l'instant t. */
function at(timeline, t) {
  let notes = [];
  for (const c of timeline) {
    if (c.t > t) break;
    notes = c.notes;
  }
  return notes;
}

const pcsKey = (notes) => [...new Set(notes.map((n) => n % 12))].sort((a, b) => a - b).join(",");
const readingKey = (notes) => (notes.length ? `${pcsKey(notes)}/${Math.min(...notes) % 12}` : "");
const NAMES = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 2}`; // Do3 = MIDI 60
const chordName = (notes) => (notes.length ? identifyChords(notes, "sharp")[0]?.chordName ?? "?" : "—");
const fmt = (notes) => (notes.length ? notes.map(noteName).join(" ") : "rien");

/**
 * Évaluation d'une chronologie sur les accords : pour chacun, délai jusqu'à la bonne
 * lecture (classes + basse), part du temps juste (de +400 ms au relâchement),
 * lecture la plus fréquente, et notes affichées après le relâchement.
 */
function evaluate(timeline, segments) {
  return segments.map((seg) => {
    const truth = readingKey(seg.sounding);
    let latency = null;
    let ok = 0;
    let total = 0;
    const seen = new Map();
    for (let t = seg.start; t < seg.end; t += 10) {
      const notes = at(timeline, t);
      const good = readingKey(notes) === truth;
      if (good && latency === null) latency = t - seg.start;
      // Accord bref (répété vite) : on juge sa seconde moitié
      if (t >= seg.start + Math.min(400, (seg.end - seg.start) / 2)) {
        total++;
        if (good) ok++;
        const key = notes.join(",");
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    const mode = [...seen.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    // Après le relâchement : notes encore affichées 300 ms plus tard
    const after = at(timeline, seg.end + 300);
    // Extinction : délai entre le relâchement et la fin de la lecture de cet accord
    let release = null;
    for (let t = seg.end; t < seg.end + 3000; t += 10) {
      if (readingKey(at(timeline, t)) !== truth) { release = t - seg.end; break; }
    }
    return {
      latency,
      share: total ? ok / total : null,
      mode: mode ? mode.split(",").map(Number) : [],
      after,
      release,
    };
  });
}

// ─── Rapport ───
// Vérité de chaque accord : tout ce qui sonne juste après ses frappes (touches encore
// tenues d'avant, notes prolongées par la pédale), pas seulement les touches frappées
const midiChanges = midiTimeline();
const segments = chordSegments().map((seg) => ({ ...seg, sounding: at(midiChanges, seg.start + 100) }));
// Plage de référence : celle de la dernière version du moteur A
const MIC_MAX_MIDI = createChromaEngine({ sampleRate, version: CHROMA_LATEST }).maxMidi;
const inRange = (seg) => seg.sounding.every((n) => n >= MIC_MIN_MIDI && n <= MIC_MAX_MIDI);
const timelines = { live: liveTimeline() };
for (const id of engines) timelines[id] = replayTimeline(id);
const results = Object.fromEntries(Object.entries(timelines).map(([k, tl]) => [k, evaluate(tl, segments)]));

console.log(`${journalPath} : moteur ${journal.engine}, ${(journal.samples / sampleRate).toFixed(1)} s, ${segments.length} accords (${segments.filter(inRange).length} dans la plage MIDI ${MIC_MIN_MIDI}-${MIC_MAX_MIDI})\n`);

const summary = (key, filter) => {
  const rows = results[key].filter((_, i) => filter(segments[i]));
  const correct = rows.filter((r) => r.share !== null && r.share >= 0.5).length;
  const share = rows.reduce((s, r) => s + (r.share ?? 0), 0) / rows.length;
  const lat = rows.map((r) => r.latency).filter((l) => l !== null).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : null;
  const ghosts = rows.filter((r) => r.after.length > 0).length;
  const rel = rows.filter((r) => r.share !== null && r.share >= 0.5).map((r) => r.release ?? 3000).sort((a, b) => a - b);
  const relMedian = rel.length ? rel[Math.floor(rel.length / 2)] : null;
  return `${key.padEnd(5)} justes ${String(correct).padStart(2)}/${rows.length}  temps juste ${(100 * share).toFixed(0).padStart(3)} %  délai médian ${median === null ? "—" : `${median} ms`}  extinction médiane ${relMedian === null ? "—" : `${relMedian} ms`}  encore affiché à +300 ms : ${ghosts}`;
};
console.log("Dans la plage du moteur A :");
for (const key of Object.keys(results)) console.log("  " + summary(key, inRange));
console.log(`Hors plage (au moins une note sous MIDI ${MIC_MIN_MIDI} ou au-dessus de ${MIC_MAX_MIDI}) :`);
for (const key of Object.keys(results)) console.log("  " + summary(key, (s) => !inRange(s)));

console.log("\nAccord par accord (lecture la plus fréquente ; ✓ si juste au moins la moitié du temps) :");
segments.forEach((seg, i) => {
  const cols = Object.keys(results).map((key) => {
    const r = results[key][i];
    const good = r.share !== null && r.share >= 0.5;
    const lat = r.latency === null ? "" : ` ${r.latency}ms`;
    return `${key}:${good ? "✓" : "✗"}${lat}${good && !detail ? "" : ` [${fmt(r.mode)}]`}`;
  });
  const range = (inRange(seg) ? "" : " (hors plage)") + (seg.pedal ? " (pédale)" : "");
  console.log(`${(seg.start / 1000).toFixed(1).padStart(6)}s ${fmt(seg.sounding).padEnd(28)} ${chordName(seg.sounding).padEnd(8)} v${seg.velocities.join(",")}${range}\n         ${cols.join("  ")}`);
});
