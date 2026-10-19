// YIN pitch detector (de Cheveigné & Kawahara, 2002).
// Works on a downsampled copy of the buffer so low notes and vocal fry (down to ~40 Hz)
// stay cheap enough to run every animation frame on a phone.

export interface PitchResult {
  freq: number; // Hz, or -1 when nothing periodic was found
  clarity: number; // 0..1 — how periodic (clean) the signal is
}

export interface YinOptions {
  minFreq?: number;
  maxFreq?: number;
  threshold?: number;
}

let scratchIn = new Float32Array(0);
let scratchDiff = new Float32Array(0);

export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

export function yin(buf: Float32Array, sampleRate: number, opts: YinOptions = {}): PitchResult {
  const minFreq = opts.minFreq ?? 40;
  const maxFreq = opts.maxFreq ?? 1400;
  const threshold = opts.threshold ?? 0.15;

  // Downsample to ~24 kHz: plenty for voice fundamentals, a quarter of the work.
  const factor = sampleRate >= 32000 ? 2 : 1;
  const n = Math.floor(buf.length / factor);
  if (scratchIn.length !== n) scratchIn = new Float32Array(n);
  const x = scratchIn;
  if (factor === 2) for (let i = 0; i < n; i++) x[i] = 0.5 * (buf[2 * i] + buf[2 * i + 1]);
  else x.set(buf.subarray(0, n));
  const sr = sampleRate / factor;

  const tauMin = Math.max(2, Math.floor(sr / maxFreq));
  const tauMax = Math.min(Math.floor(sr / minFreq), Math.floor(n / 2));
  const w = n - tauMax;
  if (scratchDiff.length !== tauMax + 2) scratchDiff = new Float32Array(tauMax + 2);
  const d = scratchDiff;

  // Difference function.
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const delta = x[j] - x[j + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalized difference.
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  // First dip under the threshold (then walk to its bottom); else the global minimum.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) {
    tau = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (d[t] < d[tau]) tau = t;
  }

  // Parabolic interpolation for sub-sample accuracy.
  let refined = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = d[tau - 1], s1 = d[tau], s2 = d[tau + 1];
    const denom = s0 + s2 - 2 * s1;
    if (denom !== 0) refined = tau + (s0 - s2) / (2 * denom);
  }

  const clarity = Math.max(0, Math.min(1, 1 - d[tau]));
  if (!(refined > 0)) return { freq: -1, clarity: 0 };
  return { freq: sr / refined, clarity };
}
