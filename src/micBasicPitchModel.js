// Mode micro, moteur B : chargement de TensorFlow.js et du modèle Basic Pitch.
//
// Importé seulement à la demande (import dynamique dans useMicrophone.js) : ni
// TensorFlow.js ni le modèle ne sont téléchargés tant qu'on n'a pas choisi
// « Micro B ». Le service worker les met ensuite en cache, pour le hors-ligne.

import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import { loadGraphModel } from "@tensorflow/tfjs-converter";
import { MODEL_SAMPLES } from "./micBasicPitch.js";

const MODEL_URL = `${import.meta.env?.BASE_URL ?? "/"}models/basic-pitch/model.json`;
// Sortie « notes » du modèle (les deux autres sont les débuts de notes et le contour)
const NOTES_OUTPUT = "Identity_1";

let loading = null;

/**
 * Charge le modèle une seule fois (calcul sur la carte graphique si possible) et
 * le fait tourner une première fois à vide : la première exécution prépare les
 * calculs et prendrait sinon plusieurs secondes au premier accord.
 * Renvoie { predict(Float32Array) → Promise<number[172][88]> }.
 */
export function loadBasicPitchModel() {
  if (!loading) {
    loading = (async () => {
      try {
        await tf.setBackend("webgl");
      } catch {
        await tf.setBackend("cpu");
      }
      await tf.ready();
      const graph = await loadGraphModel(MODEL_URL);
      const predict = async (samples) => {
        const input = tf.tensor3d(samples, [1, MODEL_SAMPLES, 1]);
        const output = graph.execute(input, NOTES_OUTPUT);
        try {
          const frames = await output.array();
          return frames[0];
        } finally {
          input.dispose();
          output.dispose();
        }
      };
      await predict(new Float32Array(MODEL_SAMPLES));
      return { predict };
    })();
    // Échec (hors ligne la première fois…) : on pourra réessayer
    loading.catch(() => { loading = null; });
  }
  return loading;
}
