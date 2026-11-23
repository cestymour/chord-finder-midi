// Mode micro : 3ᵉ source de notes, à côté du Bluetooth et du câble USB.
//
// Le micro de l'appareil écoute un piano acoustique ; un moteur d'analyse
// (micChroma.js) dit quelles notes il entend, micTracker.js décide lesquelles
// sont tenues, et ce hook les envoie à l'appli comme des note on / note off.
// Tout se passe dans le navigateur : aucun son ne part sur le réseau.

import { useCallback, useEffect, useRef, useState } from "react";
import { createChromaEngine } from "./micChroma.js";
import { createNoteTracker } from "./micTracker.js";

// Une analyse toutes les 50 ms environ
const HOP_MS = 50;

function audioContextClass() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function microphoneSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && audioContextClass());
}

/** Code d'erreur traduit en `mic.error.<code>` : denied | noDevice | failed. */
function errorCode(error) {
  const name = error?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "noDevice";
  return "failed";
}

/**
 * callbacks : { onNoteOn(note), onNoteOff(note), onRelease() } (onRelease quand
 * l'écoute s'arrête : les notes tenues sont relâchées).
 *
 * Retourne { micStatus, micError, startMic, stopMic, subscribeLevel } :
 * - micStatus : "idle" | "starting" | "listening" | "error" | "unsupported"
 * - micError : "denied" | "noDevice" | "failed" | null (avec le statut "error" ;
 *   "denied" aussi d'avance, quand l'autorisation du site est déjà refusée)
 * - startMic() : à appeler sur un geste de l'utilisateur (demande d'autorisation,
 *   démarrage du son sur iPhone)
 * - subscribeLevel(fn) : fn(dB) à chaque analyse, pour le vumètre (sans rendu React)
 */
export default function useMicrophone(callbacks) {
  const [state, setState] = useState(() => ({
    micStatus: microphoneSupported() ? "idle" : "unsupported",
    micError: null,
  }));

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const sessionRef = useRef(null); // écoute en cours : { stream, context, timer, … }
  const attemptRef = useRef(0); // chaque démarrage ou arrêt l'incrémente
  const levelListeners = useRef(new Set());

  const subscribeLevel = useCallback((listener) => {
    levelListeners.current.add(listener);
    return () => levelListeners.current.delete(listener);
  }, []);

  const teardown = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    clearInterval(session.timer);
    session.stream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    session.context.close().catch(() => {});
    if (session.notes.size > 0) callbacksRef.current.onRelease();
    levelListeners.current.forEach((listener) => listener(-Infinity));
  }, []);

  const stopMic = useCallback(() => {
    attemptRef.current++;
    teardown();
    setState((prev) => (prev.micStatus === "unsupported" ? prev : { micStatus: "idle", micError: null }));
  }, [teardown]);

  const startMic = useCallback(async () => {
    if (!microphoneSupported()) return;
    const attempt = ++attemptRef.current;
    teardown();
    setState({ micStatus: "starting", micError: null });

    // Contexte audio créé pendant le geste : sinon, il reste suspendu (Safari, Chrome)
    const AudioCtx = audioContextClass();
    const context = new AudioCtx();
    context.resume?.().catch(() => {});
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Sans ces traitements, faits pour la voix, le navigateur prendrait la
          // musique pour du bruit et la déformerait
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (context.state === "suspended") await context.resume();
    } catch (error) {
      context.close().catch(() => {});
      if (attempt !== attemptRef.current) return;
      setState({ micStatus: "error", micError: errorCode(error) });
      return;
    }
    if (attempt !== attemptRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      context.close().catch(() => {});
      return;
    }

    const engine = createChromaEngine({ sampleRate: context.sampleRate });
    const tracker = createNoteTracker();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = engine.frameSize;
    analyser.smoothingTimeConstant = 0;
    // Sortie muette vers les haut-parleurs : certains navigateurs n'analysent
    // qu'un graphe relié à la sortie
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(analyser).connect(mute).connect(context.destination);

    const buffer = new Float32Array(analyser.fftSize);
    const session = { stream, context, timer: 0, notes: new Set() };

    const tick = () => {
      analyser.getFloatTimeDomainData(buffer);
      const frame = engine.analyze(buffer);
      levelListeners.current.forEach((listener) => listener(frame.level));
      const next = new Set(tracker.update(frame));
      const { onNoteOn, onNoteOff } = callbacksRef.current;
      session.notes.forEach((note) => { if (!next.has(note)) onNoteOff(note); });
      next.forEach((note) => { if (!session.notes.has(note)) onNoteOn(note); });
      session.notes = next;
    };
    session.timer = setInterval(tick, HOP_MS);

    // Micro débranché ou coupé par le système
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (sessionRef.current !== session) return;
        attemptRef.current++;
        teardown();
        setState({ micStatus: "error", micError: "failed" });
      };
    });

    sessionRef.current = session;
    setState({ micStatus: "listening", micError: null });
  }, [teardown]);

  // Autorisation déjà refusée dans les paramètres du site : on le dit d'avance.
  // Une autorisation accordée ne démarre pas l'écoute toute seule.
  useEffect(() => {
    if (!microphoneSupported() || !navigator.permissions?.query) return;
    let permission = null;
    let cancelled = false;
    const apply = () => {
      setState((prev) => {
        if (prev.micStatus === "listening" || prev.micStatus === "starting") return prev;
        if (permission.state === "denied") return { micStatus: "error", micError: "denied" };
        if (prev.micError === "denied") return { micStatus: "idle", micError: null };
        return prev;
      });
    };
    navigator.permissions.query({ name: "microphone" })
      .then((status) => {
        if (cancelled) return;
        permission = status;
        permission.onchange = apply;
        apply();
      })
      .catch(() => {}); // autorisation "microphone" inconnue de ce navigateur
    return () => {
      cancelled = true;
      if (permission) permission.onchange = null;
    };
  }, []);

  // Démontage : on coupe le micro
  useEffect(() => () => {
    attemptRef.current++;
    teardown();
  }, [teardown]);

  return { ...state, startMic, stopMic, subscribeLevel };
}
