// Essais du mode micro : enregistrement de simulation (serveur de développement).
//
// Un piano numérique est branché (USB ou Bluetooth) et le micro écoute ses
// haut-parleurs : les touches MIDI sont la vérité, comparée ensuite à ce que le
// micro a trouvé. Un enregistrement garde :
// - le son du micro (WAV mono 16 bits), pour rejouer la séance hors ligne à travers
//   n'importe quelle version des moteurs ;
// - un journal JSON du même nom : touches et pédale MIDI, notes affichées par le
//   micro, sortie du moteur à chaque analyse, avec leur instant en ms depuis le début
//   de l'enregistrement, et des repères pour caler le son sur ces instants.
// Les deux fichiers sont écrits dans logs/ par le serveur de Vite (vite.config.js).

/** Durée entre deux repères son ↔ horloge (en blocs de 1024 échantillons, ~1 s). */
const MARK_EVERY_BLOCKS = 47;

/**
 * Nouvel enregistrement. log(type, data) ajoute un événement ; addAudio(bloc) un bloc
 * de son ; finish() → { wav: ArrayBuffer, journal: objet }.
 */
export function createSimRecording({ engine, sampleRate, now = () => performance.now() }) {
  const t0 = now();
  const startedAt = new Date();
  const events = [];
  const chunks = [];
  const marks = []; // [indice du premier échantillon du bloc, ms à son arrivée]
  let samples = 0;
  let blocks = 0;
  const time = () => Math.round((now() - t0) * 10) / 10;

  return {
    startedAt,
    engine,
    log(type, data = {}) {
      events.push({ t: time(), type, ...data });
    },
    addAudio(block) {
      if (blocks % MARK_EVERY_BLOCKS === 0) marks.push([samples, time()]);
      chunks.push(Float32Array.from(block));
      samples += block.length;
      blocks++;
    },
    finish() {
      marks.push([samples, time()]);
      return {
        wav: encodeWav(chunks, sampleRate),
        journal: {
          version: 1,
          startedAt: startedAt.toISOString(),
          engine,
          sampleRate,
          samples,
          // Repères : l'échantillon n est arrivé (fin de son bloc) vers l'instant t ms
          audioMarks: marks,
          events,
        },
      };
    },
  };
}

/** WAV mono PCM 16 bits à partir de blocs Float32 (−1 … 1). */
export function encodeWav(chunks, sampleRate) {
  const length = chunks.reduce((sum, c) => sum + c.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const text = (offset, s) => [...s].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const v = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

/** Nom de base des fichiers : sim-AAAAMMJJ-HHMMSS-<moteur>. */
export function simFileBase(date, engine) {
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const hour = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `sim-${day}-${hour}-${engine}`;
}

/** Envoie un fichier au serveur de développement (écrit dans logs/). */
export async function saveSimFile(name, body) {
  const response = await fetch(`/__sim/save?name=${encodeURIComponent(name)}`, { method: "POST", body });
  if (!response.ok) throw new Error(`${name} : ${response.status} ${await response.text()}`);
}
