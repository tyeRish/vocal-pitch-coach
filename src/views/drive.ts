// Drive Mode: a hands-free, eyes-free session. Spoken instructions, beeps for go/rest,
// spoken scores. Only exercises that are safe to do while driving are included.

import { engine } from '../audio/engine';
import { speech } from '../audio/speech';
import { store } from '../data/store';
import { byId, WORKOUTS } from '../data/exercises';
import { percentile } from '../lib/zone';
import { extremeBudgetLeft } from '../session';
import { Runner } from '../training/runner';
import type { Result } from '../training/scoring';
import { clear, h, onToast } from '../ui/dom';
import { startMic } from './shared';

const QUICK = ['siren', 'five-tone', 'sustain', 'arpeggio', 'freddie-run', 'fry-hold', 'grit-sustain', 'cooldown'];

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0];

export function mountDrive(root: HTMLElement) {
  const view = h('section', { class: 'view drive' });
  root.append(view);
  let runner: Runner | null = null;
  let stopped = false;
  let offToast: (() => void) | null = null;
  let savedNoise: number | null = null;
  let skip: (() => void) | null = null;

  const end = () => {
    stopped = true;
    runner?.stop();
    runner = null;
    skip?.();
    speech.cancel();
    offToast?.();
    offToast = null;
    engine.releaseWakeLock();
    if (savedNoise !== null) { store.updateCalibration({ noiseDb: savedNoise }); savedNoise = null; }
  };

  const setup = () => {
    end();
    clear(view,
      h('div', { class: 'card hero' },
        h('h2', {}, '🚗 Drive Mode'),
        h('p', {}, 'Fully hands-free: I talk you through each exercise, beep when it\'s your turn and read out your score. You never need to look at the screen.'),
        h('ul', { class: 'how' },
          h('li', {}, 'Set it up and press start BEFORE you pull out. Mount the phone; don\'t touch it while moving.'),
          h('li', {}, 'Play through the car speakers (Bluetooth or cable). Windows up helps the mic.'),
          h('li', {}, 'Drive Mode skips full screams and gutturals — those need bracing and breath-holding that don\'t mix with driving. Fry and light grit are included.'),
          h('li', {}, 'Keep your eyes on the road. If traffic needs your attention, just stop singing — missed reps don\'t matter.'),
        ),
        h('button', { class: 'btn primary huge', onclick: () => void go(QUICK) }, '▶ Quick session (~8 min)'),
        h('button', { class: 'btn huge', onclick: () => void go(WORKOUTS.drive) }, '▶ Full session (~15 min)'),
      ),
    );
  };

  const go = async (ids: string[]) => {
    stopped = false;
    if (!(await startMic())) return;
    await engine.keepAwake();

    const big = h('div', { class: 'drive-big' }, 'Starting…');
    const sub = h('div', { class: 'drive-sub' });
    const scoreEl = h('div', { class: 'drive-score' });
    clear(view,
      h('div', { class: 'drive-panel' }, big, sub, scoreEl,
        h('div', { class: 'drive-controls' },
          h('button', { class: 'btn huge', onclick: () => { runner?.stop(); skip?.(); } }, '⏭ Skip'),
          h('button', { class: 'btn huge danger', onclick: setup }, '■ End'),
        ),
      ),
    );
    offToast = onToast((msg) => void speech.say(firstSentence(msg)));

    // Measure road noise so the engine knows what "silence" sounds like in this car.
    big.textContent = 'Measuring road noise';
    await speech.say('Drive session. Stay quiet for three seconds while I listen to the road.');
    if (stopped) return;
    const dbs: number[] = [];
    await new Promise<void>((resolve) => {
      const t0 = engine.now();
      const off = engine.onFrame((f) => {
        dbs.push(f.db);
        if (f.t - t0 > 3 || stopped) { off(); resolve(); }
      });
    });
    if (stopped) return;
    savedNoise = store.profile.calibration.noiseDb;
    store.updateCalibration({ noiseDb: Math.max(-90, Math.min(-20, percentile(dbs.sort((a, b) => a - b), 0.9))) });

    const scores: number[] = [];
    for (let i = 0; i < ids.length && !stopped; i++) {
      const ex = byId(ids[i]);
      if (ex.extreme && extremeBudgetLeft() <= 0) continue;
      big.textContent = ex.name;
      sub.textContent = ex.listenFirst ? 'Listen, then sing after the beep' : 'High beep = go · Low beep = rest';
      scoreEl.textContent = `${i + 1} / ${ids.length}`;
      await speech.say(`${ex.spoken} ${ex.listenFirst ? 'Listen first, then sing after the beep.' : 'Go on the high beep, rest on the low beep.'}`);
      if (stopped) return;

      const result = await new Promise<Result | null>((resolve) => {
        skip = () => resolve(null);
        runner = new Runner(ex, {
          onTarget: (tg) => {
            if (!tg) return;
            sub.textContent = tg.phase === 'listen' ? '👂 Listen' : tg.step.rest ? 'Rest' : tg.step.cue ?? '🎤 Sing';
          },
          onDone: resolve,
        });
        runner.start().catch(() => resolve(null));
      });
      runner = null;
      skip = null;
      if (stopped) return;
      if (!result) continue;

      scores.push(result.score);
      const s = Math.round(result.score);
      scoreEl.textContent = `${s}%`;
      const tip = result.feedback.find((f) => !/^(Excellent|Solid)/.test(f));
      await speech.say(`${s} percent.${tip ? ' ' + firstSentence(tip) : s >= 85 ? ' Excellent.' : ''}`);
    }
    if (stopped) return;

    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    big.textContent = 'Session complete';
    sub.textContent = `Average ${avg}% over ${scores.length} exercises`;
    scoreEl.textContent = '🤘';
    await speech.say(`Session complete. Average ${avg} percent. Great work. Drink some water.`);
    end();
  };

  setup();
  return end;
}
