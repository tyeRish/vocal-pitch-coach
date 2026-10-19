import { describe, expect, it } from 'vitest';
import { classify, spectralFeatures, harmonicity, ModeSmoother, type VocalMode } from '../src/lib/voice';
import { yin, rms } from '../src/lib/pitch';
import { SR, N, harmonic, pulses, noise, lowpass, highpass, gritty, spectrumDb } from './signals';

function modeOf(buf: Float32Array): VocalMode {
  const p = yin(buf, SR);
  const spec = spectrumDb(buf);
  const s = spectralFeatures(spec, SR, N);
  const hnr = harmonicity(spec, p.freq, SR, N);
  return classify({ ...s, db: 20 * Math.log10(rms(buf)), freq: p.freq, clarity: p.clarity, hnr }).mode;
}

describe('classify', () => {
  it('clean harmonic tone → clean', () => {
    expect(modeOf(harmonic(220))).toBe('clean');
    expect(modeOf(harmonic(110))).toBe('clean');
  });

  it('low pulse train → fry', () => {
    expect(modeOf(pulses(45))).toBe('fry');
  });

  it('rough, rattling tone → grit', () => {
    expect(modeOf(gritty(196, 0.6))).toBe('grit');
    expect(modeOf(gritty(196, 0.9))).toBe('grit');
  });

  it('loud bright noise → scream', () => {
    expect(modeOf(highpass(noise(0.5), 1500))).toBe('scream');
  });

  it('loud dark noise → growl', () => {
    expect(modeOf(lowpass(noise(0.9), 500))).toBe('growl');
  });

  it('quiet noise → breathy, not scream', () => {
    expect(modeOf(noise(0.01))).toBe('breathy');
  });

  it('near-silence → silence', () => {
    expect(modeOf(noise(0.0003))).toBe('silence');
  });
});

describe('ModeSmoother', () => {
  it('ignores single-frame blips', () => {
    const s = new ModeSmoother(5);
    for (let i = 0; i < 5; i++) s.push('clean');
    expect(s.push('scream')).toBe('clean');
  });
});
