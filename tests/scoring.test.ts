import { describe, expect, it } from 'vitest';
import { buildTimeline, Scorer, targetMidiAt, type ScoreFrame } from '../src/training/scoring';
import { byId, EXERCISES } from '../src/data/exercises';
import type { VocalMode } from '../src/lib/voice';

const zone = { low: 48, high: 60 };
const range = { low: 41, high: 67 };
const opts = { toleranceCents: 30, loudLimitDb: -6 };

/** Simulate a singer at 45 fps who does `sing(target)` for each sing target. */
function simulate(id: string, sing: (midi: number | undefined, modes: VocalMode[] | undefined) => Partial<ScoreFrame>) {
  const tl = buildTimeline(byId(id), zone, range, 0);
  const scorer = new Scorer(tl.targets, opts);
  for (let t = 0; t < tl.end; t += 1 / 45) {
    const tg = tl.targets.find((x) => x.phase === 'sing' && t >= x.start && t < x.end);
    const base: ScoreFrame = { t, midi: null, mode: 'silence', db: -70 };
    if (tg && !tg.step.rest) Object.assign(base, sing(targetMidiAt(tg, t), tg.step.modes));
    scorer.push(base);
  }
  return scorer.result();
}

describe('buildTimeline', () => {
  it('every exercise builds a non-empty timeline that fits the range', () => {
    for (const ex of EXERCISES) {
      const tl = buildTimeline(ex, zone, range, 0);
      expect(tl.targets.length, ex.id).toBeGreaterThan(0);
      for (const t of tl.targets) {
        for (const m of [t.step.midi, t.step.midiEnd]) {
          if (m === undefined) continue;
          expect(m, ex.id).toBeGreaterThanOrEqual(range.low - 1);
          expect(m, ex.id).toBeLessThanOrEqual(range.high + 1);
        }
      }
    }
  });

  it('plays the pattern first, then the sing phase', () => {
    const tl = buildTimeline(byId('five-tone'), zone, range, 0);
    const first = tl.targets.filter((t) => t.rep === 0);
    expect(first[0].phase).toBe('listen');
    expect(first.filter((t) => t.phase === 'sing').length).toBe(9);
  });

  it('ascends each rep but stops at the top of the range', () => {
    const tl = buildTimeline(byId('belt-climb'), zone, { low: 41, high: 62 }, 0);
    expect(tl.bases.length).toBeGreaterThanOrEqual(1);
    expect(Math.max(...tl.bases) + 7).toBeLessThanOrEqual(63);
  });
});

describe('Scorer', () => {
  it('perfect singing scores ~100', () => {
    const r = simulate('five-tone', (midi) => ({ midi: midi!, mode: 'clean', db: -20 }));
    expect(r.score).toBeGreaterThan(95);
  });

  it('silence scores 0', () => {
    expect(simulate('five-tone', () => ({})).score).toBe(0);
  });

  it('detects consistent flatness and says so', () => {
    const r = simulate('sustain', (midi) => ({ midi: midi! - 0.25, mode: 'clean', db: -20 }));
    expect(r.feedback.join(' ')).toMatch(/flat/);
  });

  it('accepts gritty pitch an octave off', () => {
    const r = simulate('grit-sustain', (midi) => ({ midi: midi! - 12, mode: 'grit', db: -15 }));
    expect(r.score).toBeGreaterThan(90);
  });

  it('scores mode-only extreme steps by mode, and penalizes loud fry', () => {
    const good = simulate('fry-hold', () => ({ mode: 'fry', db: -35 }));
    const loud = simulate('fry-hold', () => ({ mode: 'fry', db: -5 }));
    expect(good.score).toBeGreaterThan(90);
    expect(loud.score).toBeLessThan(60);
  });

  it('warns when grit becomes pure noise', () => {
    const r = simulate('grit-sustain', () => ({ mode: 'scream', db: -15 }));
    expect(r.feedback.join(' ')).toMatch(/pure noise/);
  });
});
