// Mode micro : 3ᵉ source de notes, à côté du Bluetooth et du câble USB.
//
// Le micro de l'appareil écoute un piano acoustique ; un moteur d'analyse dit
// quelles notes il entend (A : micChroma.js, analyse du spectre ; B :
// micBasicPitch.js, réseau de neurones), micTracker.js décide lesquelles sont
// tenues, et ce hook les envoie à l'appli comme des note on / note off.
// Tout se passe dans le navigateur : aucun son ne part sur le réseau.

import { useCallback, useEffect, useRef, useState } from "react";
import { createChromaEngine, levelDb } from "./micChroma.js";
import { createBasicPitchEngine } from "./micBasicPitch.js";
import { createNoteTracker } from "./micTracker.js";
import { startCapture } from "./micCapture.js";

// Le suivi tourne toutes les 50 ms environ (le moteur B, plus lent, saute des tours)
const HOP_MS = 50;
// Échantillons gardés : de quoi nourrir le moteur B (2 s), avec de la marge
const CAPTURE_SECONDS = 2.5;
// Vumètre : niveau des 50 dernières ms environ
const METER_SAMPLES = 2048;

// Moteurs : A1 à A5 (versions du moteur A, voir createChromaEngine dans micChroma.js)
// et B1 (moteur B). L'accueil démarre MIC_DEFAULT_ENGINE ; la ligne d'état permet de
// passer au moteur B le temps de les comparer sur un vrai piano (et, avec
// npm run dev, à toutes les versions).
export const MIC_DEFAULT_ENGINE = "A5";
export const MIC_ENGINES = import.meta.env.DEV ? ["A1", "A2", "A3", "A4", "A5", "B1"] : ["A5", "B1"];

/** Prépare le moteur demandé (le B charge TensorFlow.js et son modèle à la demande). */
async function createEngine(id, sampleRate) {
  if (id.startsWith("B")) {
    const { loadBasicPitchModel } = await import("./micBasicPitchModel.js");
    const model = await loadBasicPitchModel();
    return createBasicPitchEngine({ sampleRate, model });
  }
  return createChromaEngine({ sampleRate, version: Number(id.slice(1)) });
}

function audioContextClass() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function microphoneSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && audioContextClass());
}

/** Code d'erreur traduit en `mic.error.<code>` : denied | noDevice | failed (| model). */
function errorCode(error) {
  const name = error?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "noDevice";
  return "failed";
}

/**
 * callbacks : { onNoteOn(note), onNoteOff(note), onRelease(), onFrame?(résultat) }
 * (onRelease quand l'écoute s'arrête : les notes tenues sont relâchées ; onFrame,
 * pour les essais, reçoit la sortie du moteur à chaque analyse).
 *
 * Retourne { micStatus, micEngine, micError, startMic, stopMic, suppress, subscribeLevel } :
 * - micStatus : "idle" | "starting" | "listening" | "error" | "unsupported"
 * - micEngine : moteur demandé (un de MIC_ENGINES) pendant le démarrage et l'écoute, sinon null
 * - micError : "denied" | "noDevice" | "failed" | "model" (moteur B non chargé) | null
 *   (avec le statut "error" ; "denied" aussi d'avance, quand l'autorisation du site
 *   est déjà refusée)
 * - startMic(engine) : à appeler sur un geste de l'utilisateur (demande d'autorisation,
 *   démarrage du son sur iPhone)
 * - suppress() : éteint les notes entendues (toucher du clavier à l'écran), jusqu'au
 *   prochain accord différent ou au silence
 * - subscribeLevel(fn) : fn(dB, ms) toutes les 50 ms, pour le vumètre (sans rendu
 *   React) ; ms est la durée de la dernière analyse du moteur (null avant la première)
 */
export default function useMicrophone(callbacks) {
  const [state, setState] = useState(() => ({
    micStatus: microphoneSupported() ? "idle" : "unsupported",
    micEngine: null,
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
    // Enregistrement des essais en cours : prévenu de la fin du son
    session.audioListeners.forEach((fn) => fn(null));
    session.capture?.stop();
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
    setState((prev) => (prev.micStatus === "unsupported" ? prev : { micStatus: "idle", micEngine: null, micError: null }));
  }, [teardown]);

  const startMic = useCallback(async (engineId = MIC_DEFAULT_ENGINE) => {
    if (!microphoneSupported()) return;
    const attempt = ++attemptRef.current;
    const stale = () => attempt !== attemptRef.current;
    teardown();
    setState({ micStatus: "starting", micEngine: engineId, micError: null });
    const fail = (micError) => setState({ micStatus: "error", micEngine: null, micError });

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
      if (!stale()) fail(errorCode(error));
      return;
    }
    const abandon = () => {
      stream.getTracks().forEach((track) => track.stop());
      context.close().catch(() => {});
    };
    if (stale()) return abandon();

    // Moteur (le B peut prendre quelques secondes la première fois : téléchargement)
    let engine;
    try {
      engine = await createEngine(engineId, context.sampleRate);
    } catch {
      abandon();
      if (!stale()) fail("model");
      return;
    }
    if (stale()) return abandon();

    let capture;
    try {
      capture = await startCapture(context, context.createMediaStreamSource(stream), CAPTURE_SECONDS);
    } catch {
      abandon();
      if (!stale()) fail("failed");
      return;
    }
    if (stale()) {
      capture.stop();
      return abandon();
    }

    const tracker = createNoteTracker(engine.tracker);
    const frame = new Float32Array(engine.frameSize);
    const meter = new Float32Array(METER_SAMPLES);
    // suppressed : classes de hauteur éteintes par un toucher de l'écran (voir suppress)
    const session = {
      stream, context, capture, timer: 0, notes: new Set(), suppressed: null,
      audioListeners: new Set(), // enregistrement des essais (voir listenAudio)
    };
    let busy = false;
    let lastRun = 0;
    let lastResult = 0; // fin de l'analyse précédente

    const apply = (result) => {
      const now = performance.now();
      callbacksRef.current.onFrame?.(result);
      let next = new Set(tracker.update(result, lastResult ? now - lastResult : 0));
      lastResult = now;
      if (session.suppressed) {
        // Tant que le micro n'entend que (ce qui reste de) l'accord éteint, rien ne
        // s'affiche ; une note nouvelle ou le silence lève la mise en sourdine.
        const onlyOld = [...next].every((note) => session.suppressed.has(note % 12));
        if (next.size === 0 || !onlyOld) session.suppressed = null;
        else next = new Set();
      }
      const { onNoteOn, onNoteOff } = callbacksRef.current;
      session.notes.forEach((note) => { if (!next.has(note)) onNoteOff(note); });
      next.forEach((note) => { if (!session.notes.has(note)) onNoteOn(note); });
      session.notes = next;
    };

    let computeMs = null; // durée de la dernière analyse, affichée pendant les essais
    const tick = async () => {
      const level = levelDb(capture.ring.latest(METER_SAMPLES, meter));
      levelListeners.current.forEach((listener) => listener(level, computeMs));
      const now = performance.now();
      if (busy || now - lastRun < (engine.minIntervalMs ?? 0)) return;
      busy = true;
      lastRun = now;
      try {
        const result = await engine.analyze(capture.ring.latest(engine.frameSize, frame));
        computeMs = performance.now() - now;
        if (sessionRef.current === session) apply(result);
      } catch {
        // Calcul impossible (contexte graphique perdu…) : l'écoute s'arrête
        if (sessionRef.current !== session) return;
        attemptRef.current++;
        teardown();
        fail("failed");
      } finally {
        busy = false;
      }
    };
    session.timer = setInterval(tick, HOP_MS);

    // Micro débranché ou coupé par le système
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (sessionRef.current !== session) return;
        attemptRef.current++;
        teardown();
        fail("failed");
      };
    });

    sessionRef.current = session;
    setState({ micStatus: "listening", micEngine: engineId, micError: null });
  }, [teardown]);

  // L'utilisateur touche le clavier à l'écran : les notes entendues s'éteignent, et
  // restent éteintes tant que le micro n'entend que leur résonance.
  const suppress = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.notes.size === 0) return;
    session.suppressed = new Set([...session.notes].map((note) => note % 12));
    const { onNoteOff } = callbacksRef.current;
    session.notes.forEach((note) => onNoteOff(note));
    session.notes = new Set();
  }, []);

  // Autorisation déjà refusée dans les paramètres du site : on le dit d'avance.
  // Une autorisation accordée ne démarre pas l'écoute toute seule.
  useEffect(() => {
    if (!microphoneSupported() || !navigator.permissions?.query) return;
    let permission = null;
    let cancelled = false;
    const apply = () => {
      setState((prev) => {
        if (prev.micStatus === "listening" || prev.micStatus === "starting") return prev;
        if (permission.state === "denied") return { micStatus: "error", micEngine: null, micError: "denied" };
        if (prev.micError === "denied") return { micStatus: "idle", micEngine: null, micError: null };
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

  // Essais : fn(bloc) reçoit le son du micro au fil de l'eau, puis fn(null) quand
  // l'écoute s'arrête. Renvoie { sampleRate, stop() }, ou null sans écoute en cours.
  const listenAudio = useCallback((fn) => {
    const session = sessionRef.current;
    if (!session) return null;
    const off = session.capture.listen(fn);
    session.audioListeners.add(fn);
    return {
      sampleRate: session.context.sampleRate,
      stop: () => {
        off();
        session.audioListeners.delete(fn);
      },
    };
  }, []);

  return { ...state, startMic, stopMic, suppress, subscribeLevel, listenAudio };
}
