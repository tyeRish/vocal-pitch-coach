// Turns an exercise into a timeline of targets, and scores live frames against it.

import type { Range } from '../lib/music';
import type { VocalMode } from '../lib/voice';
import type { Exercise, Step } from '../data/exercises';

export interface Target {
  start: number;
  end: number;
  step: Step;
  phase: 'listen' | 'sing';
  rep: number;
}

export interface Timeline {
  targets: Target[];
  end: number;
  bases: number[]; // base note used for each rep
}

export const DEFAULT_ZONE: Range = { low: 48, high: 60 }; // C3–C4
export const DEFAULT_RANGE: Range = { low: 43, high: 67 }; // G2–G4

export function anchorNote(ex: Exercise, zone: Range, range: Range): number {
  const a = { zoneLow: zone.low, zoneMid: Math.round((zone.low + zone.high) / 2), zoneHigh: zone.high, rangeHigh: range.high }[ex.anchor];
  return a + (ex.offset ?? 0);
}

function span(steps: Step[]) {
  let lo = Infinity, hi = -Infinity;
  for (const s of steps) for (const m of [s.midi, s.midiEnd]) if (m !== undefined) { lo = Math.min(lo, m); hi = Math.max(hi, m); }
  return lo === Infinity ? null : { lo, hi };
}

const isPitched = (steps: Step[]) => steps.some((s) => s.midi !== undefined);

export function buildTimeline(ex: Exercise, zone: Range, range: Range, startAt: number, baseOverride?: number): Timeline {
  const targets: Target[] = [];
  const bases: number[] = [];
  let base = baseOverride ?? anchorNote(ex, zone, range);
  const rel = span(ex.build(0));
  // Shift the first rep so the whole pattern fits inside your range.
  if (rel) {
    if (base + rel.hi > range.high + 1) base = range.high + 1 - rel.hi;
    if (base + rel.lo < range.low - 1) base = range.low - 1 - rel.lo;
  }
  let t = startAt;
  for (let rep = 0; rep < ex.reps; rep++) {
    const b = base + rep * ex.ascend;
    if (rep > 0 && rel && (b + rel.hi > range.high + 1 || b + rel.lo < range.low - 1)) break;
    bases.push(b);
    const steps = ex.build(b);
    if (ex.listenFirst && isPitched(steps)) {
      for (const step of steps) {
        if (!step.rest) targets.push({ start: t, end: t + step.dur, step, phase: 'listen', rep });
        t += step.dur;
      }
      t += 0.6;
    }
    for (const step of steps) {
      targets.push({ start: t, end: t + step.dur, step, phase: 'sing', rep });
      t += step.dur;
    }
    t += 0.8;
  }
  return { targets, end: t, bases };
}

/** Target pitch at time t (linear in semitones for glides). */
export function targetMidiAt(target: Target, t: number): number | undefined {
  const { midi, midiEnd } = target.step;
  if (midi === undefined) return undefined;
  if (midiEnd === undefined) return midi;
  const k = Math.max(0, Math.min(1, (t - target.start) / (target.end - target.start)));
  return midi + (midiEnd - midi) * k;
}

export interface ScoreFrame {
  t: number;
  midi: number | null;
  mode: VocalMode;
  db: number;
}

interface Acc {
  n: number;
  inTune: number;
  voiced: number;
  centsSum: number;
  centsN: number;
  modeHit: number;
  loud: number;
  modes: Map<VocalMode, number>;
}

export interface StepResult {
  target: Target;
  score: number | null; // 0..1, null for rests
  pitch: number | null;
  mode: number | null;
  loudFrac: number;
  avgCents: number | null;
  topMode: VocalMode | null;
}

export interface Result {
  score: number; // 0..100
  steps: StepResult[];
  feedback: string[];
}

export interface ScoreOptions {
  toleranceCents: number;
  loudLimitDb: number;
}

const ONSET = 0.15;

export class Scorer {
  private accs: Acc[];
  private sing: Target[];

  constructor(targets: Target[], private opts: ScoreOptions) {
    this.sing = targets.filter((t) => t.phase === 'sing');
    this.accs = this.sing.map(() => ({ n: 0, inTune: 0, voiced: 0, centsSum: 0, centsN: 0, modeHit: 0, loud: 0, modes: new Map() }));
  }

  /** Feed one analysis frame. Returns the index of the active target, or -1. */
  push(f: ScoreFrame): number {
    const i = this.sing.findIndex((t) => f.t >= t.start && f.t < t.end);
    if (i < 0) return -1;
    const tg = this.sing[i];
    if (tg.step.rest || f.t < tg.start + ONSET) return i;
    const a = this.accs[i];
    a.n++;
    if (f.mode !== 'silence') a.modes.set(f.mode, (a.modes.get(f.mode) ?? 0) + 1);
    if (tg.step.modes?.includes(f.mode)) a.modeHit++;
    if (f.db > this.opts.loudLimitDb - (tg.step.quiet ? 12 : 0)) a.loud++;

    const want = targetMidiAt(tg, f.t);
    if (want !== undefined && f.midi !== null) {
      a.voiced++;
      let err = (f.midi - want) * 100;
      if (tg.step.anyOctave) err = ((((err + 600) % 1200) + 1200) % 1200) - 600;
      const glide = tg.step.midiEnd !== undefined;
      const tol = glide ? 150 : this.opts.toleranceCents * (tg.step.anyOctave ? 1.6 : 1);
      if (Math.abs(err) <= tol) a.inTune++;
      if (!glide && Math.abs(err) <= 100) { a.centsSum += err; a.centsN++; }
    }
    return i;
  }

  result(): Result {
    const steps: StepResult[] = this.sing.map((target, i) => {
      const a = this.accs[i];
      const s = target.step;
      let topMode: VocalMode | null = null, topN = 0;
      for (const [m, c] of a.modes) if (c > topN) { topMode = m; topN = c; }
      const base = { target, loudFrac: a.n ? a.loud / a.n : 0, avgCents: a.centsN ? a.centsSum / a.centsN : null, topMode };
      if (s.rest) return { ...base, score: null, pitch: null, mode: null };
      const n = Math.max(1, a.n);
      const pitch = s.midi !== undefined ? a.inTune / n : null;
      const mode = s.modes && s.midiEnd === undefined ? a.modeHit / n : null;
      let score = pitch !== null && mode !== null ? 0.6 * pitch + 0.4 * mode : (pitch ?? mode ?? 0);
      if (s.quiet) score *= 1 - 0.5 * base.loudFrac;
      return { ...base, score, pitch, mode };
    });
    const scored = steps.filter((s) => s.score !== null);
    const score = scored.length ? (100 * scored.reduce((sum, s) => sum + s.score!, 0)) / scored.length : 0;
    return { score, steps, feedback: feedback(steps, score) };
  }
}

const MODE_TIPS: Partial<Record<VocalMode, string>> = {
  fry: 'Fry wasn\'t picked up much — go quieter and lower, with almost no air. Think lazy, creaky door.',
  grit: 'Not much grit detected — add a little rattle on top while keeping the note going.',
  clean: 'Some distortion or air crept into the clean notes — lighten up and keep the tone pure.',
  scream: 'The scream didn\'t fully open — more air and a wider mouth (never more squeeze).',
  growl: 'Go darker — lower tongue, open throat, more air through a relaxed fry.',
};

function feedback(steps: StepResult[], score: number): string[] {
  const tips: string[] = [];
  const pitched = steps.filter((s) => s.avgCents !== null);
  if (pitched.length) {
    const avg = pitched.reduce((sum, s) => sum + s.avgCents!, 0) / pitched.length;
    if (avg < -12) tips.push(`You're running about ${Math.round(-avg)}¢ flat. Breathe lower, keep the support on, and think "up and forward" on each note.`);
    else if (avg > 12) tips.push(`You're running about ${Math.round(avg)}¢ sharp. Relax — you may be pushing or reaching for the notes.`);
  }
  const pitchSteps = steps.filter((s) => s.pitch !== null);
  if (pitchSteps.length && pitchSteps.reduce((sum, s) => sum + s.pitch!, 0) / pitchSteps.length < 0.35) {
    tips.push('A lot of notes missed the target. Use "listen first" and hum the note in your head before you sing it.');
  }

  const byMode = new Map<VocalMode, StepResult[]>();
  for (const s of steps) for (const m of s.target.step.modes ?? []) {
    if (s.mode === null) continue;
    byMode.set(m, [...(byMode.get(m) ?? []), s]);
  }
  for (const [m, list] of byMode) {
    const avg = list.reduce((sum, s) => sum + s.mode!, 0) / list.length;
    if (avg >= 0.5) continue;
    if (m === 'grit' && list.some((s) => s.topMode === 'scream' || s.topMode === 'growl')) {
      tips.push('The grit turned into pure noise — keep the pitch underneath the distortion.');
    } else if (MODE_TIPS[m] && !tips.includes(MODE_TIPS[m]!)) {
      tips.push(MODE_TIPS[m]!);
    }
  }

  if (steps.some((s) => s.target.step.modes?.some((m) => m !== 'clean') && s.loudFrac > 0.3)) {
    tips.push('You were pushing past your loudness limit. Distortion should come from air and placement, not force — back off.');
  }
  if (score >= 85) tips.unshift('Excellent — that was locked in. Try it a step higher or on Hard difficulty.');
  else if (score >= 65) tips.unshift('Solid work. A few more reps and this will be second nature.');
  return tips;
}
