// Mode micro : capture continue des échantillons du micro.
//
// Les moteurs lisent les N derniers échantillons (environ 340 ms pour le moteur A,
// 2 s pour le moteur B, plus que ce que garde un AnalyserNode). Un AudioWorklet
// envoie les échantillons par paquets de 1024 au fil de l'eau, rangés dans un
// tampon circulaire ; à défaut (vieux navigateurs), un ScriptProcessorNode.

/** Tampon circulaire : push(bloc), latest(n) → les n derniers échantillons (zéros avant le début). */
export function createRingBuffer(capacity) {
  const data = new Float32Array(capacity);
  let write = 0; // prochaine position d'écriture
  let filled = 0;
  return {
    push(block) {
      let offset = 0;
      // Un bloc plus grand que le tampon : seule sa fin compte
      if (block.length > capacity) offset = block.length - capacity;
      for (let i = offset; i < block.length; i++) {
        data[write] = block[i];
        write = (write + 1) % capacity;
      }
      filled = Math.min(capacity, filled + block.length - offset);
    },
    latest(n, out = new Float32Array(n)) {
      const count = Math.min(n, capacity);
      out.fill(0, 0, n - Math.min(count, filled));
      for (let k = 0; k < Math.min(count, filled); k++) {
        out[n - 1 - k] = data[(write - 1 - k + capacity * 2) % capacity];
      }
      return out;
    },
  };
}

const BLOCK = 1024;

const WORKLET_SOURCE = `
class InstantChordCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = new Float32Array(${BLOCK});
    this.filled = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.block[this.filled++] = channel[i];
        if (this.filled === this.block.length) {
          this.port.postMessage(this.block);
          this.block = new Float32Array(${BLOCK});
          this.filled = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("instantchord-capture", InstantChordCapture);
`;

/**
 * Branche la capture sur `source` (MediaStreamAudioSourceNode). Renvoie
 * { ring, listen(fn), stop() } ; listen(fn) appelle fn(bloc) pour chaque bloc reçu
 * (enregistrement des essais) et renvoie de quoi se désabonner. La sortie passe par
 * un gain nul vers les haut-parleurs : certains navigateurs ne font tourner que les
 * nœuds reliés à la sortie.
 */
export async function startCapture(context, source, seconds) {
  const ringBuffer = createRingBuffer(Math.ceil(context.sampleRate * seconds));
  const listeners = new Set();
  const listen = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  // Le tampon reçoit les blocs, et les abonnés une copie (le ScriptProcessorNode
  // réutilise le sien)
  const ring = {
    ...ringBuffer,
    push(block) {
      ringBuffer.push(block);
      if (listeners.size > 0) {
        const copy = Float32Array.from(block);
        listeners.forEach((fn) => fn(copy));
      }
    },
  };
  const mute = context.createGain();
  mute.gain.value = 0;
  mute.connect(context.destination);

  if (context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    try {
      await context.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(context, "instantchord-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      node.port.onmessage = (event) => ring.push(event.data);
      source.connect(node).connect(mute);
      return {
        ring,
        listen,
        stop() {
          node.port.onmessage = null;
          source.disconnect();
          node.disconnect();
          mute.disconnect();
        },
      };
    } catch {
      // Worklet refusé : on passe au ScriptProcessorNode
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const processor = context.createScriptProcessor(BLOCK * 2, 1, 1);
  processor.onaudioprocess = (event) => ring.push(event.inputBuffer.getChannelData(0));
  source.connect(processor).connect(mute);
  return {
    ring,
    listen,
    stop() {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      mute.disconnect();
    },
  };
}
