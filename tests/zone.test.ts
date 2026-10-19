import { describe, expect, it } from 'vitest';
import { analyzeVoice, comfortZone, stableMidis } from '../src/lib/zone';

/** Hold each note for `frames` frames, with a little natural wobble. */
const hold = (notes: number[], frames = 30) =>
  notes.flatMap((n) => Array.from({ length: frames }, (_, i) => n + 0.1 * Math.sin(i)));

describe('stableMidis', () => {
  it('keeps held notes and drops slides and gaps', () => {
    const slide = Array.from({ length: 30 }, (_, i) => 48 + i * 0.5);
    expect(stableMidis(slide).length).toBe(0);
    expect(stableMidis([...hold([50], 20), null, ...hold([52], 20)]).length).toBeGreaterThan(20);
  });
});

describe('comfortZone', () => {
  it('finds where most singing happens', () => {
    const z = comfortZone([...hold([50, 52, 53, 55, 57, 55, 53, 52]), ...hold([64], 5), ...hold([45], 5)])!;
    expect(z.low).toBeGreaterThanOrEqual(49);
    expect(z.high).toBeLessThanOrEqual(58);
  });

  it('is at least 5 semitones wide', () => {
    const z = comfortZone(hold([55], 100))!;
    expect(z.high - z.low).toBeGreaterThanOrEqual(5);
  });
});

describe('analyzeVoice', () => {
  it('produces a sensible baritone-ish analysis', () => {
    const a = analyzeVoice({
      speak: hold([47, 48, 46, 47], 15),
      low: hold([50, 47, 44, 42, 41]),
      high: hold([55, 60, 64, 67, 69]),
      comfort: hold([48, 50, 52, 53, 55, 57, 55, 53, 52, 50, 48, 52, 55, 53, 52, 50]),
    })!;
    expect(a.range.low).toBeLessThanOrEqual(42);
    expect(a.range.high).toBeGreaterThanOrEqual(68);
    expect(a.zone.low).toBeGreaterThanOrEqual(47);
    expect(a.zone.high).toBeLessThanOrEqual(58);
    expect(a.speakingMidi).toBe(47);
    expect(['Baritone', 'Tenor']).toContain(a.voiceType);
    expect(a.keys.length).toBe(4);
  });

  it('returns null with too little data', () => {
    expect(analyzeVoice({ speak: [], low: [], high: [], comfort: [] })).toBeNull();
  });
});
