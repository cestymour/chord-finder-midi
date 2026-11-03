// Son de piano synthétisé avec la Web Audio API : aucun fichier audio à charger.
//
// Chaque note est une petite synthèse additive : quelques partiels légèrement
// inharmoniques (comme une corde de piano), les aigus s'éteignant plus vite que
// le fondamental, un filtre passe-bas qui s'assombrit avec le temps, et un bref
// bruit filtré pour l'attaque du marteau.

const PARTIALS = 8;
const INHARMONICITY = 0.0004; // raideur de la corde : les partiels montent un peu
const RELEASE_S = 0.12; // étouffoir quand on relâche la touche

let ctx = null;
let master = null;
let noiseBuffer = null;
const voices = new Map(); // midi → { gain, nodes }
let enabled = true;
const listeners = new Set(); // (midi, delay) → void, appelés à chaque note jouée

/** S'abonne aux notes jouées (pour les faire briller à l'écran). Renvoie le désabonnement. */
export function subscribePianoNotes(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Active ou coupe le son (réglage « Son » des paramètres). */
export function setPianoSoundEnabled(on) {
  enabled = on;
  if (!on) stopAllPianoNotes();
}

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    // Le compresseur évite la saturation quand plusieurs notes sonnent ensemble.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(compressor).connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // Les navigateurs créent le contexte suspendu tant qu'il n'y a pas eu de geste.
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/**
 * Joue une note (numéro MIDI), éventuellement après `delay` secondes.
 * À appeler depuis un geste utilisateur (clic), sinon le navigateur reste muet.
 */
export function playPianoNote(midi, { velocity = 0.8, delay = 0 } = {}) {
  if (!enabled) return;
  const ac = getContext();
  if (!ac) return;
  stopPianoNote(midi);
  listeners.forEach((listener) => listener(midi, delay));

  const now = ac.currentTime + delay;
  const f0 = 440 * 2 ** ((midi - 69) / 12);
  // Les graves résonnent plus longtemps que les aigus.
  const decay = 1.2 + 2.8 * Math.max(0, Math.min(1, (84 - midi) / 48));
  const end = now + decay * 2.5;

  const voiceGain = ac.createGain();
  voiceGain.gain.value = velocity;
  voiceGain.connect(master);

  // Timbre brillant à l'attaque, plus sourd ensuite.
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.5;
  filter.frequency.setValueAtTime(Math.min(f0 * 12, 16000), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(f0 * 2.5, 400), now + decay);
  filter.connect(voiceGain);

  const nodes = [voiceGain, filter];

  for (let n = 1; n <= PARTIALS; n++) {
    const freq = n * f0 * Math.sqrt(1 + INHARMONICITY * n * n);
    if (freq > ac.sampleRate / 2) break;
    const osc = ac.createOscillator();
    osc.frequency.value = freq;
    const g = ac.createGain();
    const amp = 0.25 / n ** 1.3;
    const partialDecay = decay / (1 + 0.4 * (n - 1));
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.004);
    g.gain.setTargetAtTime(0, now + 0.004, partialDecay / 3);
    osc.connect(g).connect(filter);
    osc.start(now);
    osc.stop(end);
    nodes.push(osc, g);
  }

  // Attaque du marteau : bruit court filtré autour de la note.
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = Math.min(f0 * 4, 8000);
  band.Q.value = 1;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.08, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  noise.connect(band).connect(noiseGain).connect(voiceGain);
  noise.start(now);
  nodes.push(noise, band, noiseGain);

  const voice = { gain: voiceGain, nodes };
  voices.set(midi, voice);
  nodes[2].onended = () => {
    if (voices.get(midi) === voice) voices.delete(midi);
    nodes.forEach((node) => node.disconnect());
  };
}

/** Joue des notes en arpège, du grave à l'aigu ; elles résonnent ensemble à la fin. */
export function playPianoArpeggio(midis, step = 0.11) {
  stopAllPianoNotes();
  [...midis].sort((a, b) => a - b).forEach((midi, i) => playPianoNote(midi, { delay: i * step }));
}

/** Étouffe une note qui sonne encore (touche relâchée). */
export function stopPianoNote(midi) {
  const voice = voices.get(midi);
  if (!voice || !ctx) return;
  voices.delete(midi);
  const now = ctx.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  voice.gain.gain.setTargetAtTime(0, now, RELEASE_S / 3);
  voice.nodes.forEach((node) => {
    if (node instanceof AudioScheduledSourceNode) {
      try { node.stop(now + RELEASE_S * 2); } catch { /* déjà arrêté */ }
    }
  });
}

/** Étouffe toutes les notes. */
export function stopAllPianoNotes() {
  [...voices.keys()].forEach(stopPianoNote);
}
