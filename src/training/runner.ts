// Runs an exercise live: schedules reference tones and beeps, feeds mic frames to the
// scorer, and reports progress and the final result.

import { engine, type Frame } from '../audio/engine';
import { tone } from '../audio/tone';
import { store } from '../data/store';
import type { Exercise } from '../data/exercises';
import { buildTimeline, DEFAULT_RANGE, DEFAULT_ZONE, Scorer, type Result, type Target, type Timeline } from './scoring';

export const TOLERANCE = { easy: 50, normal: 30, hard: 18 } as const;

export interface RunHandlers {
  onTarget?(target: Target | null, timeline: Timeline): void;
  onFrame?(frame: Frame): void;
  onDone(result: Result): void;
}

export class Runner {
  timeline!: Timeline;
  private scorer!: Scorer;
  private cancels: (() => void)[] = [];
  private off: (() => void) | null = null;
  private current: Target | null = null;
  private finished = false;

  constructor(readonly exercise: Exercise, private handlers: RunHandlers, private baseOverride?: number) {}

  async start() {
    await engine.start();
    const { profile, settings } = store;
    const startAt = engine.now() + 1.2;
    this.timeline = buildTimeline(this.exercise, profile.zone ?? DEFAULT_ZONE, profile.range ?? DEFAULT_RANGE, startAt, this.baseOverride);
    this.scorer = new Scorer(this.timeline.targets, {
      toleranceCents: TOLERANCE[settings.difficulty],
      loudLimitDb: settings.loudLimitDb,
    });

    let prevPhase: Target['phase'] | null = null;
    for (const tg of this.timeline.targets) {
      const { midi, midiEnd, rest } = tg.step;
      if (tg.phase === 'listen' && midi !== undefined) {
        this.cancels.push(tone.note(midi, tg.step.dur, tg.start, midiEnd));
      } else if (tg.phase === 'sing') {
        if (prevPhase !== 'sing') this.cancels.push(tone.click(tg.start - 0.45, true));
        if (midi === undefined) this.cancels.push(tone.click(tg.start, !rest));
        else if (settings.guideTone) this.cancels.push(tone.note(midi, tg.step.dur, tg.start, midiEnd, 0.2));
      }
      prevPhase = tg.phase;
    }

    this.off = engine.onFrame((f) => this.frame(f));
    this.handlers.onTarget?.(null, this.timeline);
  }

  private frame(f: Frame) {
    if (this.finished) return;
    this.scorer.push({ t: f.t, midi: f.midi, mode: f.mode, db: f.db });
    const active = this.timeline.targets.find((t) => f.t >= t.start && f.t < t.end) ?? null;
    if (active !== this.current) {
      this.current = active;
      this.handlers.onTarget?.(active, this.timeline);
    }
    this.handlers.onFrame?.(f);
    if (f.t > this.timeline.end) this.finish();
  }

  private finish() {
    this.finished = true;
    this.cleanup();
    const result = this.scorer.result();
    store.logScore(this.exercise.id, result.score);
    this.handlers.onDone(result);
  }

  stop() {
    this.finished = true;
    this.cleanup();
  }

  private cleanup() {
    this.off?.();
    this.off = null;
    this.cancels.forEach((c) => c());
    this.cancels = [];
  }
}
