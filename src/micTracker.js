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
//   remplace l'ancien d'un coup, sans mélange intermédiaire. Sur un appareil lent,
//   quand deux analyses sont espacées de plus de slowFrameMs, une seule suffit :
//   attendre la suivante retarderait trop l'affichage.
// - Silence : sous gateDb (avec hystérésis, enterDb pour commencer), plus de note.
// - Pas de nouvelle note sans attaque (si le moteur donne classEnergy, l'énergie de
//   chaque classe de hauteur) : sur un piano, une note commence toujours par un coup
//   de marteau. Une classe non tenue n'entre que si son énergie dépasse d'au moins
//   attackRatio la plus faible de ses attackFrames trames précédentes. Sans cela,
//   quand une note s'éteint, ce qui reste (résonance d'autres cordes, bruit de la
//   pièce) devient « le plus fort » et passerait les seuils relatifs : des notes
//   fantômes s'allumeraient. Les notes déjà tenues, elles, restent ou partent
//   comme avant.

const DEFAULTS = {
  onSalience: 0.15,
  offSalience: 0.08,
  stableFrames: 2,
  slowFrameMs: 300,
  enterDb: -50,
  gateDb: -58,
  attackRatio: 2, // +6 dB
  attackFrames: 6, // environ 300 ms à une analyse toutes les 50 ms
};

/**
 * Lecture d'une trame : classe de hauteur → note MIDI la plus grave, et basse.
 * attacking : classes qui peuvent entrer (null : toutes).
 */
function readFrame(notes, held, { onSalience, offSalience }, attacking = null) {
  const byPc = new Map();
  for (const { midi, salience } of notes) {
    const pc = midi % 12;
    const isHeld = held.has(pc);
    if (!isHeld && attacking && !attacking[pc]) continue;
    const threshold = isHeld ? offSalience : onSalience;
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
 * Crée un suivi. update(frame, elapsedMs) prend la sortie d'un moteur ({ notes, level })
 * et le temps écoulé depuis l'analyse précédente (facultatif), et renvoie les notes
 * MIDI tenues (tableau trié). reset() oublie tout.
 */
export function createNoteTracker(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  let output = new Map(); // classe → note MIDI affichée
  let outputKey = "";
  let pendingKey = null;
  let pendingCount = 0;
  let sounding = false; // au-dessus du seuil de silence
  let energyHistory = []; // classEnergy des trames précédentes, la plus récente à la fin

  const notesOf = () => [...output.values()].sort((a, b) => a - b);

  /** Classes en train d'attaquer (null si le moteur ne donne pas d'énergie). */
  const attackingClasses = (energy) => {
    if (!energy) return null;
    // Moins de attackFrames trames connues (début de l'écoute) : avant, rien
    const full = energyHistory.length >= opts.attackFrames;
    return energy.map((value, pc) => {
      let floor = full ? Infinity : 0;
      for (const past of energyHistory) if (past[pc] < floor) floor = past[pc];
      return value > 0 && value >= floor * opts.attackRatio;
    });
  };

  return {
    update({ notes, level, classEnergy }, elapsedMs = 0) {
      sounding = sounding ? level >= opts.gateDb : level >= opts.enterDb;
      const attacking = attackingClasses(classEnergy);
      if (classEnergy) {
        energyHistory.push(classEnergy);
        if (energyHistory.length > opts.attackFrames) energyHistory.shift();
      }
      const frame = sounding
        ? readFrame(notes, output, opts, attacking)
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
      const slow = elapsedMs >= opts.slowFrameMs;
      if (pendingCount >= opts.stableFrames || slow || (!sounding && frame.key === "")) {
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
      energyHistory = [];
    },
  };
}
