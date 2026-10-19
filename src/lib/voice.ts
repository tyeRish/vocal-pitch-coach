// Vocal mode estimation: clean / fry / grit / scream / growl / breathy.
//
// This is a heuristic, not a diagnosis. It looks at three things a coach listens for:
//   - periodicity (YIN clarity): clean tone is highly periodic, distortion is not
//   - spectral flatness: noise-like "hiss and rattle" vs. tonal harmonics
//   - spectral centroid: bright/high screams vs. dark/low gutturals
// Calibrating against the singer's own clean tone (see Calibration) makes it much more reliable.

export type VocalMode = 'silence' | 'clean' | 'fry' | 'grit' | 'scream' | 'growl' | 'breathy';

export const MODE_LABELS: Record<VocalMode, string> = {
  silence: '—',
  clean: 'Clean',
  fry: 'Fry',
  grit: 'Grit',
  scream: 'Scream',
  growl: 'Growl',
  breathy: 'Breathy',
};

/** Modes that load the voice hard enough to count toward the daily extreme budget. */
export const EXTREME_MODES: VocalMode[] = ['grit', 'scream', 'growl'];

export interface Calibration {
  noiseDb: number; // room/car noise floor
  cleanClarity: number; // YIN clarity of the singer's clean tone
  cleanFlatness: number; // spectral flatness of the singer's clean tone
  cleanHnr: number; // harmonic-to-noise ratio (dB) of the singer's clean tone
}

export const DEFAULT_CALIBRATION: Calibration = {
  noiseDb: -60,
  cleanClarity: 0.92,
  cleanFlatness: 0.06,
  cleanHnr: 30,
};

export interface SpectralFeatures {
  flatness: number; // 0 (pure tone) .. 1 (white noise)
  centroid: number; // Hz
  hfRatio: number; // share of energy above 2 kHz
}

/** Features from analyser.getFloatFrequencyData() output (dB per bin). */
export function spectralFeatures(freqDb: Float32Array, sampleRate: number, fftSize: number): SpectralFeatures {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.ceil(80 / binHz));
  // Bluetooth/hands-free mics often cap at 8 kHz; never read past Nyquist.
  const hi = Math.min(freqDb.length - 1, Math.floor(Math.min(8000, sampleRate / 2 - binHz) / binHz));
  const hfStart = Math.floor(2000 / binHz);
  let sumP = 0, sumLog = 0, sumFP = 0, hfP = 0, n = 0;
  for (let i = lo; i <= hi; i++) {
    let p = Math.pow(10, freqDb[i] / 10);
    if (!(p > 1e-14)) p = 1e-14;
    sumP += p;
    sumLog += Math.log(p);
    sumFP += p * i * binHz;
    if (i >= hfStart) hfP += p;
    n++;
  }
  if (n === 0 || sumP <= 0) return { flatness: 0, centroid: 0, hfRatio: 0 };
  return {
    flatness: Math.exp(sumLog / n) / (sumP / n),
    centroid: sumFP / sumP,
    hfRatio: hfP / sumP,
  };
}

/**
 * Harmonic-to-noise ratio in dB: harmonic peaks vs. the valleys between them.
 * Clean voice is typically 20–40 dB; grit fills the valleys in; screams have almost none.
 * Returns NaN when the harmonics are too close together to resolve.
 */
export function harmonicity(freqDb: Float32Array, f0: number, sampleRate: number, fftSize: number): number {
  const binHz = sampleRate / fftSize;
  if (!(f0 >= 6 * binHz)) return NaN;
  const maxHz = Math.min(5000, sampleRate / 2 - f0);
  const peakAt = (hz: number, halfWidth: number) => {
    const c = Math.round(hz / binHz);
    let best = -Infinity;
    for (let i = Math.max(1, c - halfWidth); i <= Math.min(freqDb.length - 1, c + halfWidth); i++) {
      if (freqDb[i] > best) best = freqDb[i];
    }
    return best;
  };
  let sumPeak = 0, sumValley = 0, n = 0;
  for (let k = 1; (k + 0.5) * f0 < maxHz && k <= 25; k++) {
    const peak = peakAt(k * f0, 2);
    const valley = peakAt((k + 0.5) * f0, 0);
    if (!isFinite(peak) || !isFinite(valley)) continue;
    sumPeak += peak;
    sumValley += valley;
    n++;
  }
  return n >= 3 ? (sumPeak - sumValley) / n : NaN;
}

export interface FrameFeatures extends SpectralFeatures {
  db: number; // RMS level in dBFS
  freq: number; // YIN estimate, -1 if none
  clarity: number;
  hnr: number; // dB, NaN if unknown
}

export interface Classification {
  mode: VocalMode;
  distortion: number; // 0..1
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function silenceThreshold(cal: Calibration) {
  return Math.max(-62, cal.noiseDb + 8);
}

export function classify(f: FrameFeatures, cal: Calibration = DEFAULT_CALIBRATION): Classification {
  const floor = silenceThreshold(cal);
  if (f.db < floor) return { mode: 'silence', distortion: 0 };

  const noisiness = clamp01((cal.cleanClarity - f.clarity) / 0.45);
  const flatN = clamp01((f.flatness - cal.cleanFlatness) / 0.25);
  const distortion = isNaN(f.hnr)
    ? clamp01(0.65 * noisiness + 0.35 * flatN)
    : clamp01(0.35 * noisiness + 0.45 * clamp01((cal.cleanHnr - f.hnr) / 22) + 0.2 * flatN);
  const pitched = f.freq > 0 && f.clarity > 0.35;

  // Fry: a slow, popping pulse train well below the singing range.
  if (pitched && f.freq < 70) return { mode: 'fry', distortion };
  if (distortion < 0.3) return { mode: 'clean', distortion };
  // Lots of air but not much level: that's breath, not a scream.
  if (f.db < floor + 14) return { mode: 'breathy', distortion };
  if (distortion < 0.6 && pitched) return { mode: 'grit', distortion };
  return { mode: f.centroid < 1400 ? 'growl' : 'scream', distortion };
}

/** Majority vote over recent frames so the mode badge doesn't flicker. */
export class ModeSmoother {
  private hist: VocalMode[] = [];
  constructor(private size = 8) {}
  push(mode: VocalMode): VocalMode {
    this.hist.push(mode);
    if (this.hist.length > this.size) this.hist.shift();
    if (mode === 'silence') return 'silence';
    const counts = new Map<VocalMode, number>();
    for (const m of this.hist) if (m !== 'silence') counts.set(m, (counts.get(m) ?? 0) + 1);
    let best: VocalMode = mode, bestN = 0;
    for (const [m, c] of counts) if (c > bestN) { best = m; bestN = c; }
    return best;
  }
  reset() { this.hist = []; }
}
