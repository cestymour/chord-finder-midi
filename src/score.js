// Portée de la carte d'accord (fonctions pures, sans React ni VexFlow) :
// quelles notes écrire, à quelle hauteur, sur quelle(s) portée(s).
// Le dessin lui-même (VexFlow, chargé à la demande) est dans src/scoreRenderer.js.

// Classe de hauteur de chaque lettre naturelle (C D E F G A B)
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11];
const VEX_LETTERS = ["c", "d", "e", "f", "g", "a", "b"];
/** Altérations VexFlow, indexées par `alter` + 2. */
export const VEX_ACCIDENTALS = ["bb", "b", "", "#", "##"];

/** Do central (MIDI 60) : sous lui, clé de fa ; à partir de lui, clé de sol. */
export const MIDDLE_C = 60;

// Notes qui tiennent sur une portée avec au plus 2 lignes supplémentaires
const TREBLE_RANGE = [57, 84]; // La3 – Do6 (convention française : La2 – Do5)
const BASS_RANGE = [36, 64]; // Do2 – Mi4 (convention française : Do1 – Mi3)

/**
 * Octave écrite d'une note orthographiée jouée sur la touche `midi`
 * (convention anglaise, Do central = C4) : Si♯ sur la touche 60 est un B♯3,
 * Do♭ sur la touche 59 un C♭4.
 */
export function writtenOctave({ letter, alter }, midi) {
  return Math.floor((midi - alter - LETTER_PCS[letter]) / 12) - 1;
}

/** Clé VexFlow d'une note (« c#/4 », « bbb/3 »). */
export function vexKey(note, midi) {
  return `${VEX_LETTERS[note.letter]}${VEX_ACCIDENTALS[note.alter + 2]}/${writtenOctave(note, midi)}`;
}

/**
 * Notes à écrire pour un accord affiché, du grave à l'aigu :
 * [{ midi, note, missing }].
 *
 * - Toutes les touches jouées (même note à plusieurs octaves comprise), écrites
 *   comme dans le tableau de la carte (`noteIntervalPairs`).
 * - Les notes facultatives non jouées (`missing`) sont ajoutées, entre
 *   parenthèses sur la portée : juste au-dessus de la fondamentale la plus
 *   grave, une octave plus haut pour les extensions (9, 11, 13).
 *
 * `rootPc` : fondamentale de l'accord (absente pour des notes non reconnues).
 */
export function buildScoreNotes(midiNotes, noteIntervalPairs, rootPc = null) {
  const spelled = new Map(noteIntervalPairs.filter((p) => !p.missing).map((p) => [p.pc, p.note]));
  const sorted = [...new Set(midiNotes)].sort((a, b) => a - b);
  const notes = sorted
    .filter((midi) => spelled.has(midi % 12))
    .map((midi) => ({ midi, note: spelled.get(midi % 12), missing: false }));

  const rootMidi = rootPc === null ? undefined : sorted.find((midi) => midi % 12 === rootPc);
  if (rootMidi !== undefined) {
    for (const pair of noteIntervalPairs) {
      if (!pair.missing) continue;
      const degree = parseInt(pair.interval.match(/\d+/)?.[0] ?? "0", 10);
      const midi = rootMidi + ((pair.pc - rootPc + 12) % 12) + (degree >= 9 ? 12 : 0);
      notes.push({ midi, note: pair.note, missing: true });
    }
  }
  return notes.sort((a, b) => a.midi - b.midi);
}

/**
 * Répartit les notes sur les portées : { treble, bass }, chacune une liste de
 * notes, ou null si cette portée n'est pas affichée.
 * - une seule clé quand toutes les notes y tiennent (2 lignes supplémentaires
 *   au plus) ; si les deux conviennent, celle du milieu de l'accord ;
 * - sinon les deux portées (piano), partagées au Do central.
 */
export function chooseStaves(notes) {
  if (notes.length === 0) return { treble: null, bass: null };
  const low = notes[0].midi;
  const high = notes.at(-1).midi;
  const fits = ([min, max]) => low >= min && high <= max;
  const fitsTreble = fits(TREBLE_RANGE);
  const fitsBass = fits(BASS_RANGE);

  if (fitsTreble && fitsBass) {
    return (low + high) / 2 >= MIDDLE_C ? { treble: notes, bass: null } : { treble: null, bass: notes };
  }
  if (fitsTreble || low >= MIDDLE_C) return { treble: notes, bass: null };
  if (fitsBass || high < MIDDLE_C) return { treble: null, bass: notes };
  return {
    treble: notes.filter((n) => n.midi >= MIDDLE_C),
    bass: notes.filter((n) => n.midi < MIDDLE_C),
  };
}
