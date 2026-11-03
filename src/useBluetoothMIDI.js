import { useState, useEffect } from "react";
import { parsePacket } from "ble-midi-parser";
import { dispatchMidiMessage } from "./midiMessages.js";

// UUID standard du service MIDI over BLE (défini par la spécification Bluetooth)
const MIDI_SERVICE_UUID = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
const MIDI_CHARACTERISTIC_UUID = "7772e5db-3868-4112-a1a9-f2669d106bf3";

// Identifiant du dernier piano connecté, pour le proposer à la réouverture
// (quand le navigateur sait retrouver les appareils déjà autorisés).
const LAST_DEVICE_STORAGE_KEY = "instantchordbt.bluetoothDevice";

// Essais d'ouverture du lien GATT ("GATT Server is disconnected" arrive parfois juste après connect).
const OPEN_RETRIES = 3;
// Reconnexion automatique après une coupure : durée totale, puis pause entre deux essais.
const RECONNECT_WINDOW_MS = 20000;
const RECONNECT_DELAY_MS = 2000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Classe une erreur Web Bluetooth en code affichable par l'interface :
 * - "cancelled"  : sélecteur fermé sans choisir (le piano n'y figurait peut-être pas)
 * - "adapterOff" : Bluetooth de l'appareil désactivé ou absent
 * - "denied"     : accès au Bluetooth refusé (paramètres du site)
 * - "failed"     : connexion au piano impossible (souvent déjà connecté ailleurs)
 */
function errorCode(err) {
  const message = err?.message || "";
  if (err?.name === "NotFoundError") return /adapter/i.test(message) ? "adapterOff" : "cancelled";
  if (err?.name === "NotAllowedError" || err?.name === "SecurityError") return "denied";
  return "failed";
}

/** Décode une notification BLE MIDI et appelle les callbacks note on / note off / sustain. */
function decodeNotification(value, callbacks) {
  if (!value) return;
  let info;
  try {
    info = parsePacket(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  } catch {
    return;
  }
  for (const ev of info?.events ?? []) {
    const { midiStatus: status, midiOne: one, midiTwo: two } = ev;
    if (typeof status !== "number" || typeof one !== "number" || typeof two !== "number") continue;
    dispatchMidiMessage(status, one, two, callbacks);
  }
}

/** Coupe le lien GATT d'un appareil s'il est ouvert (sans erreur s'il est déjà coupé). */
function disconnectGatt(device) {
  try {
    if (device?.gatt?.connected) device.gatt.disconnect();
  } catch {
    // déjà déconnecté
  }
}

/**
 * Logique de connexion, hors de React. Chaque action (choix d'un piano, reconnexion,
 * déconnexion) incrémente `attempt` : une opération asynchrone plus ancienne
 * le voit et abandonne sans toucher à l'état.
 */
function createBluetoothController({ setStatus, setError, setKnownDevice }) {
  const ctx = {
    attempt: 0,
    device: null, // dernier piano choisi (gardé après une coupure pour s'y reconnecter)
    link: null, // { characteristic, listener } quand les notifications sont actives
    // Piano auquel on veut être connecté (null après une déconnexion demandée) :
    // une ouverture de lien périmée ne coupe GATT que si ce piano n'est plus voulu.
    target: null,
    stopWatching: null,
    reconnecting: null, // numéro de l'action dont la boucle de reconnexion tourne
    callbacks: {},
  };

  const remember = (device) => {
    ctx.device = device;
    setKnownDevice({ name: device.name || "" });
  };

  const releaseLink = () => {
    const link = ctx.link;
    ctx.link = null;
    if (!link) return;
    link.characteristic.removeEventListener("characteristicvaluechanged", link.listener);
    try {
      link.characteristic.stopNotifications().catch(() => {});
    } catch {
      // déjà déconnecté
    }
    // Plus aucune note ne viendra de ce lien : les touches tenues ne doivent pas rester bloquées.
    ctx.callbacks.onRelease?.();
  };

  /** Coupe tout lien avec le piano courant (sans l'oublier). */
  const detach = () => {
    ctx.stopWatching?.();
    ctx.stopWatching = null;
    releaseLink();
    disconnectGatt(ctx.device);
  };

  /** Ouvre le lien GATT et s'abonne aux notes. Renvoie false si une action plus récente a pris la main. */
  const openLink = async (device, attempt) => {
    for (let i = 0; ; i++) {
      try {
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(MIDI_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(MIDI_CHARACTERISTIC_UUID);
        await characteristic.startNotifications();
        if (attempt !== ctx.attempt) {
          // Action plus récente (déconnexion, autre piano) : ne pas laisser un lien ouvert
          // sans personne pour l'écouter, sauf si la nouvelle action vise ce même piano.
          if (ctx.target !== device) disconnectGatt(device);
          return false;
        }
        // Décodage direct : certains systèmes (Chrome sous Windows) n'exposent pas
        // le piano BLE comme port Web MIDI.
        const listener = (event) => decodeNotification(event.target.value, ctx.callbacks);
        characteristic.addEventListener("characteristicvaluechanged", listener);
        ctx.link = { characteristic, listener };
        return true;
      } catch (err) {
        if (attempt !== ctx.attempt) {
          if (ctx.target !== device) disconnectGatt(device);
          return false;
        }
        if (i < OPEN_RETRIES - 1 && /disconnected/i.test(err?.message || "")) {
          await wait(250 * (i + 1));
          continue;
        }
        // GATT a pu s'ouvrir avant l'échec (service MIDI absent, notifications refusées) :
        // le refermer, sinon ce navigateur garde le piano pour lui.
        disconnectGatt(device);
        throw err;
      }
    }
  };

  /** Coupure non demandée (piano éteint, trop loin) : on réessaie seul pendant un moment. */
  const autoReconnect = async (device, attempt) => {
    // Une seule boucle par action ; celle d'une action périmée (qui attend encore) ne bloque pas.
    if (ctx.reconnecting === attempt) return;
    ctx.reconnecting = attempt;
    releaseLink();
    setStatus("reconnecting");
    const deadline = Date.now() + RECONNECT_WINDOW_MS;
    try {
      while (attempt === ctx.attempt) {
        try {
          if (await openLink(device, attempt)) setStatus("connected");
          return;
        } catch {
          // piano pas encore joignable
        }
        if (Date.now() >= deadline) break;
        await wait(RECONNECT_DELAY_MS);
      }
      if (attempt === ctx.attempt) setStatus("lost");
    } finally {
      if (ctx.reconnecting === attempt) ctx.reconnecting = null;
    }
  };

  const watchDisconnect = (device, attempt) => {
    ctx.stopWatching?.();
    const onDisconnected = () => {
      if (attempt === ctx.attempt) autoReconnect(device, attempt);
    };
    device.addEventListener("gattserverdisconnected", onDisconnected);
    ctx.stopWatching = () => device.removeEventListener("gattserverdisconnected", onDisconnected);
  };

  const connect = async (device, attempt) => {
    ctx.target = device;
    setStatus("connecting");
    setError(null);
    try {
      if (!(await openLink(device, attempt))) return;
      watchDisconnect(device, attempt);
      setStatus("connected");
    } catch (err) {
      if (attempt !== ctx.attempt) return;
      console.warn("Bluetooth MIDI :", err);
      const code = errorCode(err);
      setStatus("error");
      setError(code === "cancelled" ? "failed" : code);
    }
  };

  return {
    setCallbacks(callbacks) {
      ctx.callbacks = callbacks;
    },

    /** Ouvre le sélecteur du navigateur et se connecte au piano choisi. */
    async request() {
      if (!navigator.bluetooth) {
        setStatus("unsupported");
        return;
      }
      const attempt = ++ctx.attempt;
      ctx.target = null; // aucun piano voulu tant que le sélecteur est ouvert
      setStatus("scanning");
      setError(null);
      let device;
      try {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [MIDI_SERVICE_UUID] }],
          optionalServices: [MIDI_SERVICE_UUID],
        });
      } catch (err) {
        if (attempt !== ctx.attempt) return;
        setStatus("error");
        setError(errorCode(err));
        return;
      }
      if (attempt !== ctx.attempt) return;
      detach();
      remember(device);
      try {
        localStorage.setItem(LAST_DEVICE_STORAGE_KEY, device.id);
      } catch {
        // stockage indisponible : pas de reconnexion proposée à la prochaine ouverture
      }
      await connect(device, attempt);
    },

    /** Se reconnecte au dernier piano, sans repasser par le sélecteur. */
    async reconnect() {
      if (!ctx.device) return this.request();
      const attempt = ++ctx.attempt;
      detach();
      await connect(ctx.device, attempt);
    },

    /** Déconnexion demandée : le piano reste proposé pour une reconnexion. */
    disconnect() {
      ++ctx.attempt;
      ctx.target = null;
      detach();
      setStatus("idle");
      setError(null);
    },

    /** Retrouve le dernier piano autorisé, si le navigateur le permet (getDevices). */
    async restore() {
      if (!navigator.bluetooth?.getDevices) return;
      let id;
      try {
        id = localStorage.getItem(LAST_DEVICE_STORAGE_KEY);
      } catch {
        return;
      }
      if (!id) return;
      try {
        const device = (await navigator.bluetooth.getDevices()).find((d) => d.id === id);
        if (device && !ctx.device) remember(device);
      } catch {
        // fonction présente mais non autorisée
      }
    },

    dispose() {
      ++ctx.attempt;
      ctx.target = null;
      detach();
    },
  };
}

/**
 * Connexion directe d'un piano Bluetooth LE MIDI via Web Bluetooth.
 *
 * Retourne :
 * - btStatus : "idle" | "scanning" | "connecting" | "connected" | "reconnecting"
 *              | "lost" (reconnexion automatique abandonnée) | "error" | "unsupported"
 * - btError  : code d'erreur ("cancelled" | "adapterOff" | "denied" | "failed") ou null
 * - btKnownDevice : { name } du dernier piano choisi (ou retrouvé à l'ouverture), sinon null
 * - requestBluetoothMIDI : ouvre le sélecteur (à appeler sur un geste de l'utilisateur)
 * - reconnectBluetooth   : se reconnecte au dernier piano sans sélecteur
 * - disconnectBluetooth  : déconnexion manuelle
 *
 * onRelease est appelé quand le lien avec le piano est coupé (coupure, déconnexion,
 * autre piano) : ses touches tenues ne recevront plus de note off.
 */
export default function useBluetoothMIDI({ onNoteOn, onNoteOff, onSustain, onRelease } = {}) {
  const [btStatus, setBtStatus] = useState(() => (navigator.bluetooth ? "idle" : "unsupported"));
  const [btError, setBtError] = useState(null);
  const [btKnownDevice, setBtKnownDevice] = useState(null);

  const [controller] = useState(() =>
    createBluetoothController({
      setStatus: setBtStatus,
      setError: setBtError,
      setKnownDevice: setBtKnownDevice,
    })
  );

  useEffect(() => {
    controller.setCallbacks({ onNoteOn, onNoteOff, onSustain, onRelease });
  }, [controller, onNoteOn, onNoteOff, onSustain, onRelease]);

  useEffect(() => {
    controller.restore();
    return () => controller.dispose();
  }, [controller]);

  return {
    btStatus,
    btError,
    btKnownDevice,
    requestBluetoothMIDI: () => controller.request(),
    reconnectBluetooth: () => controller.reconnect(),
    disconnectBluetooth: () => controller.disconnect(),
  };
}
