import { describe, expect, test, vi } from "vitest";
import { decodeNotification, errorCode } from "./useBluetoothMIDI.js";

/** Notification BLE MIDI (DataView, comme Web Bluetooth la fournit). */
const packet = (...bytes) => new DataView(new Uint8Array(bytes).buffer);
const handlers = () => ({ onNoteOn: vi.fn(), onNoteOff: vi.fn(), onSustain: vi.fn() });

describe("decodeNotification (paquets BLE MIDI)", () => {
  test("note on : en-tête, horodatage, puis le message MIDI", () => {
    const h = handlers();
    decodeNotification(packet(0x80, 0x80, 0x90, 60, 100), h);
    expect(h.onNoteOn).toHaveBeenCalledWith(60);
  });

  test("plusieurs notes dans un paquet (running status)", () => {
    const h = handlers();
    decodeNotification(packet(0x80, 0x80, 0x90, 60, 100, 64, 90), h);
    expect(h.onNoteOn.mock.calls).toEqual([[60], [64]]);
  });

  test("messages différents dans un paquet, chacun avec son horodatage", () => {
    const h = handlers();
    decodeNotification(packet(0x80, 0x80, 0x90, 60, 100, 0x81, 0x80, 67, 0, 0x82, 0xb0, 64, 127), h);
    expect(h.onNoteOn).toHaveBeenCalledWith(60);
    expect(h.onNoteOff).toHaveBeenCalledWith(67);
    expect(h.onSustain).toHaveBeenCalledWith(true);
  });

  test("vue sur une partie d'un tampon plus grand : seuls ses octets sont lus", () => {
    const h = handlers();
    const buffer = new Uint8Array([0xff, 0xff, 0x80, 0x80, 0x90, 62, 100, 0xff]).buffer;
    decodeNotification(new DataView(buffer, 2, 5), h);
    expect(h.onNoteOn.mock.calls).toEqual([[62]]);
  });

  test("paquet vide, absent ou invalide : rien, sans erreur", () => {
    const h = handlers();
    expect(() => {
      decodeNotification(null, h);
      decodeNotification(packet(), h);
      decodeNotification(packet(1, 2, 3), h);
    }).not.toThrow();
    expect(h.onNoteOn).not.toHaveBeenCalled();
    expect(h.onNoteOff).not.toHaveBeenCalled();
  });
});

describe("errorCode (erreurs Web Bluetooth → message affiché)", () => {
  const error = (name, message = "") => Object.assign(new Error(message), { name });

  test.each([
    [error("NotFoundError", "User cancelled the requestDevice() chooser."), "cancelled"],
    [error("NotFoundError", "Bluetooth adapter not available."), "adapterOff"],
    [error("NotAllowedError"), "denied"],
    [error("SecurityError"), "denied"],
    [error("NetworkError", "GATT Server is disconnected."), "failed"],
    [new Error("boom"), "failed"],
    [undefined, "failed"],
  ])("%o → %s", (err, code) => {
    expect(errorCode(err)).toBe(code);
  });
});
