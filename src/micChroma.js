// Mode micro, moteur A : analyse du spectre (traitement du signal classique).
//
// Module sans React (comme chords.js) : il reçoit une trame audio (les derniers
// échantillons du micro) et renvoie les notes qu'il y entend, chacune avec un
// poids relatif. Le suivi dans le temps (début et fin des notes) est fait par
// micTracker.js, commun aux moteurs.
//
// Étapes, pour chaque trame :
// 1. Fenêtre de Hann et FFT : environ 340 ms d'audio pour le grave (notes voisines
//    à quelques Hz), la moitié la plus récente (170 ms) pour le reste.
// 2. Pics du spectre, fréquence affinée par interpolation parabolique.
// 3. Recalage du La : écart moyen des pics forts au tempérament égal (piano droit
//    pas tout à fait au diapason), lissé d'une trame à l'autre.
// 4. Notes candidates (MIDI 36 à 88) : chacune somme les pics trouvés à ses
//    harmoniques (f, 2f, 3f…, un peu plus haut pour l'inharmonicité des cordes).
//    La plus forte est retenue, puis ses harmoniques sont retirés du spectre
//    (au plus le niveau lissé de ses harmoniques voisins, pour laisser sa part à
//    une autre note qui partage le même pic), et on recommence. C'est ce retrait
//    qui évite qu'un Do seul ressemble à un accord Do-Mi-Sol (ses 3ᵉ et 5ᵉ harmoniques).
// 5. Une candidate doit avoir sa fondamentale dans le spectre : sinon, ce n'est
//    qu'un écho des harmoniques d'une note plus aiguë (erreur d'octave vers le bas).
// 6. Une note faible pile sur le 3ᵉ, 5ᵉ, 6ᵉ ou 7ᵉ harmonique d'une note plus grave est
//    écartée : c'est un reste du timbre de celle-ci, pas une note jouée.
//
// Le repliement en 12 classes de hauteur (le chroma) et le choix de la basse se
// font ensuite dans micTracker.js : l'octave des notes du haut compte peu, seule
// la note la plus grave sert (notation C/E).

const A4_MIDI = 69;
const A4_HZ = 440;

export const MIC_MIN_MIDI = 36; // Do2 (C2) : un peu sous le registre visé (Mi1/E2)
export const MIC_MAX_MIDI = 88; // Mi5 (E6)
// À partir de la version 4 : jusqu'au dernier Do du clavier (Do7 en français, C8)
export const MIC_MAX_MIDI_HIGH = 108;

const MIN_PEAK_HZ = 55;
const MAX_PEAK_HZ = 5000;
const MAX_HARMONICS = 8;
// Seuil des pics : 50 dB sous le plus fort (bruit, fuites de la fenêtre)
const PEAK_FLOOR = 10 ** (-50 / 20);
// Écart toléré entre un pic et l'harmonique attendu, en cents (piano mal accordé)
const MATCH_CENTS = 40;
// Inharmonicité maximale prise en compte (cordes de piano : harmoniques trop hauts)
const MAX_INHARMONICITY = 0.0008;
// Fondamentale exigée : au moins cette fraction du plus fort de ses harmoniques.
// Peu dans le grave (le petit micro d'un téléphone capte mal les fondamentales
// graves), davantage au-dessus : un piano y a toujours une fondamentale nette. Sans
// cela, un peu de résonance une octave sous une note jouée (Ré3 sous Ré4-Fa4-La4)
// suffit à faire de la note grave un candidat qui ramasse les notes jouées comme
// ses harmoniques 2 et 3 : le Ré s'afficherait une octave trop bas.
const MIN_FUNDAMENTAL_LOW = 0.05; // jusqu'à FUNDAMENTAL_LOW_HZ
const MIN_FUNDAMENTAL_HIGH = 0.25; // à partir d'une octave plus haut
const FUNDAMENTAL_LOW_HZ = 130.8; // Do2 en français (C3)

/** Fondamentale exigée pour une note de fréquence f0 (fraction du plus fort harmonique). */
export function minFundamental(f0) {
  const octaves = Math.min(1, Math.max(0, Math.log2(f0 / FUNDAMENTAL_LOW_HZ)));
  return MIN_FUNDAMENTAL_LOW + octaves * (MIN_FUNDAMENTAL_HIGH - MIN_FUNDAMENTAL_LOW);
}
// Arrêt : une note doit peser au moins cette fraction de la plus forte (le suivi,
// micTracker.js, n'en garde une nouvelle qu'à partir de 0,15)
const MIN_RELATIVE_SALIENCE = 0.08;
const MAX_NOTES = 7;

/** Fréquence d'une note MIDI, avec un écart d'accord global en cents. */
export function midiToHz(midi, tuningCents = 0) {
  return A4_HZ * 2 ** ((midi - A4_MIDI + tuningCents / 100) / 12);
}

/** Note MIDI (non arrondie) d'une fréquence. */
export function hzToMidi(hz) {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

/** Taille de FFT pour une durée de trame donnée : puissance de 2 la plus proche. */
export function frameSizeFor(sampleRate, seconds = 0.17) {
  return 2 ** Math.round(Math.log2(sampleRate * seconds));
}

// Dans le grave, deux notes voisines ne sont qu'à quelques Hz : leurs pics ne se
// séparent qu'avec une longue fenêtre (environ 340 ms). Au-dessus de SPLIT_HZ,
// la moitié la plus récente de la trame suffit, et l'aigu réagit plus vite.
const SPLIT_HZ = 300;

/**
 * Spectres d'une trame : `low` sur toute la trame (pour le grave, jusqu'à
 * SPLIT_HZ), `high` sur sa moitié la plus récente (pour le reste). Les deux sont à
 * la même échelle (une sinusoïde d'amplitude 1 donne un pic de 1 dans les deux).
 */
export function frameSpectra(samples) {
  const recent = samples.subarray
    ? samples.subarray(samples.length / 2)
    : samples.slice(samples.length / 2);
  return { low: magnitudeSpectrum(samples), high: magnitudeSpectrum(recent) };
}

/** Pics d'une trame : le grave pris dans le spectre `low`, le reste dans `high`. */
export function framePeaks(samples, sampleRate, spectra = frameSpectra(samples)) {
  const { low: lowMags, high: highMags } = spectra;
  // Seuil commun : le pic le plus fort des deux bandes (sinon, une bande sans note
  // garderait les fuites de la fenêtre comme des pics)
  const strongest = (mags, fromHz, toHz) => {
    const binHz = sampleRate / (mags.length * 2);
    let max = 0;
    for (let k = Math.floor(fromHz / binHz); k <= Math.min(mags.length - 1, Math.ceil(toHz / binHz)); k++) {
      if (mags[k] > max) max = mags[k];
    }
    return max;
  };
  const reference = Math.max(
    strongest(lowMags, MIN_PEAK_HZ, SPLIT_HZ),
    strongest(highMags, SPLIT_HZ, MAX_PEAK_HZ),
  );
  const low = findPeaks(lowMags, sampleRate, MIN_PEAK_HZ, SPLIT_HZ, reference);
  const high = findPeaks(highMags, sampleRate, SPLIT_HZ, MAX_PEAK_HZ, reference);
  return [...low.filter((p) => p.hz <= SPLIT_HZ), ...high.filter((p) => p.hz > SPLIT_HZ)];
}

// ─────────────────────────────────────────────
// FFT
// ─────────────────────────────────────────────

const twiddleCache = new Map();

function twiddles(n) {
  let t = twiddleCache.get(n);
  if (!t) {
    t = { cos: new Float64Array(n / 2), sin: new Float64Array(n / 2) };
    for (let i = 0; i < n / 2; i++) {
      t.cos[i] = Math.cos((2 * Math.PI * i) / n);
      t.sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    twiddleCache.set(n, t);
  }
  return t;
}

/** FFT en place (radix 2, n puissance de 2) sur des tableaux réel / imaginaire. */
export function fft(re, im) {
  const n = re.length;
  if (n & (n - 1)) throw new Error("fft: taille non puissance de 2");
  // Permutation par inversion des bits
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  const { cos, sin } = twiddles(n);
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sin[k * step];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

const hannCache = new Map();

function hann(n) {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

/**
 * Spectre d'amplitude d'une trame (fenêtre de Hann), normalisé pour qu'une
 * sinusoïde d'amplitude 1 donne un pic d'environ 1. Longueur n/2.
 */
export function magnitudeSpectrum(samples) {
  const n = samples.length;
  const w = hann(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[i] * w[i];
  fft(re, im);
  const mags = new Float64Array(n / 2);
  const scale = 4 / n; // gain de la fenêtre de Hann (1/2) et spectre d'un seul côté
  for (let k = 0; k < n / 2; k++) mags[k] = Math.hypot(re[k], im[k]) * scale;
  return mags;
}

/** Niveau efficace (RMS) d'une trame, en dB pleine échelle (−Infinity si silence). */
export function levelDb(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return 10 * Math.log10(sum / samples.length);
}

// ─────────────────────────────────────────────
// PICS
// ─────────────────────────────────────────────

/**
 * Pics du spectre entre minHz et maxHz : maximums locaux à moins de
 * 50 dB du plus fort de cette bande (ou de `reference`, s'il est plus fort), fréquence et amplitude affinées par interpolation
 * parabolique sur le logarithme de l'amplitude. Triés par fréquence.
 */
export function findPeaks(mags, sampleRate, minHz = MIN_PEAK_HZ, maxHz = MAX_PEAK_HZ, reference = 0) {
  const n = mags.length * 2;
  const binHz = sampleRate / n;
  const first = Math.max(2, Math.floor(minHz / binHz));
  const last = Math.min(mags.length - 3, Math.ceil(maxHz / binHz));
  let max = reference;
  for (let k = first; k <= last; k++) if (mags[k] > max) max = mags[k];
  if (max <= 0) return [];
  const floor = max * PEAK_FLOOR;
  const peaks = [];
  for (let k = first; k <= last; k++) {
    const m = mags[k];
    if (m < floor || m <= mags[k - 1] || m < mags[k + 1] || m < mags[k - 2] || m < mags[k + 2]) continue;
    const a = Math.log(mags[k - 1] + 1e-12);
    const b = Math.log(m + 1e-12);
    const c = Math.log(mags[k + 1] + 1e-12);
    const denom = a - 2 * b + c;
    const p = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
    peaks.push({ hz: (k + p) * binHz, mag: Math.exp(b - 0.25 * (a - c) * p) });
  }
  return peaks;
}

/**
 * Écart d'accord global, en cents (−50 à +50) : moyenne circulaire des écarts des
 * pics au demi-ton le plus proche, pondérée par leur amplitude. null sans pic.
 */
export function estimateTuning(peaks) {
  let x = 0;
  let y = 0;
  for (const { hz, mag } of peaks) {
    if (hz > 1200) continue; // harmoniques aigus trop décalés par l'inharmonicité
    const angle = 2 * Math.PI * (hzToMidi(hz) % 1);
    x += mag * Math.cos(angle);
    y += mag * Math.sin(angle);
  }
  if (x === 0 && y === 0) return null;
  return (Math.atan2(y, x) / (2 * Math.PI)) * 100;
}

/** Indice du premier pic de fréquence ≥ hz (recherche dichotomique). */
function lowerBound(peaks, hz) {
  let lo = 0;
  let hi = peaks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (peaks[mid].hz < hz) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Pic le plus fort (amplitude résiduelle) entre lowHz et highHz, ou -1. */
function strongestPeakIn(peaks, residual, lowHz, highHz) {
  let best = -1;
  for (let i = lowerBound(peaks, lowHz); i < peaks.length && peaks[i].hz <= highHz; i++) {
    if (best < 0 || residual[i] > residual[best]) best = i;
  }
  return best;
}

const CENT = 2 ** (1 / 1200);

/**
 * Pics de chaque harmonique d'une fondamentale f0 : indice du pic (ou -1) pour
 * h = 1 … MAX_HARMONICS (sous MAX_PEAK_HZ). La fenêtre de recherche s'élargit
 * vers le haut avec h, pour l'inharmonicité des cordes.
 */
function harmonicPeaks(peaks, residual, f0) {
  const found = [];
  for (let h = 1; h <= MAX_HARMONICS; h++) {
    const target = h * f0;
    if (target > MAX_PEAK_HZ) break;
    const stretch = Math.sqrt(1 + MAX_INHARMONICITY * h * h);
    found.push(strongestPeakIn(peaks, residual, target * CENT ** -MATCH_CENTS, target * stretch * CENT ** MATCH_CENTS));
  }
  return found;
}

// Poids des harmoniques : la fondamentale compte le plus
const HARMONIC_WEIGHTS = Array.from({ length: MAX_HARMONICS }, (_, i) => 1 / (i + 1) ** 0.6);

// Sous LOW_SUPPORT_HZ, une note doit avoir au moins un de ses harmoniques 2 à 4, à
// au moins LOW_SUPPORT_RATIO du plus fort de ses harmoniques : une corde grave de
// piano en a toujours. (Rapporté à la fondamentale, le seuil écarte de vraies
// notes : une résonance du meuble peut gonfler une fondamentale grave.) Sinon, un
// pic isolé dans le grave (ronflement, résonance du meuble ou des haut-parleurs)
// devient une note en « ramassant » comme harmoniques 3, 6, 7… les notes jouées plus
// haut, et prend la place de la basse. Quand l'appui ne vient que de fondamentales
// de notes déjà retenues (Ré1 « appuyé » sur un La3 joué), la note grave doit avoir
// sa propre fondamentale nette (LOW_CLAIMED_FUNDAMENTAL du plus fort harmonique) :
// c'est le cas d'une vraie basse doublée à l'octave ou à la quinte, pas d'un pic
// de résonance.
const LOW_SUPPORT_HZ = 300;
const LOW_SUPPORT_RATIO = 0.05;
const LOW_CLAIMED_FUNDAMENTAL = 0.25;

// Sous LOW_OCTAVE_HZ, une note doit avoir son octave (harmonique 2) à au moins
// LOW_OCTAVE_RATIO de sa fondamentale : une corde grave de piano en a toujours une
// forte (de 0,3 à 1 fois la fondamentale dans les enregistrements), alors qu'une
// résonance du meuble, de la pièce ou des haut-parleurs (pics fixes vers 73, 105 et
// 140 Hz sur un piano numérique) n'en a pas. Sans cette règle, une telle résonance
// devient une basse fantôme (Ré1 sous un accord de Fa) en ramassant les notes jouées
// comme harmoniques 6, 7 et 8.
const LOW_OCTAVE_HZ = 130.8; // Do2 en français (C3)
const LOW_OCTAVE_RATIO = 0.02;

/**
 * Poids d'une note candidate et amplitudes de ses harmoniques (0 si absent).
 * rules : { octaveFix, lowSupport } (voir detectNotes) ; claimed : pics qui sont la
 * fondamentale d'une note déjà retenue.
 */
function salience(peaks, residual, f0, { octaveFix = true, lowSupport = true, lowOctave = true } = {}, claimed = new Set()) {
  const found = harmonicPeaks(peaks, residual, f0);
  // Un même pic ne compte qu'une fois par candidate (fenêtres voisines dans l'aigu)
  const used = new Set();
  const amps = found.map((i) => {
    if (i < 0 || used.has(i)) return 0;
    used.add(i);
    return residual[i];
  });
  const strongest = Math.max(...amps);
  // Fondamentale absente : écho des harmoniques d'une autre note, pas une note
  const required = octaveFix ? minFundamental(f0) : MIN_FUNDAMENTAL_LOW;
  if (strongest <= 0 || amps[0] < strongest * required) return { value: 0, found, amps };
  if (lowSupport && f0 < LOW_SUPPORT_HZ) {
    const support = [1, 2, 3].filter((h) => amps[h] >= strongest * LOW_SUPPORT_RATIO);
    const ownSupport = support.some((h) => !claimed.has(found[h]));
    if (support.length === 0 || (!ownSupport && amps[0] < strongest * LOW_CLAIMED_FUNDAMENTAL)) {
      return { value: 0, found, amps };
    }
  }
  if (lowOctave && f0 < LOW_OCTAVE_HZ) {
    // Pics bruts : l'octave a pu être retirée comme harmonique d'une autre note
    // (Sol2, octave de Sol1, est aussi l'harmonique 3 de Do1)
    const octave = found[1] >= 0 ? peaks[found[1]].mag : 0;
    if (octave === 0 || octave < peaks[found[0]].mag * LOW_OCTAVE_RATIO) return { value: 0, found, amps };
  }
  let value = 0;
  amps.forEach((a, h) => { value += a * HARMONIC_WEIGHTS[h]; });
  return { value, found, amps };
}

/**
 * Notes entendues dans une liste de pics : [{ midi, salience }] (salience relative
 * à la plus forte, 1 pour elle), de la plus forte à la plus faible.
 * Règles ajoutées au fil des versions (les précédentes restent disponibles le temps
 * des essais) : octaveFix false : fondamentale exigée constante et sans retrait des
 * échos à l'octave inférieure ; lowSupport false : note grave acceptée sans ses
 * harmoniques 2 à 4.
 */
export function detectNotes(peaks, tuningCents = 0, {
  octaveFix = true, lowSupport = true, lowOctaveGhost = lowSupport, lowOctave = lowSupport, maxMidi = MIC_MAX_MIDI,
} = {}) {
  const rules = { octaveFix, lowSupport, lowOctave };
  if (peaks.length === 0) return [];
  const residual = peaks.map((p) => p.mag);
  const notes = [];
  const claimed = new Set(); // fondamentales des notes retenues
  let first = 0;
  for (let n = 0; n < MAX_NOTES; n++) {
    let best = null;
    for (let midi = MIC_MIN_MIDI; midi <= maxMidi; midi++) {
      if (notes.some((note) => note.midi === midi)) continue;
      const s = salience(peaks, residual, midiToHz(midi, tuningCents), rules, claimed);
      if (s.value > 0 && (!best || s.value > best.value)) best = { midi, ...s };
    }
    if (!best) break;
    if (n === 0) first = best.value;
    else if (best.value < first * MIN_RELATIVE_SALIENCE) break;
    notes.push({ midi: best.midi, salience: best.value / first });
    if (best.found[0] >= 0) claimed.add(best.found[0]);

    // Retrait de ses harmoniques : au plus le niveau lissé de ses voisins, pour
    // qu'un pic partagé avec une autre note (Sol de Do et Sol joué) en garde une part.
    best.found.forEach((i, h) => {
      if (i < 0) return;
      const near = [best.amps[h - 1], best.amps[h], best.amps[h + 1]].filter((a) => a !== undefined);
      const smooth = near.reduce((sum, a) => sum + a, 0) / near.length;
      residual[i] = Math.max(0, residual[i] - Math.max(smooth, best.amps[h] * 0.7));
    });
  }
  return pruneHarmonicGhosts(notes, { octaveFix, lowOctaveGhost });
}

// Écarts en demi-tons des harmoniques 3, 5, 6 et 7 (quinte, tierce majeure, quinte
// une octave plus haut, septième mineure un peu basse) : ceux qui changent la
// classe de hauteur, donc l'accord.
const GHOST_INTERVALS = [19, 28, 31, 34];
// Une note sur l'un de ces harmoniques d'une note plus grave n'est gardée que si
// elle pèse au moins cette fraction de celle-ci : sinon, c'est un reste de son timbre.
const GHOST_RATIO = 0.3;

// Une note faible une ou deux octaves sous une note forte de même nom est un reste de
// résonance (corde voisine, caisse, pièce), pas une note jouée : écartée à partir de
// OCTAVE_GHOST_MIN_MIDI. Plus bas, on la garde : une basse doublée à l'octave est
// courante, et sa fondamentale est souvent faible au micro. Le nom de l'accord ne
// change pas (même classe de hauteur), seule l'octave affichée de la note.
const OCTAVE_GHOST_MIN_MIDI = 48; // Do2 en français (C3)
// lowOctaveGhost : plus bas aussi, mais seulement très faible (une basse doublée
// réellement jouée pèse davantage)
const LOW_OCTAVE_GHOST_RATIO = 0.15;

/**
 * Retire les notes faibles placées exactement sur un harmonique d'une note plus grave,
 * et celles une ou deux octaves sous une note plus forte de même nom.
 */
export function pruneHarmonicGhosts(notes, { octaveFix = true, lowOctaveGhost = false } = {}) {
  return notes.filter((note) => !notes.some((other) => {
    const interval = note.midi - other.midi;
    if (note.salience >= other.salience * GHOST_RATIO) return false;
    if (GHOST_INTERVALS.includes(interval)) return true;
    if (!octaveFix || (interval !== -12 && interval !== -24)) return false;
    if (note.midi >= OCTAVE_GHOST_MIN_MIDI) return true;
    return lowOctaveGhost && note.salience < other.salience * LOW_OCTAVE_GHOST_RATIO;
  }));
}

// ─────────────────────────────────────────────
// ÉNERGIE PAR CLASSE DE HAUTEUR (attaques)
// ─────────────────────────────────────────────

/** Plus forte amplitude du spectre entre lowHz et highHz (bins voisins compris). */
function maxBetween(mags, binHz, lowHz, highHz) {
  let max = 0;
  const last = Math.min(mags.length - 1, Math.ceil(highHz / binHz));
  for (let k = Math.max(0, Math.floor(lowHz / binHz)); k <= last; k++) if (mags[k] > max) max = mags[k];
  return max;
}

/**
 * Énergie de chacune des 12 classes de hauteur : pour chaque note candidate, somme
 * pondérée du spectre à ses harmoniques (lu directement dans le spectre, pas dans
 * les pics : un son stable donne une valeur stable, même faible) ; une classe prend
 * la plus forte de ses notes. Ce n'est pas une détection : le suivi (micTracker.js)
 * compare cette énergie d'une trame à l'autre pour reconnaître une attaque.
 */
export function classEnergy(spectra, sampleRate, tuningCents = 0, maxMidi = MIC_MAX_MIDI) {
  const energy = new Array(12).fill(0);
  const lowBin = sampleRate / (spectra.low.length * 2);
  const highBin = sampleRate / (spectra.high.length * 2);
  for (let midi = MIC_MIN_MIDI; midi <= maxMidi; midi++) {
    const f0 = midiToHz(midi, tuningCents);
    let value = 0;
    for (let h = 1; h <= MAX_HARMONICS; h++) {
      const target = h * f0;
      if (target > MAX_PEAK_HZ) break;
      const stretch = Math.sqrt(1 + MAX_INHARMONICITY * h * h);
      const lowHz = target * CENT ** -MATCH_CENTS;
      const highHz = target * stretch * CENT ** MATCH_CENTS;
      const amp = target <= SPLIT_HZ
        ? maxBetween(spectra.low, lowBin, lowHz, highHz)
        : maxBetween(spectra.high, highBin, lowHz, highHz);
      value += amp * HARMONIC_WEIGHTS[h - 1];
    }
    const pc = midi % 12;
    if (value > energy[pc]) energy[pc] = value;
  }
  return energy;
}

// ─────────────────────────────────────────────
// MOTEUR
// ─────────────────────────────────────────────

/**
 * Moteur A. analyze(samples) prend une trame de frameSize échantillons et renvoie
 * { notes: [{ midi, salience }], level (dB pleine échelle), tuning (cents),
 * classEnergy (12 valeurs, pour reconnaître les attaques dans le suivi) }.
 * Le recalage du La est lissé d'une trame à l'autre (état du moteur). `tracker` :
 * réglages du suivi (micTracker.js) propres à cette version.
 *
 * version (le temps des essais, les précédentes restent disponibles : A1, A2…) :
 * 1 : moteur d'origine ;
 * 2 : + classEnergy, pour la règle « pas de nouvelle note sans attaque » du suivi ;
 * 3 : + correction des erreurs d'octave dans le médium et l'aigu ;
 * 4 : + note grave sans ses harmoniques 2 à 4 écartée ; fenêtre d'attaque plus
 *     longue (500 ms) ;
 * 5 : + note grave sans son octave écartée (résonances fixes).
 */
export const CHROMA_LATEST = 5;

export function createChromaEngine({ sampleRate, version = CHROMA_LATEST, rules = {} }) {
  const attackGate = version >= 2;
  const octaveFix = version >= 3;
  const detection = {
    octaveFix,
    lowSupport: version >= 4,
    lowOctave: version >= 5,
    maxMidi: version >= 4 ? MIC_MAX_MIDI_HIGH : MIC_MAX_MIDI,
    ...rules,
  };
  const frameSize = frameSizeFor(sampleRate, 0.34);
  let tuning = 0;
  return {
    id: "chroma",
    maxMidi: detection.maxMidi,
    version,
    frameSize,
    tracker: version >= 4 ? { attackFrames: 10, releaseDb: 12 } : {},
    analyze(samples) {
      const level = levelDb(samples);
      const spectra = frameSpectra(samples);
      const peaks = framePeaks(samples, sampleRate, spectra);
      const measured = estimateTuning(peaks);
      if (measured !== null) {
        // Moyenne glissante, en tenant compte du passage de +50 à −50 cents
        let delta = measured - tuning;
        if (delta > 50) delta -= 100;
        if (delta < -50) delta += 100;
        tuning += 0.1 * delta;
        if (tuning > 50) tuning -= 100;
        if (tuning < -50) tuning += 100;
      }
      return {
        notes: detectNotes(peaks, tuning, detection),
        level,
        // Niveau des 2048 derniers échantillons (~45 ms) : chute brusque = relâchement
        recentLevel: levelDb(samples.subarray(samples.length - 2048)),
        tuning,
        classEnergy: attackGate ? classEnergy(spectra, sampleRate, tuning, detection.maxMidi) : undefined,
      };
    },
  };
}
