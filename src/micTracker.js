// Mode micro : suivi des notes dans le temps, commun à tous les moteurs.
//
// Un moteur (micChroma.js…) dit, trame par trame (toutes les 50 ms environ),
// quelles notes il entend : { notes: [{ midi, salience }], level }. Le micro ne
// voit ni l'enfoncement ni le relâchement des touches, ni la pédale : ce module
// décide quelles notes sont « tenues » et les envoie à l'appli comme un piano MIDI.
//
// - Repliement en classes de hauteur (le chroma) : l'octave des notes du haut est
//   souvent incertaine et ne change pas l'accord ; seule la note la plus grave
//   compte (notation C/E). Chaque classe garde sa note la plus grave entendue.
// - Hystérésis : une note entre au-dessus de onSalience (relatif à la plus forte),
//   une note déjà tenue reste jusqu'à offSalience.
// - Stabilité : l'ensemble affiché ne change que quand la même lecture (classes et
//   basse) revient sur `stableFrames` trames de suite. Une note qui clignote d'une
//   trame à l'autre ne fait donc pas clignoter l'accord, et un nouvel accord
//   remplace l'ancien d'un coup, sans mélange intermédiaire.
// - Silence : sous gateDb (avec hystérésis, enterDb pour commencer), plus de note.

const DEFAULTS = {
  onSalience: 0.15,
  offSalience: 0.08,
  stableFrames: 2,
  enterDb: -50,
  gateDb: -58,
};

/** Lecture d'une trame : classe de hauteur → note MIDI la plus grave, et basse. */
function readFrame(notes, held, { onSalience, offSalience }) {
  const byPc = new Map();
  for (const { midi, salience } of notes) {
    const pc = midi % 12;
    const threshold = held.has(pc) ? offSalience : onSalience;
    if (salience < threshold) continue;
    const prev = byPc.get(pc);
    if (prev === undefined || midi < prev) byPc.set(pc, midi);
  }
  let bass = null;
  byPc.forEach((midi) => { if (bass === null || midi < bass) bass = midi; });
  const pcs = [...byPc.keys()].sort((a, b) => a - b);
  // Clé de comparaison : classes jouées et classe de la basse
  const key = pcs.length === 0 ? "" : `${pcs.join(",")}/${bass % 12}`;
  return { byPc, key };
}

/**
 * Crée un suivi. update(frame) prend la sortie d'un moteur ({ notes, level }) et
 * renvoie les notes MIDI tenues (tableau trié). reset() oublie tout.
 */
export function createNoteTracker(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  let output = new Map(); // classe → note MIDI affichée
  let outputKey = "";
  let pendingKey = null;
  let pendingCount = 0;
  let sounding = false; // au-dessus du seuil de silence

  const notesOf = () => [...output.values()].sort((a, b) => a - b);

  return {
    update({ notes, level }) {
      sounding = sounding ? level >= opts.gateDb : level >= opts.enterDb;
      const frame = sounding
        ? readFrame(notes, output, opts)
        : { byPc: new Map(), key: "" };

      if (frame.key === outputKey) {
        pendingKey = null;
        pendingCount = 0;
        return notesOf();
      }
      if (frame.key === pendingKey) pendingCount++;
      else {
        pendingKey = frame.key;
        pendingCount = 1;
      }
      // Silence : relâché tout de suite (pas de lecture à confirmer)
      if (pendingCount >= opts.stableFrames || (!sounding && frame.key === "")) {
        output = frame.byPc;
        outputKey = frame.key;
        pendingKey = null;
        pendingCount = 0;
      }
      return notesOf();
    },
    reset() {
      output = new Map();
      outputKey = "";
      pendingKey = null;
      pendingCount = 0;
      sounding = false;
    },
  };
}
