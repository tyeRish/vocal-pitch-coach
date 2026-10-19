// Synthetic test signals and a tiny FFT that mimics AnalyserNode.getFloatFrequencyData().

export const SR = 48000;
export const N = 4096;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function sine(freq: number, amp = 0.5, n = N, sr = SR) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return b;
}

/** Voice-like tone: many harmonics with falling amplitude. */
export function harmonic(freq: number, amp = 0.4, n = N, sr = SR) {
  const b = new Float32Array(n);
  for (let h = 1; h * freq < sr / 2 && h <= 30; h++) {
    const a = amp / h;
    for (let i = 0; i < n; i++) b[i] += a * Math.sin((2 * Math.PI * freq * h * i) / sr + h);
  }
  return b;
}

/** Vocal-fry-like pulse train: short decaying clicks at a low rate. */
export function pulses(rate: number, amp = 0.4, n = N, sr = SR) {
  const b = new Float32Array(n);
  const period = sr / rate;
  for (let i = 0; i < n; i++) {
    const ph = i % period;
    b[i] = amp * Math.exp(-ph / 60) * Math.sin(ph * 0.3);
  }
  return b;
}

/**
 * Distorted, gritty tone: a voiced note whose amplitude is shaken by noise (fold rattle)
 * plus a period-doubling subharmonic — the two things that make real grit sound rough.
 */
export function gritty(freq: number, roughness: number, amp = 0.4, n = N, sr = SR) {
  const tone = harmonic(freq, amp, n, sr);
  const shake = lowpass(noise(1, n, 3), freq * 2, sr);
  const peak = shake.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sub = 1 + roughness * 0.5 * Math.sin((Math.PI * freq * i) / sr);
    out[i] = tone[i] * (1 + roughness * (shake[i] / peak)) * sub;
  }
  return out;
}

export function noise(amp = 0.3, n = N, seed = 7) {
  const r = rng(seed);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = amp * (r() * 2 - 1);
  return b;
}

/** One-pole low-pass, for "dark" noise. */
export function lowpass(buf: Float32Array, cutoff: number, sr = SR) {
  const a = Math.exp((-2 * Math.PI * cutoff) / sr);
  const out = new Float32Array(buf.length);
  let y = 0;
  for (let i = 0; i < buf.length; i++) out[i] = y = (1 - a) * buf[i] + a * y;
  return out;
}

/** One-pole high-pass, for "bright" noise. */
export function highpass(buf: Float32Array, cutoff: number, sr = SR) {
  const lp = lowpass(buf, cutoff, sr);
  return buf.map((v, i) => v - lp[i]);
}

export function mix(...bufs: Float32Array[]) {
  const out = new Float32Array(bufs[0].length);
  for (const b of bufs) for (let i = 0; i < out.length; i++) out[i] += b[i];
  return out;
}

/** Blackman-windowed magnitude spectrum in dB, like the Web Audio AnalyserNode. */
export function spectrumDb(buf: Float32Array): Float32Array {
  const n = buf.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
    re[i] = buf[i] * w;
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
        const tr = ar * wr - ai * wi, ti = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti;
        re[i + k] += tr; im[i + k] += ti;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = 20 * Math.log10(Math.hypot(re[i], im[i]) / n + 1e-12);
  return out;
}
