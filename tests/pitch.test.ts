import { describe, expect, it } from 'vitest';
import { yin, rms } from '../src/lib/pitch';
import { freqToMidi } from '../src/lib/music';
import { SR, sine, harmonic, pulses, noise } from './signals';

const centsError = (got: number, want: number) => Math.abs(1200 * Math.log2(got / want));

describe('yin', () => {
  for (const f of [82.41, 110, 196, 261.63, 440, 659.25, 880]) {
    it(`finds a ${f} Hz sine within 5 cents`, () => {
      const r = yin(sine(f), SR);
      expect(centsError(r.freq, f)).toBeLessThan(5);
      expect(r.clarity).toBeGreaterThan(0.9);
    });
  }

  for (const f of [73.42, 98, 146.83, 220, 392]) {
    it(`finds a harmonic-rich ${f} Hz tone without octave errors`, () => {
      const r = yin(harmonic(f), SR);
      expect(centsError(r.freq, f)).toBeLessThan(10);
    });
  }

  it('works at 44.1 kHz and 16 kHz (Bluetooth hands-free) sample rates', () => {
    expect(centsError(yin(harmonic(220, 0.4, 4096, 44100), 44100).freq, 220)).toBeLessThan(10);
    expect(centsError(yin(harmonic(220, 0.4, 2048, 16000), 16000).freq, 220)).toBeLessThan(10);
  });

  it('tracks a vocal-fry pulse train at ~50 Hz', () => {
    const r = yin(pulses(50), SR);
    expect(centsError(r.freq, 50)).toBeLessThan(30);
    expect(freqToMidi(r.freq)).toBeLessThan(freqToMidi(70));
  });

  it('reports low clarity for noise', () => {
    expect(yin(noise(), SR).clarity).toBeLessThan(0.6);
  });

  it('rms of a full-scale sine is ~0.707', () => {
    expect(rms(sine(440, 1))).toBeCloseTo(Math.SQRT1_2, 2);
  });
});
