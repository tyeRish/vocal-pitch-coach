// Extreme Lab: calibrate the mode detector to your voice, watch your mode live,
// and train fry, grit, screams and gutturals within a daily budget.

import { engine, type Frame } from '../audio/engine';
import { store } from '../data/store';
import { MODE_LABELS, type VocalMode } from '../lib/voice';
import { percentile } from '../lib/zone';
import { extremeBudgetLeft } from '../session';
import { clear, fmtMin, h, toast } from '../ui/dom';
import { MODE_COLORS } from '../ui/roll';
import { byId } from '../data/exercises';
import { exercisePlayer, micButton, startMic } from './shared';
import { exerciseList } from './train';

const median = (xs: number[]) => percentile([...xs].sort((a, b) => a - b), 0.5);
const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function collect(seconds: number, onTick: (left: number) => void): Promise<Frame[]> {
  return new Promise((resolve) => {
    const frames: Frame[] = [];
    const start = engine.now();
    const off = engine.onFrame((f) => {
      frames.push(f);
      onTick(Math.max(0, seconds - (f.t - start)));
      if (f.t - start >= seconds) { off(); resolve(frames); }
    });
  });
}

export function mountLab(root: HTMLElement) {
  const view = h('section', { class: 'view lab' });
  root.append(view);
  let destroy: (() => void) | null = null;
  let offFrame: (() => void) | null = null;

  const calibrate = async (status: HTMLElement) => {
    if (!(await startMic())) return;
    status.textContent = 'Stay quiet… 3';
    const quiet = await collect(3, (l) => { status.textContent = `🤫 Stay quiet… ${Math.ceil(l)}`; });
    const noiseDb = clampTo(percentile(quiet.map((f) => f.db).sort((a, b) => a - b), 0.9), -90, -25);
    store.updateCalibration({ noiseDb });

    const clean = await collect(4, (l) => { status.textContent = `🎵 Sing a clean, easy "ahh"… ${Math.ceil(l)}`; });
    const voiced = clean.filter((f) => f.freq !== null && f.db > noiseDb + 10);
    if (voiced.length < 30) {
      status.textContent = 'Didn\'t hear enough clean voice. Try again a little louder or closer to the mic.';
      return;
    }
    const clarity = median(voiced.map((f) => f.clarity));
    if (clarity < 0.6) {
      status.textContent = 'That sounded noisy or airy. Try again with a pure, relaxed tone.';
      return;
    }
    const hnrs = voiced.map((f) => f.hnr).filter((x) => isFinite(x));
    store.updateCalibration({
      cleanClarity: clampTo(clarity, 0.7, 0.99),
      cleanFlatness: clampTo(median(voiced.map((f) => f.flatness)), 0.01, 0.3),
      cleanHnr: hnrs.length > 10 ? clampTo(median(hnrs), 10, 45) : store.profile.calibration.cleanHnr,
    });
    status.textContent = `✅ Calibrated. Noise floor ${noiseDb.toFixed(0)} dB, clean clarity ${(clarity * 100).toFixed(0)}%.`;
    toast('Calibrated to your voice.');
  };

  const home = () => {
    destroy?.();
    destroy = null;
    offFrame?.();

    const used = store.today.extremeSec;
    const budget = store.settings.extremeBudgetMin * 60;
    const calStatus = h('p', { class: 'muted' }, 'Do this once per room/car/mic. Takes 7 seconds.');

    const bigMode = h('div', { class: 'big-mode' }, '—');
    const dist = h('div', { class: 'meter-fill dist' });
    const timeline = h('div', { class: 'mode-timeline' });
    const counts: Partial<Record<VocalMode, number>> = {};
    const tally = h('div', { class: 'tally' });

    let tick = 0;
    offFrame = engine.onFrame((f) => {
      bigMode.textContent = MODE_LABELS[f.mode];
      bigMode.style.color = f.mode === 'silence' ? '' : MODE_COLORS[f.mode];
      dist.style.width = `${Math.round(f.distortion * 100)}%`;
      if (f.mode !== 'silence') counts[f.mode] = (counts[f.mode] ?? 0) + 1;
      if (++tick % 4 === 0) {
        const seg = h('i', { style: `background:${MODE_COLORS[f.mode]}` });
        timeline.append(seg);
        while (timeline.childElementCount > 120) timeline.firstElementChild!.remove();
        const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
        clear(tally, ...(Object.keys(counts) as VocalMode[]).map((m) =>
          h('span', { style: `color:${MODE_COLORS[m]}` }, `${MODE_LABELS[m]} ${Math.round((100 * counts[m]!) / total)}%`)));
      }
    });

    clear(view,
      h('div', { class: 'card' },
        h('h2', {}, 'Extreme Lab'),
        h('p', {}, 'Fry is the foundation. Grit is fry layered over a real note. Screams are fry plus air and space. None of it should hurt.'),
        h('div', { class: 'budget' },
          h('div', { class: 'row spread' }, h('span', {}, 'Today\'s extreme time'), h('strong', {}, `${fmtMin(used)} / ${store.settings.extremeBudgetMin} min`)),
          h('div', { class: 'meter-track' }, h('div', { class: `meter-fill ${used >= budget ? 'over' : 'dist'}`, style: `width:${Math.min(100, (used / budget) * 100)}%` })),
        ),
        extremeBudgetLeft() <= 0 ? h('p', { class: 'note-warn' }, 'Budget used. Clean singing, fry and rest from here.') : null,
      ),
      h('div', { class: 'card' },
        h('h3', {}, '1 · Calibrate to your voice'),
        calStatus,
        h('button', { class: 'btn primary', onclick: () => void calibrate(calStatus) }, 'Calibrate'),
      ),
      h('div', { class: 'card' },
        h('h3', {}, '2 · Mode meter'),
        h('p', { class: 'muted' }, 'Free-play: try fry, add grit, open into a scream. Watch what the meter hears.'),
        bigMode,
        h('div', { class: 'meter' }, h('span', {}, 'Distortion'), h('div', { class: 'meter-track' }, dist)),
        timeline,
        tally,
        micButton(),
      ),
      h('div', { class: 'card' },
        h('h3', {}, 'Full extreme routine'),
        h('p', { class: 'muted' }, 'Fry → fry-to-clean → grit → switch → fry scream → growl → blend.'),
        h('button', { class: 'btn primary', onclick: () => play(['fry-hold', 'fry-to-clean', 'grit-sustain', 'clean-dirty-switch', 'fry-scream', 'growl', 'metal-blend', 'cooldown'], 0) }, '▶ Start routine'),
      ),
      ...exerciseList(['extreme'], (ex) => play([ex.id], 0)),
      h('div', { class: 'card safety' },
        h('h3', {}, 'Hard rules'),
        h('ul', {},
          h('li', {}, 'Pain, burning, or a tickle that makes you cough = stop for the day.'),
          h('li', {}, 'Hoarse the next morning = you pushed too hard. Rest a day, go lighter next time.'),
          h('li', {}, 'Hoarseness lasting more than 2 weeks: see an ENT / laryngologist.'),
          h('li', {}, 'Warm up first, drink water, and keep sessions short. Volume is not the goal.'),
          h('li', {}, 'This app hears your sound, not your throat. A good extreme-vocals coach is worth it.'),
        ),
      ),
    );
  };

  const play = (ids: string[], i: number) => {
    offFrame?.();
    offFrame = null;
    destroy?.();
    const p = exercisePlayer(byId(ids[i]), { onBack: home, onNext: i + 1 < ids.length ? () => play(ids, i + 1) : undefined });
    destroy = p.destroy;
    clear(view, p.el);
  };

  home();
  return () => { destroy?.(); offFrame?.(); };
}
