// Pieces shared across views: the mic toggle and the interactive exercise player.

import { engine } from '../audio/engine';
import { store } from '../data/store';
import { CATEGORY_LABELS, type Exercise } from '../data/exercises';
import { midiToName } from '../lib/music';
import { MODE_LABELS } from '../lib/voice';
import { extremeBudgetLeft } from '../session';
import { Runner } from '../training/runner';
import { anchorNote, DEFAULT_RANGE, DEFAULT_ZONE, type Result } from '../training/scoring';
import { clear, h, toast } from '../ui/dom';
import { Roll, MODE_COLORS } from '../ui/roll';

export async function startMic(): Promise<boolean> {
  try {
    await engine.start();
    return true;
  } catch (e) {
    const name = (e as DOMException)?.name;
    toast(name === 'NotAllowedError'
      ? 'Microphone blocked. Allow mic access for this site in your browser settings.'
      : 'Could not start the microphone. Is another app using it?', 'warn');
    return false;
  }
}

export function micButton() {
  const btn = h('button', { class: 'btn primary big mic-toggle' });
  const render = () => {
    btn.textContent = engine.running ? '■ Stop mic' : '🎙 Start mic';
    btn.classList.toggle('live', engine.running);
  };
  btn.addEventListener('click', () => { if (engine.running) engine.stop(); else void startMic(); });
  engine.onStatus(render);
  render();
  return btn;
}

const stars = (score: number) => '★'.repeat(score >= 90 ? 3 : score >= 70 ? 2 : score >= 45 ? 1 : 0).padEnd(3, '☆');

export function resultView(result: Result) {
  return h('div', { class: 'result' },
    h('div', { class: 'score' }, `${Math.round(result.score)}`, h('small', {}, '%')),
    h('div', { class: 'stars' }, stars(result.score)),
    h('ul', { class: 'tips' }, ...result.feedback.map((f) => h('li', {}, f))),
  );
}

/** Full exercise card: instructions → live run with roll → result. */
export function exercisePlayer(ex: Exercise, opts: { onBack: () => void; onNext?: () => void }) {
  const root = h('div', { class: 'card player' });
  let runner: Runner | null = null;
  let roll: Roll | null = null;
  const { zone = DEFAULT_ZONE, range = DEFAULT_RANGE } = store.profile;
  let base = anchorNote(ex, zone, range);
  const pitched = ex.build(0).some((s) => s.midi !== undefined);

  const teardown = () => {
    runner?.stop();
    runner = null;
    roll?.destroy();
    roll = null;
  };

  const intro = () => {
    teardown();
    const baseLabel = h('strong', {}, midiToName(base));
    const shift = (d: number) => { base += d; baseLabel.textContent = midiToName(base); };
    const budgetGone = ex.extreme && extremeBudgetLeft() <= 0;
    clear(root,
      h('div', { class: 'player-head' },
        h('button', { class: 'btn ghost small', onclick: () => { teardown(); opts.onBack(); } }, '← Back'),
        h('span', { class: 'chip' }, CATEGORY_LABELS[ex.category]),
      ),
      h('h2', {}, ex.name),
      h('p', {}, ex.summary),
      h('ol', { class: 'how' }, ...ex.how.map((s) => h('li', {}, s))),
      !store.profile.zone && pitched ? h('p', { class: 'note-warn' }, 'Tip: run Find My Zone first so exercises start on the right notes for your voice.') : null,
      pitched ? h('div', { class: 'row' }, 'Starting note:', h('button', { class: 'btn small', onclick: () => shift(-1) }, '−'), baseLabel, h('button', { class: 'btn small', onclick: () => shift(1) }, '+')) : null,
      budgetGone ? h('p', { class: 'note-warn' }, 'You\'ve used today\'s extreme-vocals budget. Your voice will thank you for resting — but it\'s your call.') : null,
      h('button', { class: 'btn primary big', onclick: () => void run() }, budgetGone ? 'Do it anyway' : '▶ Start'),
      ex.listenFirst && pitched ? h('p', { class: 'muted' }, 'You\'ll hear the pattern first, then a high beep means "your turn".') : h('p', { class: 'muted' }, 'High beep = go. Low beep = rest.'),
    );
  };

  const run = async () => {
    const cue = h('div', { class: 'cue' }, 'Get ready…');
    const live = h('div', { class: 'live-note' }, '--');
    const badge = h('span', { class: 'mode-badge' }, '—');
    const bar = h('div', { class: 'progress-fill' });
    const canvas = h('canvas', { class: 'roll' });
    clear(root,
      h('div', { class: 'player-head' },
        h('button', { class: 'btn ghost small', onclick: intro }, '■ Stop'),
        h('strong', {}, ex.name),
      ),
      cue,
      h('div', { class: 'row spread' }, live, badge),
      h('div', { class: 'progress' }, bar),
      canvas,
    );
    roll = new Roll(canvas, () => engine.now());
    roll.zone = store.profile.zone ?? null;
    roll.windowSec = 6;
    roll.start();

    runner = new Runner(ex, {
      onTarget: (tg, tl) => {
        roll!.activeTarget = tg;
        roll!.setTargets(tl.targets);
        if (!tg) { cue.textContent = 'Get ready…'; return; }
        if (tg.phase === 'listen') cue.textContent = '👂 Listen…';
        else if (tg.step.rest) cue.textContent = tg.step.cue ?? 'Rest';
        else if (tg.step.midi !== undefined) cue.textContent = `${tg.step.cue ? tg.step.cue + ' · ' : '🎤 Sing '}${midiToName(tg.step.midi)}`;
        else cue.textContent = tg.step.cue ?? 'Go';
        cue.dataset.mode = tg.step.modes?.[0] ?? '';
      },
      onFrame: (f) => {
        roll!.push(f.t, f.midi, f.mode);
        live.textContent = f.note ?? (f.mode === 'silence' ? '--' : MODE_LABELS[f.mode]);
        badge.textContent = MODE_LABELS[f.mode];
        badge.style.background = f.mode === 'silence' ? '' : MODE_COLORS[f.mode];
        const tl = runner!.timeline;
        const start = tl.targets[0]?.start ?? 0;
        bar.style.width = `${Math.max(0, Math.min(100, ((f.t - start) / (tl.end - start)) * 100))}%`;
      },
      onDone: (result) => done(result),
    }, pitched ? base : undefined);
    try {
      await runner.start();
    } catch {
      toast('Could not start the microphone.', 'warn');
      intro();
    }
  };

  const done = (result: Result) => {
    teardown();
    const best = store.best(ex.id);
    clear(root,
      h('div', { class: 'player-head' },
        h('button', { class: 'btn ghost small', onclick: opts.onBack }, '← Back'),
        h('strong', {}, ex.name),
      ),
      resultView(result),
      best !== null ? h('p', { class: 'muted center' }, `Personal best: ${best}%`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => void run() }, '↻ Again'),
        opts.onNext ? h('button', { class: 'btn primary', onclick: opts.onNext }, 'Next →') : null,
      ),
    );
  };

  intro();
  return { el: root, destroy: teardown };
}
