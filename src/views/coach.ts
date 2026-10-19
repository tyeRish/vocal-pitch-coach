// Live Coach: real-time note, cents, vocal mode, distortion, key and pitch roll.

import { engine } from '../audio/engine';
import { tone } from '../audio/tone';
import { store } from '../data/store';
import { REFERENCES } from '../data/references';
import { detectKey, midiToName, pitchClass, scalePcs } from '../lib/music';
import { MODE_LABELS } from '../lib/voice';
import { TOLERANCE } from '../training/runner';
import { h } from '../ui/dom';
import { Roll, MODE_COLORS } from '../ui/roll';
import { micButton } from './shared';

const BAND_COLORS: Record<string, string> = { freddie: '#facc15', chester: '#f87171' };

export function mountCoach(root: HTMLElement) {
  const note = h('div', { class: 'note-big' }, '--');
  const cents = h('div', { class: 'cents' }, 'Sing any note');
  const needle = h('div', { class: 'needle' });
  const tol = TOLERANCE[store.settings.difficulty];
  const gauge = h('div', { class: 'gauge' },
    h('div', { class: 'gauge-zone', style: `left:${50 - tol}%;width:${tol * 2}%` }),
    h('div', { class: 'gauge-mid' }),
    needle,
    h('span', { class: 'gauge-label left' }, '♭ flat'),
    h('span', { class: 'gauge-label right' }, 'sharp ♯'),
  );
  const modeBadge = h('span', { class: 'mode-badge' }, '—');
  const keyChip = h('span', { class: 'chip' }, 'Key: listening…');
  const distFill = h('div', { class: 'meter-fill dist' });
  const levelFill = h('div', { class: 'meter-fill level' });
  const stabFill = h('div', { class: 'meter-fill stab' });
  const meter = (label: string, fill: HTMLElement) => h('div', { class: 'meter' }, h('span', {}, label), h('div', { class: 'meter-track' }, fill));

  const canvas = h('canvas', { class: 'roll' });
  const roll = new Roll(canvas, () => engine.now());
  roll.zone = store.profile.zone ?? null;
  roll.start();

  const legend = h('div', { class: 'legend' },
    ...(['clean', 'fry', 'grit', 'scream', 'growl'] as const).map((m) =>
      h('span', {}, h('i', { style: `background:${MODE_COLORS[m]}` }), MODE_LABELS[m])),
    store.profile.zone ? h('span', {}, h('i', { style: 'background:rgba(16,185,129,.5)' }), 'Your zone') : null,
  );

  // Drone: a sustained tonic to sing against — the fastest way to train your ear in a key.
  const droneDefault = store.profile.zone?.low ?? 48;
  const droneSel = h('select', { 'aria-label': 'Drone note' },
    ...Array.from({ length: 25 }, (_, i) => droneDefault - 7 + i).map((m) => h('option', { value: String(m), selected: m === droneDefault || undefined }, midiToName(m))));
  let droneOn = false;
  const droneBtn = h('button', { class: 'btn small', onclick: () => {
    droneOn = !droneOn;
    if (droneOn) tone.startDrone(Number(droneSel.value)); else tone.stopDrone();
    droneBtn.textContent = droneOn ? '■ Stop drone' : '▶ Play drone';
  } }, '▶ Play drone');
  droneSel.addEventListener('change', () => { if (droneOn) tone.startDrone(Number(droneSel.value)); });

  const refToggles = REFERENCES.map((r) => {
    const cb = h('input', { type: 'checkbox' });
    cb.addEventListener('change', () => {
      roll.bands = REFERENCES.filter((_, i) => (refToggles[i].querySelector('input') as HTMLInputElement).checked)
        .map((x) => ({ range: x.zone, label: x.name, color: BAND_COLORS[x.id] }));
    });
    return h('label', { class: 'check' }, cb, h('i', { style: `background:${BAND_COLORS[r.id]}` }), `${r.name.split(' ')[0]}'s zone`);
  });

  root.append(
    h('section', { class: 'view coach' },
      h('div', { class: 'card readout' },
        h('div', { class: 'readout-top' }, modeBadge, keyChip),
        note, cents, gauge,
        h('div', { class: 'meters' }, meter('Distortion', distFill), meter('Level', levelFill), meter('Stability', stabFill)),
      ),
      micButton(),
      h('div', { class: 'card roll-card' }, canvas, legend),
      h('div', { class: 'card tools' },
        h('div', { class: 'row' }, h('strong', {}, 'Drone'), droneSel, droneBtn),
        h('p', { class: 'muted' }, 'Hold a drone, then sing notes of its key against it. You\'ll hear yourself lock in.'),
        h('div', { class: 'row wrap' }, ...refToggles),
      ),
    ),
  );

  // Rolling key detection (time-weighted, slowly forgetting).
  const hist = new Array(12).fill(0);
  const recent: number[] = [];
  let lastT = 0;
  let lastKeyUpdate = 0;

  const off = engine.onFrame((f) => {
    const dt = lastT ? Math.min(0.1, f.t - lastT) : 0;
    lastT = f.t;
    roll.push(f.t, f.midi, f.mode);

    modeBadge.textContent = MODE_LABELS[f.mode];
    modeBadge.style.background = f.mode === 'silence' ? '' : MODE_COLORS[f.mode];
    distFill.style.width = `${Math.round(f.distortion * 100)}%`;
    levelFill.style.width = `${Math.max(0, Math.min(100, (f.db + 60) * (100 / 60)))}%`;

    if (f.midi !== null && f.note) {
      note.textContent = f.note;
      const c = Math.round(f.cents);
      cents.textContent = `${c > 0 ? '+' : ''}${c}¢ · ${f.freq!.toFixed(1)} Hz`;
      needle.style.left = `${50 + Math.max(-50, Math.min(50, f.cents))}%`;
      const inTune = Math.abs(f.cents) <= tol;
      note.className = `note-big ${inTune ? 'in' : 'off'}`;
      recent.push(f.midi);
      if (recent.length > 30) recent.shift();
      if (recent.length >= 10) {
        const m = recent.reduce((s, v) => s + v, 0) / recent.length;
        const sd = Math.sqrt(recent.reduce((s, v) => s + (v - m) ** 2, 0) / recent.length) * 100;
        stabFill.style.width = `${Math.max(0, Math.min(100, 100 - sd * 2))}%`;
      }
      if (f.mode === 'clean' || f.mode === 'grit') {
        for (let i = 0; i < 12; i++) hist[i] *= 0.9995;
        hist[pitchClass(f.midi)] += dt;
      }
    } else {
      note.className = 'note-big';
      if (f.mode === 'silence') { note.textContent = '--'; cents.textContent = 'Sing any note'; }
      else if (f.mode !== 'fry') { note.textContent = MODE_LABELS[f.mode]; cents.textContent = 'no clear pitch'; }
      needle.style.left = '50%';
      recent.length = 0;
    }

    if (f.t - lastKeyUpdate > 1) {
      lastKeyUpdate = f.t;
      const total = hist.reduce((s, v) => s + v, 0);
      const best = total > 4 ? detectKey(hist)[0] : null;
      if (best && best.confidence > 0.55) {
        keyChip.textContent = `Key: ${best.name}`;
        roll.keyPcs = scalePcs(best.tonic, best.mode);
      } else {
        keyChip.textContent = total > 4 ? 'Key: unclear' : 'Key: listening…';
        roll.keyPcs = null;
      }
    }
  });

  return () => {
    off();
    roll.destroy();
    tone.stopDrone();
  };
}
