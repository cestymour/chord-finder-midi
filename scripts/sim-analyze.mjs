// Essais du mode micro : analyse d'un enregistrement de simulation (logs/sim-*.json
// et son .wav, voir src/simRecorder.js).
//
//   node scripts/sim-analyze.mjs [logs/sim-….json] [--engines A1,A2,A3] [--detail]
//
// La vérité : les touches du piano MIDI (et la pédale). Pour chaque accord joué,
// on compare les notes affichées par le micro :
// - « live » : ce que l'appli a affiché pendant l'enregistrement ;
// - A1, A2, A3… : le son enregistré rejoué hors ligne à travers ces moteurs, aux
//   mêmes instants d'analyse que pendant l'enregistrement.
// Critère : mêmes classes de hauteur et même basse (donc même accord et même
// renversement). Les notes hors de la plage du moteur A (MIDI 36 à 88) sont
// comptées à part.

import { readFileSync, readdirSync } from "node:fs";
import { createChromaEngine, MIC_MIN_MIDI, MIC_MAX_MIDI } from "../src/micChroma.js";
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
const engines = option("--engines", "A1,A2,A3").split(",").filter(Boolean);

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
 * premier relâchement. { start, end, notes, velocities }.
 */
function chordSegments() {
  const segments = [];
  let current = null;
  const held = new Map();
  for (const e of journal.events) {
    if (e.type === "midiOn") {
      if (!current || e.t - current.start > 80) {
        if (current && current.end === null) current.end = e.t;
        current = { start: e.t, end: null, notes: [], velocities: [] };
        segments.push(current);
      }
      current.notes.push(e.note);
      current.velocities.push(e.velocity);
      held.set(e.note, current);
    } else if (e.type === "midiOff") {
      const seg = held.get(e.note);
      held.delete(e.note);
      if (seg && seg.end === null) seg.end = e.t;
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
  const engine = createChromaEngine({ sampleRate, attackGate: id !== "A1", octaveFix: id === "A3" });
  const tracker = createNoteTracker();
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
    const truth = readingKey(seg.notes);
    let latency = null;
    let ok = 0;
    let total = 0;
    const seen = new Map();
    for (let t = seg.start; t < seg.end; t += 10) {
      const notes = at(timeline, t);
      const good = readingKey(notes) === truth;
      if (good && latency === null) latency = t - seg.start;
      if (t >= seg.start + 400) {
        total++;
        if (good) ok++;
        const key = notes.join(",");
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    const mode = [...seen.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    // Après le relâchement : notes encore affichées 300 ms plus tard
    const after = at(timeline, seg.end + 300);
    return {
      latency,
      share: total ? ok / total : null,
      mode: mode ? mode.split(",").map(Number) : [],
      after,
    };
  });
}

// ─── Rapport ───
const segments = chordSegments();
const inRange = (seg) => seg.notes.every((n) => n >= MIC_MIN_MIDI && n <= MIC_MAX_MIDI);
const timelines = { live: liveTimeline() };
for (const id of engines) timelines[id] = replayTimeline(id);
const results = Object.fromEntries(Object.entries(timelines).map(([k, tl]) => [k, evaluate(tl, segments)]));
void midiTimeline;

console.log(`${journalPath} : moteur ${journal.engine}, ${(journal.samples / sampleRate).toFixed(1)} s, ${segments.length} accords (${segments.filter(inRange).length} dans la plage MIDI ${MIC_MIN_MIDI}-${MIC_MAX_MIDI})\n`);

const summary = (key, filter) => {
  const rows = results[key].filter((_, i) => filter(segments[i]));
  const correct = rows.filter((r) => r.share !== null && r.share >= 0.5).length;
  const share = rows.reduce((s, r) => s + (r.share ?? 0), 0) / rows.length;
  const lat = rows.map((r) => r.latency).filter((l) => l !== null).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : null;
  const ghosts = rows.filter((r) => r.after.length > 0).length;
  return `${key.padEnd(5)} justes ${String(correct).padStart(2)}/${rows.length}  temps juste ${(100 * share).toFixed(0).padStart(3)} %  délai médian ${median === null ? "—" : `${median} ms`}  encore affiché 300 ms après relâchement : ${ghosts}`;
};
console.log("Dans la plage du moteur A :");
for (const key of Object.keys(results)) console.log("  " + summary(key, inRange));
console.log("Hors plage (au moins une note sous MIDI 36 ou au-dessus de 88) :");
for (const key of Object.keys(results)) console.log("  " + summary(key, (s) => !inRange(s)));

console.log("\nAccord par accord (lecture la plus fréquente ; ✓ si juste au moins la moitié du temps) :");
segments.forEach((seg, i) => {
  const cols = Object.keys(results).map((key) => {
    const r = results[key][i];
    const good = r.share !== null && r.share >= 0.5;
    const lat = r.latency === null ? "" : ` ${r.latency}ms`;
    return `${key}:${good ? "✓" : "✗"}${lat}${good && !detail ? "" : ` [${fmt(r.mode)}]`}`;
  });
  const range = inRange(seg) ? "" : " (hors plage)";
  console.log(`${(seg.start / 1000).toFixed(1).padStart(6)}s ${fmt(seg.notes).padEnd(28)} ${chordName(seg.notes).padEnd(8)} v${Math.round(seg.velocities.reduce((a, b) => a + b) / seg.velocities.length)}${range}\n         ${cols.join("  ")}`);
});
