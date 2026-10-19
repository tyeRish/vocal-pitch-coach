import { describe, expect, it } from 'vitest';
import {
  midiToName, nameToMidi, analyzeFreq, detectKey, recommendKeys, transposeSong, estimateVoiceType,
} from '../src/lib/music';

describe('note math', () => {
  it('names notes', () => {
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(40)).toBe('E2');
    expect(nameToMidi('F#2')).toBe(42);
    expect(nameToMidi('Bb3')).toBe(58);
  });

  it('measures cents', () => {
    const a = analyzeFreq(445);
    expect(a.name).toBe('A4');
    expect(a.cents).toBeCloseTo(19.56, 1);
  });
});

describe('detectKey', () => {
  it('finds C major from a C major scale', () => {
    const h = new Array(12).fill(0);
    for (const pc of [0, 2, 4, 5, 7, 9, 11]) h[pc] = 1;
    h[0] = 3; h[7] = 2; h[4] = 2;
    expect(detectKey(h)[0].name).toBe('C major');
  });

  it('finds E minor when E and B dominate', () => {
    const h = new Array(12).fill(0);
    for (const pc of [4, 6, 7, 9, 11, 0, 2]) h[pc] = 1;
    h[4] = 4; h[11] = 2; h[7] = 2;
    expect(detectKey(h)[0].name).toBe('E minor');
  });

  it('returns nothing for an empty histogram', () => {
    expect(detectKey(new Array(12).fill(0))).toEqual([]);
  });
});

describe('recommendations', () => {
  const baritone = { zone: { low: 48, high: 62 }, range: { low: 41, high: 69 } }; // C3–D4, F2–A4

  it('puts the melody body inside the zone', () => {
    const best = recommendKeys(baritone.zone, baritone.range)[0];
    expect(best.body.low).toBeGreaterThanOrEqual(baritone.zone.low);
    expect(best.body.high).toBeLessThanOrEqual(baritone.zone.high);
  });

  it('transposes a too-high song down into range', () => {
    const t = transposeSong({ low: 57, high: 76 }, baritone.zone, baritone.range); // A3–E5
    expect(t.shift).toBeLessThan(0);
    expect(t.fits).toBe(true);
  });

  it('estimates voice type', () => {
    expect(estimateVoiceType(baritone.zone, baritone.range)).toBe('Baritone');
    expect(estimateVoiceType({ low: 64, high: 79 }, { low: 57, high: 86 })).toBe('Soprano');
  });
});
