// Find My Zone: a guided 1-minute test, then your range, sweet spot, best keys,
// how you compare to Freddie and Chester, and a song-key fitter.

import { engine } from '../audio/engine';
import { store } from '../data/store';
import { REFERENCES } from '../data/references';
import { freqToMidi, midiToName, recommendKeys, transposeSong, type Range } from '../lib/music';
import { analyzeVoice, type ZoneRecordings } from '../lib/zone';
import { clear, h } from '../ui/dom';
import { Roll } from '../ui/roll';
import { startMic } from './shared';

const FRY_MIDI = freqToMidi(70);

const STEPS: { key: keyof ZoneRecordings; title: string; say: string; secs: number }[] = [
  { key: 'speak', title: 'Speaking voice', say: 'Count from 1 to 10 in your normal speaking voice.', secs: 7 },
  { key: 'low', title: 'Lowest notes', say: 'Start on a comfy note and step DOWN, holding each note for a second. Go as low as you can while it still sounds like a real note (not fry).', secs: 12 },
  { key: 'high', title: 'Highest notes', say: 'Now step UP, holding each note for a second. Use head voice / falsetto at the top — that counts.', secs: 14 },
  { key: 'comfort', title: 'Comfort singing', say: 'Sing any song you know well, at a relaxed volume — Happy Birthday works. Don\'t show off; just sing.', secs: 25 },
];

const AXIS = { low: 36, high: 84 }; // C2–C6

function rangeMap(rows: { label: string; range: Range; zone?: Range; color: string }[]) {
  const pct = (m: number) => ((m - AXIS.low) / (AXIS.high - AXIS.low)) * 100;
  return h('div', { class: 'range-map' },
    h('div', { class: 'axis' }, ...[36, 48, 60, 72, 84].map((m) => h('span', { style: `left:${pct(m)}%` }, midiToName(m)))),
    ...rows.map((r) => h('div', { class: 'range-row' },
      h('span', { class: 'range-label' }, r.label),
      h('div', { class: 'range-track' },
        h('div', { class: 'range-bar', style: `left:${pct(r.range.low)}%;width:${pct(r.range.high) - pct(r.range.low)}%;background:${r.color}` }),
        r.zone ? h('div', { class: 'range-zone', style: `left:${pct(r.zone.low)}%;width:${pct(r.zone.high) - pct(r.zone.low)}%` }) : null,
      ),
    )),
  );
}

const overlapPct = (a: Range, b: Range) =>
  Math.round((100 * Math.max(0, Math.min(a.high, b.high) - Math.max(a.low, b.low))) / Math.max(1, b.high - b.low));

function noteSelect(value: number) {
  return h('select', {}, ...Array.from({ length: AXIS.high - AXIS.low + 1 }, (_, i) => AXIS.low + i)
    .map((m) => h('option', { value: String(m), selected: m === value || undefined }, midiToName(m))));
}

export function mountZone(root: HTMLElement) {
  const view = h('section', { class: 'view zone' });
  root.append(view);
  let cleanup: (() => void) | null = null;

  const results = () => {
    const p = store.profile;
    if (!p.range || !p.zone) return intro();
    const { range, zone } = p;
    const keys = recommendKeys(zone, range).slice(0, 4);
    const octaves = ((range.high - range.low) / 12).toFixed(1);

    const songLow = noteSelect(zone.low), songHigh = noteSelect(zone.high + 5);
    const fit = h('p', { class: 'fit' });
    const updateFit = () => {
      const lo = Number(songLow.value), hi = Number(songHigh.value);
      if (hi <= lo) { fit.textContent = 'Highest note must be above lowest note.'; return; }
      const t = transposeSong({ low: lo, high: hi }, zone, range);
      const dir = t.shift === 0 ? 'Sing it in the original key' : `Shift it ${t.shift > 0 ? 'UP' : 'DOWN'} ${Math.abs(t.shift)} semitone${Math.abs(t.shift) > 1 ? 's' : ''}`;
      fit.textContent = `${dir} → ${midiToName(t.low)}–${midiToName(t.high)}. ${t.fits ? 'Fits your range ✅' : 'Still wider than your current range — expect a stretch at the edges.'}`;
    };
    songLow.addEventListener('change', updateFit);
    songHigh.addEventListener('change', updateFit);
    updateFit();

    clear(view,
      h('div', { class: 'card' },
        h('h2', {}, 'Your voice'),
        h('div', { class: 'stat-grid' },
          h('div', { class: 'stat' }, h('small', {}, 'Range'), h('strong', {}, `${midiToName(range.low)}–${midiToName(range.high)}`), h('small', {}, `${octaves} octaves`)),
          h('div', { class: 'stat hl' }, h('small', {}, 'Sweet spot'), h('strong', {}, `${midiToName(zone.low)}–${midiToName(zone.high)}`), h('small', {}, 'sing most here')),
          h('div', { class: 'stat' }, h('small', {}, 'Voice type (est.)'), h('strong', {}, p.voiceType ?? '—')),
          h('div', { class: 'stat' }, h('small', {}, 'Speaking pitch'), h('strong', {}, p.speakingMidi ? midiToName(p.speakingMidi) : '—')),
        ),
        p.naturalKey ? h('p', {}, `When you sang freely you gravitated to `, h('strong', {}, p.naturalKey), '.') : null,
      ),
      h('div', { class: 'card' },
        h('h3', {}, 'Best keys for your voice'),
        h('p', { class: 'muted' }, 'For a typical rock/metal melody (mostly between the root and the 5th):'),
        h('ol', { class: 'keys' }, ...keys.map((k) => h('li', {},
          h('strong', {}, `${k.name} major / ${midiToName(k.tonicMidi + 9).replace(/\d+$/, '')} minor`),
          h('small', {}, ` — melody sits ${midiToName(k.body.low)}–${midiToName(k.body.high)}`)))),
      ),
      h('div', { class: 'card' },
        h('h3', {}, 'You vs. the legends'),
        rangeMap([
          { label: 'You', range, zone, color: '#22d3ee' },
          ...REFERENCES.map((r) => ({ label: r.name.split(' ')[0], range: r.range, zone: r.zone, color: r.id === 'freddie' ? '#facc15' : '#f87171' })),
        ]),
        ...REFERENCES.map((r) => {
          const gapUp = r.range.high - range.high;
          const overlap = overlapPct(zone, r.zone);
          const where = overlap > 0
            ? `Your sweet spot covers ${overlap}% of where his famous material sits. `
            : `His material sits ${r.zone.low > zone.high ? 'above' : 'below'} your current sweet spot — use the Song key fitter to bring his songs to you. `;
          return h('div', { class: 'ref' },
            h('strong', {}, r.name),
            h('p', {}, where,
              gapUp > 0 ? `His top belt is about ${gapUp} semitone${gapUp > 1 ? 's' : ''} above your current top — Belt builder and head-voice sirens are how you close that gap, a semitone at a time over months.` : 'Your range already reaches his top notes. Now it\'s about power, tone and control there.'),
            h('ul', {}, ...r.notes.map((n) => h('li', {}, n))),
          );
        }),
        h('p', { class: 'muted' }, 'Reference ranges are approximate. The goal is YOUR best version of that sound, in keys that fit you.'),
      ),
      h('div', { class: 'card' },
        h('h3', {}, 'Song key fitter'),
        h('p', { class: 'muted' }, 'Enter a song\'s lowest and highest sung notes:'),
        h('div', { class: 'row' }, 'Low', songLow, 'High', songHigh),
        fit,
      ),
      h('button', { class: 'btn big', onclick: intro }, '↻ Re-test my range'),
    );
  };

  const intro = () => {
    cleanup?.();
    clear(view,
      h('div', { class: 'card hero' },
        h('h2', {}, 'Find My Zone'),
        h('p', {}, 'A 1-minute test that finds your range, your comfortable singing zone, your best octave and the keys that suit you. Every exercise then gets tuned to it.'),
        h('ol', { class: 'how' }, ...STEPS.map((s) => h('li', {}, h('strong', {}, s.title), ` — ${s.secs}s`))),
        h('p', { class: 'muted' }, 'Quiet room, phone about 30 cm from your mouth. Warm up a little first.'),
        h('button', { class: 'btn primary big', onclick: () => void runTest() }, '▶ Start test'),
        store.profile.range ? h('button', { class: 'btn ghost', onclick: results }, 'See my last results') : null,
      ),
    );
  };

  const runTest = async () => {
    if (!(await startMic())) return;
    const rec: ZoneRecordings = { speak: [], low: [], high: [], comfort: [] };
    const title = h('h2', {});
    const say = h('p', { class: 'say' });
    const count = h('div', { class: 'countdown' });
    const live = h('div', { class: 'live-note' }, '--');
    const canvas = h('canvas', { class: 'roll' });
    clear(view, h('div', { class: 'card' }, title, say, h('div', { class: 'row spread' }, live, count), canvas,
      h('button', { class: 'btn ghost', onclick: () => { cleanup?.(); intro(); } }, 'Cancel')));
    const roll = new Roll(canvas, () => engine.now());
    roll.start();

    let stepIdx = -1, stepEnd = 0, cancelled = false;
    const next = () => {
      stepIdx++;
      if (stepIdx >= STEPS.length) return finish();
      const s = STEPS[stepIdx];
      title.textContent = `${stepIdx + 1}/${STEPS.length} · ${s.title}`;
      say.textContent = s.say;
      stepEnd = engine.now() + s.secs + 1;
    };
    const off = engine.onFrame((f) => {
      roll.push(f.t, f.midi, f.mode);
      live.textContent = f.note ?? '--';
      const left = stepEnd - f.t;
      const s = STEPS[stepIdx];
      if (!s) return;
      count.textContent = left > s.secs ? 'Get ready…' : `${Math.ceil(left)}s`;
      if (left <= s.secs) {
        const usable = f.midi !== null && f.midi > FRY_MIDI && (f.mode === 'clean' || (s.key === 'speak' && f.mode !== 'silence'));
        rec[s.key].push(usable ? f.midi : null);
      }
      if (left <= 0) next();
    });
    cleanup = () => { cancelled = true; off(); roll.destroy(); cleanup = null; };

    const finish = () => {
      if (cancelled) return;
      cleanup?.();
      const a = analyzeVoice(rec);
      if (!a) {
        clear(view, h('div', { class: 'card' },
          h('h2', {}, 'Not enough to go on'),
          h('p', {}, 'I couldn\'t hear enough steady notes. Try again a bit louder, closer to the mic, holding each note for a second.'),
          h('button', { class: 'btn primary', onclick: () => void runTest() }, 'Try again')));
        return;
      }
      store.updateProfile({
        range: a.range, zone: a.zone, speakingMidi: a.speakingMidi ?? undefined,
        voiceType: a.voiceType, naturalKey: a.naturalKey ?? undefined, measuredAt: new Date().toISOString(),
      });
      results();
    };
    next();
  };

  if (store.profile.range) results(); else intro();
  return () => cleanup?.();
}
