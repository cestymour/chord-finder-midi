// Décodage des messages MIDI, commun à Web MIDI (App.jsx) et au Bluetooth direct
// (useBluetoothMIDI.js), pour que les deux sources se comportent de la même façon.

// Pédale de sustain : contrôleur 64, enfoncée à partir de 64
const SUSTAIN_CONTROLLER = 64;
const SUSTAIN_DOWN_THRESHOLD = 64;

/**
 * Appelle onNoteOn / onNoteOff / onSustain selon le message (statut + deux octets de données).
 * - 0x90 avec vélocité > 0 : note on
 * - 0x80, ou 0x90 avec vélocité 0 : note off
 * - 0xB0, contrôleur 64 : pédale de sustain (enfoncée à partir de 64)
 */
export function dispatchMidiMessage(status, data1, data2, { onNoteOn, onNoteOff, onSustain }) {
  const type = status & 0xf0;
  if (type === 0x90 && data2 > 0) onNoteOn?.(data1);
  else if (type === 0x80 || (type === 0x90 && data2 === 0)) onNoteOff?.(data1);
  else if (type === 0xb0 && data1 === SUSTAIN_CONTROLLER) onSustain?.(data2 >= SUSTAIN_DOWN_THRESHOLD);
}
