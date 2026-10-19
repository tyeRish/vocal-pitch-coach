// Progress, settings and the technique guide.

import { speech } from '../audio/speech';
import { store, type Settings } from '../data/store';
import { EXERCISES } from '../data/exercises';
import { midiToName } from '../lib/music';
import { clear, fmtMin, h, toast } from '../ui/dom';

const GUIDE: { title: string; body: string[] }[] = [
  {
    title: 'Breath & support — the engine for everything',
    body: [
      'Breathe low: belly and lower ribs expand, shoulders stay still.',
      'While singing, keep the ribs gently open instead of collapsing — that steady pressure is "support".',
      'Every extreme technique runs on support. Without it, you squeeze the throat to compensate — that\'s what causes damage.',
    ],
  },
  {
    title: 'Vocal fry',
    body: [
      'The creaky sound at the very bottom of your voice, like a slowly opening door.',
      'Very little air, very little volume, completely relaxed. It should feel like nothing.',
      'Fry is the raw material for most safe screams. Master a relaxed fry before anything else.',
    ],
  },
  {
    title: 'Grit / rasp (Chester-style sing-scream)',
    body: [
      'A clean, supported note with a layer of fry-like rattle on top. The pitch stays audible.',
      'Find it by adding a little fry to a sung "ah", or by doing a gravelly "growly laugh" on pitch.',
      'The distortion lives above the vocal folds (false folds / the space around them) — the true folds keep making the note.',
      'If the note disappears into pure noise, or it feels scratchy, back off the volume and the squeeze.',
    ],
  },
  {
    title: 'Fry screams / false-cord screams',
    body: [
      'Start from a quiet fry, then add air and open the mouth and throat (think start of a yawn).',
      'Volume comes from the mic, not from your throat. Practice at moderate volume.',
      'Highs: brighter vowel (eh, ee), more forward. Mids: "ah". Keep it short — 2–3 seconds — and rest.',
    ],
  },
  {
    title: 'Gutturals & lows',
    body: [
      'Dark vowel ("oh", "uh"), low tongue, wide-open throat.',
      'The rumble is air through a relaxed fry — never press the larynx down with force.',
      'Gutturals use a lot of air. Short bursts, frequent rests.',
    ],
  },
  {
    title: 'Belting & mix (Freddie-style power)',
    body: [
      'Bright, speech-like, forward tone — like calling "hey!" across a street, not yelling.',
      'As you go up, keep the vowel a little narrower (ah → uh, ee → ih) and don\'t lift the chin.',
      'Freddie\'s agility came from staying light. Build speed quietly, then add power.',
      'Range grows a semitone at a time over months. Pushing for notes you don\'t have yet sets you back.',
    ],
  },
  {
    title: 'How to use this app to get there',
    body: [
      '1. Run Find My Zone, then Calibrate in the Lab.',
      '2. Daily workout most days (12 min). Extreme work only after warming up.',
      '3. Use the Song key fitter to put songs where your voice shines, then move them up as your range grows.',
      '4. Re-test your range every few weeks — the Progress tab tracks it.',
      '5. Record yourself singing real songs, too. Scores are a guide; your ears are the judge.',
    ],
  },
  {
    title: 'Warning signs — stop and rest',
    body: [
      'Pain, burning or a raw feeling. Persistent tickle or coughing. Voice cracking more than usual.',
      'Hoarseness the next day means you overdid it — rest, then go lighter.',
      'Hoarseness or voice changes lasting more than 2 weeks: see an ENT / laryngologist.',
      'An in-person extreme-vocals coach can see and feel things no app can. Even a few lessons help a lot.',
    ],
  },
];

function progress() {
  const days = store.days.slice(-14);
  const maxSec = Math.max(60, ...days.map((d) => d.practiceSec));
  const total = store.days.reduce((s, d) => s + d.practiceSec, 0);
  const ranges = store.ranges;
  return h('div', {},
    h('div', { class: 'card' },
      h('h2', {}, 'Progress'),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat hl' }, h('small', {}, 'Streak'), h('strong', {}, `${store.streak()} 🔥`), h('small', {}, 'days')),
        h('div', { class: 'stat' }, h('small', {}, 'Today'), h('strong', {}, fmtMin(store.today.practiceSec)), h('small', {}, 'voice time')),
        h('div', { class: 'stat' }, h('small', {}, 'Extreme today'), h('strong', {}, fmtMin(store.today.extremeSec)), h('small', {}, `of ${store.settings.extremeBudgetMin} min`)),
        h('div', { class: 'stat' }, h('small', {}, 'All time'), h('strong', {}, fmtMin(total))),
      ),
      days.length ? h('div', { class: 'bars' }, ...days.map((d) => h('div', { class: 'bar-col', title: `${d.date}: ${fmtMin(d.practiceSec)}` },
        h('div', { class: 'bar', style: `height:${(d.practiceSec / maxSec) * 100}%` }),
        h('small', {}, d.date.slice(8))))) : h('p', { class: 'muted' }, 'No sessions yet. Your practice shows up here.'),
    ),
    ranges.length ? h('div', { class: 'card' },
      h('h3', {}, 'Range over time'),
      h('ul', { class: 'plain' }, ...ranges.slice(-8).reverse().map((r) =>
        h('li', {}, `${r.date}: ${midiToName(r.low)}–${midiToName(r.high)} (${r.high - r.low} semitones)`))),
    ) : null,
    h('div', { class: 'card' },
      h('h3', {}, 'Personal bests'),
      h('ul', { class: 'plain' }, ...EXERCISES.map((e) => ({ e, best: store.best(e.id) })).filter((x) => x.best !== null)
        .map(({ e, best }) => h('li', { class: 'row spread' }, h('span', {}, e.name), h('strong', {}, `${best}%`)))),
    ),
  );
}

function settings() {
  const s = store.settings;
  const set = (patch: Partial<Settings>) => { store.updateSettings(patch); toast('Saved'); };
  const select = <T extends string>(value: T, options: [T, string][], onChange: (v: T) => void) => {
    const el = h('select', {}, ...options.map(([v, label]) => h('option', { value: v, selected: v === value || undefined }, label)));
    el.addEventListener('change', () => onChange(el.value as T));
    return el;
  };
  const check = (value: boolean, onChange: (v: boolean) => void) => {
    const el = h('input', { type: 'checkbox', checked: value });
    el.addEventListener('change', () => onChange(el.checked));
    return el;
  };
  const num = (value: number, min: number, max: number, onChange: (v: number) => void) => {
    const el = h('input', { type: 'number', value: String(value), min: String(min), max: String(max) });
    el.addEventListener('change', () => onChange(Math.max(min, Math.min(max, Number(el.value)))));
    return el;
  };
  return h('div', { class: 'card settings' },
    h('h2', {}, 'Settings'),
    h('label', {}, h('span', {}, 'Pitch difficulty'), select(s.difficulty, [['easy', 'Easy (±50¢)'], ['normal', 'Normal (±30¢)'], ['hard', 'Hard (±18¢)']], (v) => set({ difficulty: v }))),
    h('label', {}, h('span', {}, 'Guide tone while singing (headphones!)'), check(s.guideTone, (v) => set({ guideTone: v }))),
    h('label', {}, h('span', {}, 'Spoken cues in Drive Mode'), check(s.voiceCues, (v) => { set({ voiceCues: v }); speech.setEnabled(v); })),
    h('label', {}, h('span', {}, 'Daily extreme budget (minutes)'), num(s.extremeBudgetMin, 1, 60, (v) => set({ extremeBudgetMin: v }))),
    h('label', {}, h('span', {}, 'Loudness warning level (dBFS)'), num(s.loudLimitDb, -40, 0, (v) => set({ loudLimitDb: v }))),
    h('p', { class: 'muted' }, 'Start with 5–10 minutes of extreme work per day. Lower the loudness level if the warning never shows up while you\'re clearly pushing.'),
    h('button', { class: 'btn danger', onclick: () => { if (confirm('Erase your range, calibration, scores and history on this device?')) { store.reset(); toast('All data erased'); } } }, 'Reset all data'),
  );
}

function guide() {
  return h('div', {},
    ...GUIDE.map((g, i) => h('details', { class: 'card guide', open: i === 0 || undefined },
      h('summary', {}, g.title),
      h('ul', {}, ...g.body.map((b) => h('li', {}, b))),
    )),
  );
}

export function mountMore(root: HTMLElement) {
  const body = h('div', {});
  const tabs: [string, () => HTMLElement][] = [['Progress', progress], ['Guide', guide], ['Settings', settings]];
  const bar = h('div', { class: 'subtabs' });
  const show = (i: number) => {
    bar.querySelectorAll('button').forEach((b, j) => b.classList.toggle('active', i === j));
    clear(body, tabs[i][1]());
  };
  tabs.forEach(([label], i) => bar.append(h('button', { onclick: () => show(i) }, label)));
  root.append(h('section', { class: 'view more' }, bar, body));
  show(0);
  return () => {};
}
