import { describe, expect, test, vi } from "vitest";
import { dispatchMidiMessage } from "./midiMessages.js";

const handlers = () => ({ onNoteOn: vi.fn(), onNoteOff: vi.fn(), onSustain: vi.fn() });

describe("dispatchMidiMessage", () => {
  test("0x90 avec vélocité > 0 : note on", () => {
    const h = handlers();
    dispatchMidiMessage(0x90, 60, 100, h);
    expect(h.onNoteOn).toHaveBeenCalledWith(60);
    expect(h.onNoteOff).not.toHaveBeenCalled();
  });

  test("0x90 avec vélocité 0 : note off", () => {
    const h = handlers();
    dispatchMidiMessage(0x90, 60, 0, h);
    expect(h.onNoteOff).toHaveBeenCalledWith(60);
    expect(h.onNoteOn).not.toHaveBeenCalled();
  });

  test("0x80 : note off, quelle que soit la vélocité", () => {
    const h = handlers();
    dispatchMidiMessage(0x80, 64, 64, h);
    expect(h.onNoteOff).toHaveBeenCalledWith(64);
  });

  test("le canal MIDI (4 bits bas du statut) est ignoré", () => {
    const h = handlers();
    dispatchMidiMessage(0x9f, 61, 1, h);
    dispatchMidiMessage(0x83, 61, 0, h);
    expect(h.onNoteOn).toHaveBeenCalledWith(61);
    expect(h.onNoteOff).toHaveBeenCalledWith(61);
  });

  test("pédale de sustain (contrôleur 64) : enfoncée à partir de 64", () => {
    const h = handlers();
    dispatchMidiMessage(0xb0, 64, 127, h);
    dispatchMidiMessage(0xb0, 64, 64, h);
    dispatchMidiMessage(0xb0, 64, 63, h);
    dispatchMidiMessage(0xb2, 64, 0, h);
    expect(h.onSustain.mock.calls).toEqual([[true], [true], [false], [false]]);
  });

  test("autres contrôleurs et autres messages ignorés", () => {
    const h = handlers();
    dispatchMidiMessage(0xb0, 1, 127, h); // molette de modulation
    dispatchMidiMessage(0xe0, 0, 64, h); // pitch bend
    dispatchMidiMessage(0xc0, 5, 0, h); // changement de programme
    dispatchMidiMessage(0xf8, 0, 0, h); // horloge
    expect(h.onNoteOn).not.toHaveBeenCalled();
    expect(h.onNoteOff).not.toHaveBeenCalled();
    expect(h.onSustain).not.toHaveBeenCalled();
  });

  test("callbacks absents : pas d'erreur", () => {
    expect(() => {
      dispatchMidiMessage(0x90, 60, 100, {});
      dispatchMidiMessage(0x80, 60, 0, {});
      dispatchMidiMessage(0xb0, 64, 127, {});
    }).not.toThrow();
  });
});
