// Signaux synthétiques « façon piano » pour les tests du mode micro (pas utilisé par l'appli).
// Chaque note : harmoniques décroissants, cordes inharmoniques, léger désaccord possible,
// fondamentale atténuée dans le grave (petit micro de téléphone), bruit de fond.

const A4 = 440;

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Trame audio d'un accord.
 * notes : numéros MIDI ; options : sampleRate, length, detune (cents, global),
 * spread (cents, écart aléatoire par note), inharmonicity, noise (amplitude),
 * gains (par note), lowCut (Hz : atténuation sous cette fréquence), seed.
 */
export function synthChord(notes, {
  sampleRate = 48000,
  length = 8192,
  detune = 0,
  spread = 0,
  inharmonicity = 0.0004,
  noise = 0.001,
  gains = [],
  lowCut = 120,
  seed = 1,
} = {}) {
  const random = seededRandom(seed);
  const out = new Float32Array(length);
  notes.forEach((midi, index) => {
    const cents = detune + (random() * 2 - 1) * spread;
    const f0 = A4 * 2 ** ((midi - 69 + cents / 100) / 12);
    const gain = (gains[index] ?? 1) * 0.15;
    for (let h = 1; h <= 12; h++) {
      const f = h * f0 * Math.sqrt(1 + inharmonicity * h * h);
      if (f > sampleRate / 2 - 1000) break;
      // Décroissance des harmoniques, un peu irrégulière ; filtre passe-haut du micro
      let amp = gain / h ** 1.1 * (0.6 + 0.8 * random());
      if (f < lowCut) amp *= (f / lowCut) ** 2;
      const phase = random() * 2 * Math.PI;
      const w = (2 * Math.PI * f) / sampleRate;
      for (let i = 0; i < length; i++) out[i] += amp * Math.sin(w * i + phase);
    }
  });
  for (let i = 0; i < length; i++) out[i] += noise * (random() * 2 - 1);
  return out;
}
