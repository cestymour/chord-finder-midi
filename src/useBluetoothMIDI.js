import { useState, useCallback, useRef } from "react";
import { parsePacket } from "ble-midi-parser";

// UUID standard du service MIDI over BLE (défini par la spécification Bluetooth)
const MIDI_SERVICE_UUID = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
const MIDI_CHARACTERISTIC_UUID = "7772e5db-3868-4112-a1a9-f2669d106bf3";

/**
 * Hook pour initier une connexion Bluetooth MIDI via l'API Web Bluetooth.
 *
 * Lorsqu'un périphérique BLE MIDI est connecté, le système Android (ou autre OS)
 * l'expose généralement comme un port MIDI standard, qui sera alors détecté
 * par le hook useMIDI existant via l'API Web MIDI.
 *
 * Retourne :
 * - btStatus : "idle" | "scanning" | "connecting" | "connected" | "error" | "unsupported"
 * - btError  : message d'erreur éventuel
 * - requestBluetoothMIDI : fonction à appeler pour lancer le scan/connexion
 * - disconnectBluetooth  : fonction pour déconnecter manuellement
 */
export default function useBluetoothMIDI({ onNoteOn, onNoteOff } = {}) {
  const [btStatus, setBtStatus] = useState(() =>
    navigator.bluetooth ? "idle" : "unsupported"
  );
  const [btError, setBtError] = useState(null);

  const deviceRef = useRef(null);
  const serverRef = useRef(null);
  const characteristicRef = useRef(null);
  const disconnectHandlerRef = useRef(null);
  const characteristicValueChangedHandlerRef = useRef(null);
  // Permet d'ignorer les événements "gattserverdisconnected" d'un ancien essai
  // (quand l'utilisateur reclique et qu'un nouveau try démarre).
  const connectionAttemptIdRef = useRef(0);

  const requestBluetoothMIDI = useCallback(async () => {
    if (!navigator.bluetooth) {
      setBtStatus("unsupported");
      setBtError("Web Bluetooth non supporté par ce navigateur.");
      return;
    }

    // Si on a déjà une connexion précédente, on la nettoie avant d'enchaîner.
    try {
      if (deviceRef.current && disconnectHandlerRef.current) {
        deviceRef.current.removeEventListener(
          "gattserverdisconnected",
          disconnectHandlerRef.current
        );
      }
      disconnectHandlerRef.current = null;

      if (characteristicRef.current) {
        if (characteristicValueChangedHandlerRef.current) {
          try {
            characteristicRef.current.removeEventListener(
              "characteristicvaluechanged",
              characteristicValueChangedHandlerRef.current
            );
          } catch {
            // ignore
          }
        }
        try {
          // stopNotifications peut retourner une promesse qui peut rejeter
          // si le GATT est déjà déconnecté => on doit l'attendre/attraper.
          await characteristicRef.current.stopNotifications().catch(() => {});
        } catch {
          // ignore
        }
      }
      characteristicRef.current = null;
      characteristicValueChangedHandlerRef.current = null;

      if (serverRef.current && serverRef.current.connected) {
        serverRef.current.disconnect();
      }
      serverRef.current = null;
      deviceRef.current = null;
    } catch {
      // Best-effort cleanup.
    }

    setBtStatus("scanning");
    setBtError(null);

    let attemptId = 0;
    try {
      // 1. Demander à l'utilisateur de sélectionner un périphérique BLE MIDI
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [MIDI_SERVICE_UUID] }],
        // Certains périphériques n'annoncent pas toujours le service dans les
        // données d'advertising; optionalServices aide à le retrouver après connexion.
        optionalServices: [MIDI_SERVICE_UUID],
        // Fallback : certains périphériques n'annoncent pas le service dans
        // les données d'advertising, on peut aussi utiliser acceptAllDevices
        // avec optionalServices, mais les filtres sont préférables pour l'UX.
      });

      // Nettoyer un éventuel listener précédent.
      if (deviceRef.current && disconnectHandlerRef.current) {
        deviceRef.current.removeEventListener(
          "gattserverdisconnected",
          disconnectHandlerRef.current
        );
      }

      deviceRef.current = device;
      characteristicRef.current = null;

      attemptId = ++connectionAttemptIdRef.current;

      // Écouter la déconnexion
      const onGattDisconnected = () => {
        // Si un nouvel essai a démarré, ignore cet ancien événement.
        if (attemptId !== connectionAttemptIdRef.current) return;
        if (characteristicRef.current && characteristicValueChangedHandlerRef.current) {
          try {
            characteristicRef.current.removeEventListener(
              "characteristicvaluechanged",
              characteristicValueChangedHandlerRef.current
            );
          } catch {
            // ignore
          }
        }
        characteristicValueChangedHandlerRef.current = null;
        setBtStatus("idle");
        serverRef.current = null;
        characteristicRef.current = null;
      };
      disconnectHandlerRef.current = onGattDisconnected;
      device.addEventListener("gattserverdisconnected", onGattDisconnected);

      // 2-5. Connect + init (avec retry sur déconnexion GATT).
      // Erreur typique: "GATT Server is disconnected. Cannot retrieve services."
      // -> on reconnnect et on recommence.
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attemptId !== connectionAttemptIdRef.current) return;
        try {
          setBtStatus("connecting");

          const server = await device.gatt.connect();
          serverRef.current = server;

          const service = await server.getPrimaryService(MIDI_SERVICE_UUID);

          const characteristic = await service.getCharacteristic(
            MIDI_CHARACTERISTIC_UUID
          );
          characteristicRef.current = characteristic;

          // Activer les notifications (pour que l'OS expose le port via Web MIDI).
          await characteristic.startNotifications();

          // Sur certains environnements (notamment Windows), Chrome ne mappe
          // pas forcément le périphérique BLE MIDI vers Web MIDI. On décode
          // alors directement les notifications et on notifie l'app.
          const handler = (event) => {
            if (!onNoteOn && !onNoteOff) return;
            const value = event?.target?.value;
            if (!value) return;

            const packet = new Uint8Array(
              value.buffer,
              value.byteOffset,
              value.byteLength
            );

            let info;
            try {
              info = parsePacket(packet);
            } catch {
              return;
            }
            if (!info?.events?.length) return;

            for (const ev of info.events) {
              const status = ev.midiStatus;
              const one = ev.midiOne;
              const two = ev.midiTwo;
              if (
                typeof status !== "number" ||
                typeof one !== "number" ||
                typeof two !== "number"
              )
                continue;

              const msgType = status & 0xf0;

              // Note On (velocity > 0)
              if (msgType === 0x90 && two > 0) {
                onNoteOn?.(one);
              }
              // Note Off (0x80) ou Note On avec velocity=0
              else if (msgType === 0x80 || (msgType === 0x90 && two === 0)) {
                onNoteOff?.(one);
              }
            }
          };

          characteristicValueChangedHandlerRef.current = handler;
          characteristic.addEventListener(
            "characteristicvaluechanged",
            handler
          );

          if (attemptId !== connectionAttemptIdRef.current) return;
          setBtError(null);
          setBtStatus("connected");
          break;
        } catch (err) {
          if (attemptId !== connectionAttemptIdRef.current) return;

          const msg = err?.message || "";
          const isGattDisconnected =
            msg.includes("GATT Server is disconnected") ||
            msg.includes("Cannot retrieve services") ||
            msg.includes("disconnected");

          if (isGattDisconnected && attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }

      // Note : Sur Android/Chrome, le simple fait d'établir cette connexion
      // BLE MIDI et de démarrer les notifications devrait rendre le
      // périphérique visible à l'API Web MIDI (navigator.requestMIDIAccess).
      // Le hook useMIDI détectera le nouveau port via son onstatechange.

    } catch (err) {
      // Si un nouvel essai a commencé pendant que l'ancien attendait encore,
      // on n'écrase pas l'état du nouvel essai.
      if (attemptId !== 0 && attemptId !== connectionAttemptIdRef.current) return;

      // L'utilisateur a annulé le sélecteur ou une erreur réseau
      if (err.name === "NotFoundError") {
        // L'utilisateur a annulé la boîte de dialogue — pas une vraie erreur
        setBtStatus("idle");
        setBtError(null);
      } else {
        setBtStatus("error");
        setBtError(err.message || "Erreur de connexion Bluetooth.");
      }
    }
  }, [onNoteOn, onNoteOff]);

  const disconnectBluetooth = useCallback(() => {
    if (deviceRef.current && disconnectHandlerRef.current) {
      deviceRef.current.removeEventListener(
        "gattserverdisconnected",
        disconnectHandlerRef.current
      );
    }
    disconnectHandlerRef.current = null;

    if (characteristicRef.current) {
      if (characteristicValueChangedHandlerRef.current) {
        try {
          characteristicRef.current.removeEventListener(
            "characteristicvaluechanged",
            characteristicValueChangedHandlerRef.current
          );
        } catch {
          // ignore
        }
      }
      characteristicValueChangedHandlerRef.current = null;
      // Stoppe les notifications si possible (évite certains états "zombies").
      try {
        // Même remarque : stopNotifications peut rejeter (promesse).
        // Ici on best-effort sans bloquer l'UI.
        characteristicRef.current.stopNotifications().catch(() => {});
      } catch {
        // ignore
      }
    }
    characteristicRef.current = null;

    if (serverRef.current && serverRef.current.connected) {
      serverRef.current.disconnect();
    }
    serverRef.current = null;
    deviceRef.current = null;
    setBtStatus("idle");
    setBtError(null);
  }, []);

  return {
    btStatus,
    btError,
    requestBluetoothMIDI,
    disconnectBluetooth,
  };
}
