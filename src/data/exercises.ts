// The exercise library. Every pitched exercise is written relative to a base note and
// transposed into your measured zone, so it always sits where your voice actually lives.

import type { VocalMode } from '../lib/voice';

export interface Step {
  dur: number; // seconds
  midi?: number; // target note (absolute, filled in by build())
  midiEnd?: number; // for glides
  modes?: VocalMode[]; // required vocal mode(s)
  quiet?: boolean; // should stay well under the loudness limit (fry)
  anyOctave?: boolean; // distorted tones may read an octave off; accept the right note in any octave
  cue?: string; // what to show/say while this step runs
  rest?: boolean;
}

export type Category = 'warmup' | 'pitch' | 'power' | 'extreme' | 'cooldown';
export type Anchor = 'zoneLow' | 'zoneMid' | 'zoneHigh' | 'rangeHigh';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  summary: string;
  how: string[];
  spoken: string; // short Drive Mode instruction
  anchor: Anchor;
  offset?: number; // semitones from the anchor
  reps: number;
  ascend: number; // semitones to move up each rep
  listenFirst: boolean; // play the pattern before you sing it
  extreme?: boolean; // counts toward the daily extreme budget
  drive: boolean; // safe to do hands-free while driving
  build(base: number): Step[];
}

const notes = (base: number, intervals: number[], dur: number, last = dur, extra: Partial<Step> = {}): Step[] =>
  intervals.map((iv, i) => ({ dur: i === intervals.length - 1 ? last : dur, midi: base + iv, ...extra }));

const CLEAN: VocalMode[] = ['clean'];
const GRIT: VocalMode[] = ['grit'];
const SCREAMISH: VocalMode[] = ['scream', 'grit'];

export const EXERCISES: Exercise[] = [
  // ---------- Warm-up ----------
  {
    id: 'siren',
    name: 'Lip-trill siren',
    category: 'warmup',
    summary: 'Wake the voice up with a smooth slide up an octave and back down.',
    how: [
      'Lips loose, blow a "brrr" (or hum on "ng" if trills are hard).',
      'Slide smoothly — no bumps or gear changes.',
      'Keep it easy and quiet; this is about connection, not power.',
    ],
    spoken: 'Lip trill siren. Slide up an octave and back down. Keep it light.',
    anchor: 'zoneLow',
    reps: 2,
    ascend: 2,
    listenFirst: true,
    drive: true,
    build: (b) => [
      { dur: 2.5, midi: b, midiEnd: b + 12, cue: 'Slide up' },
      { dur: 2.5, midi: b + 12, midiEnd: b, cue: 'Slide down' },
    ],
  },
  {
    id: 'five-tone',
    name: 'Five-tone scale',
    category: 'warmup',
    summary: '1-2-3-4-5-4-3-2-1 on "mah". The bread and butter of every vocal warm-up.',
    how: ['Sing "mah" with a relaxed jaw.', 'Aim for the middle of each note — watch the cents meter.', 'Keep the same tone on the way up and the way down.'],
    spoken: 'Five tone scale on mah. Listen, then sing it back.',
    anchor: 'zoneLow',
    reps: 4,
    ascend: 1,
    listenFirst: true,
    drive: true,
    build: (b) => notes(b, [0, 2, 4, 5, 7, 5, 4, 2, 0], 0.5, 1),
  },

  // ---------- Pitch ----------
  {
    id: 'sustain',
    name: 'Sustain & center',
    category: 'pitch',
    summary: 'Hold one note dead-center for four seconds. Builds pitch control and breath support.',
    how: ['Breathe low (belly/ribs expand, shoulders stay still).', 'Start the note cleanly, no scoop.', 'Keep the cents meter inside the green zone the whole time.'],
    spoken: 'Sustain. Hold the note steady and centered.',
    anchor: 'zoneMid',
    reps: 3,
    ascend: 2,
    listenFirst: true,
    drive: true,
    build: (b) => [{ dur: 4, midi: b, modes: CLEAN }],
  },
  {
    id: 'arpeggio',
    name: 'Major arpeggio',
    category: 'pitch',
    summary: '1-3-5-8-5-3-1. Trains your ear for the big intervals melodies are built on.',
    how: ['Hear each note in your head before you sing it.', 'Don\'t reach up for the top note — let it float.'],
    spoken: 'Major arpeggio. Listen, then sing.',
    anchor: 'zoneLow',
    reps: 4,
    ascend: 1,
    listenFirst: true,
    drive: true,
    build: (b) => notes(b, [0, 4, 7, 12, 7, 4, 0], 0.6, 1.2),
  },
  {
    id: 'octave-leap',
    name: 'Octave leaps',
    category: 'pitch',
    summary: 'Jump an octave and land it in tune — the skill behind every big chorus hook.',
    how: ['Land the top note without sliding into it.', 'Keep the same vowel on both notes.'],
    spoken: 'Octave leaps. Land the top note cleanly.',
    anchor: 'zoneLow',
    reps: 3,
    ascend: 1,
    listenFirst: true,
    drive: true,
    build: (b) => notes(b, [0, 12, 0], 1, 1.2),
  },
  {
    id: 'minor-pent',
    name: 'Minor pentatonic run',
    category: 'pitch',
    summary: 'The scale behind most rock and metal vocal lines, up and back down.',
    how: ['Keep it smooth and connected.', 'Accent the first note of each group lightly.'],
    spoken: 'Minor pentatonic run. Listen, then sing.',
    anchor: 'zoneLow',
    reps: 3,
    ascend: 1,
    listenFirst: true,
    drive: true,
    build: (b) => notes(b, [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0], 0.38, 1),
  },

  // ---------- Power (Freddie) ----------
  {
    id: 'freddie-run',
    name: 'Freddie agility run',
    category: 'power',
    summary: 'Fast, light runs. Freddie\'s speed came from staying light, not pushing.',
    how: ['Sing on "ah" or "ee", lightly — volume kills speed.', 'Each note should still be distinct.', 'If you smear, slow down on the next rep.'],
    spoken: 'Agility run. Keep it light and fast.',
    anchor: 'zoneLow',
    offset: 2,
    reps: 3,
    ascend: 1,
    listenFirst: true,
    drive: true,
    build: (b) => notes(b, [0, 2, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 0], 0.2, 0.8),
  },
  {
    id: 'belt-climb',
    name: 'Belt builder',
    category: 'power',
    summary: 'Short "hey!" belts climbing into the top of your zone. Bright, forward, never shouted.',
    how: [
      'Use a bright, speech-like "hey" or "yeah" — like calling to a friend across the street.',
      'Mouth open, tone forward behind the teeth.',
      'If it gets tight or cracks, stop going higher today.',
    ],
    spoken: 'Belt builder. Short bright hey notes. Don\'t shout.',
    anchor: 'zoneHigh',
    offset: -5,
    reps: 3,
    ascend: 1,
    listenFirst: true,
    drive: true,
    build: (b) => [
      ...notes(b, [0, 4, 7], 1.1, 1.6, { modes: CLEAN }),
      { dur: 1.5, rest: true, cue: 'Breathe' },
    ],
  },
  {
    id: 'head-flip',
    name: 'Head-voice siren',
    category: 'power',
    summary: 'Slide from the top of your zone up into head voice/falsetto and back.',
    how: ['Let the voice flip if it wants to — that\'s fine.', 'Over time, aim to make the flip smoother and quieter.'],
    spoken: 'Head voice siren. Slide up and let it flip.',
    anchor: 'zoneHigh',
    reps: 2,
    ascend: 1,
    listenFirst: true,
    drive: true,
    build: (b) => [
      { dur: 2.5, midi: b - 2, midiEnd: b + 7, cue: 'Up into head voice' },
      { dur: 2.5, midi: b + 7, midiEnd: b - 2, cue: 'Back down' },
    ],
  },

  // ---------- Extreme ----------
  {
    id: 'fry-hold',
    name: 'Vocal fry hold',
    category: 'extreme',
    summary: 'The foundation of almost every safe scream: a relaxed, quiet, crackly fry.',
    how: [
      'Make a lazy, creaky "uhhh" like a door slowly opening.',
      'It should be QUIET and effortless — almost no air.',
      'If your throat feels tight or scratchy, you\'re pushing. Back off.',
    ],
    spoken: 'Vocal fry. Quiet, relaxed creak, like a slowly opening door.',
    anchor: 'zoneLow',
    reps: 3,
    ascend: 0,
    listenFirst: false,
    drive: true,
    build: () => [
      { dur: 5, modes: ['fry'], quiet: true, cue: 'Fry — quiet & relaxed' },
      { dur: 3, rest: true, cue: 'Rest' },
    ],
  },
  {
    id: 'fry-to-clean',
    name: 'Fry → clean onset',
    category: 'extreme',
    summary: 'Start in fry and bloom into a clean note. Teaches gentle, connected onsets.',
    how: ['Start with a quiet fry.', 'Without stopping, let it open into a clean note.', 'The transition should be smooth, not a jolt.'],
    spoken: 'Fry into clean. Start in fry, then open into the note.',
    anchor: 'zoneLow',
    offset: 2,
    reps: 3,
    ascend: 2,
    listenFirst: true,
    drive: true,
    build: (b) => [
      { dur: 2, modes: ['fry'], quiet: true, cue: 'Fry' },
      { dur: 2.5, midi: b, modes: CLEAN, cue: 'Open to clean' },
      { dur: 2, rest: true, cue: 'Rest' },
    ],
  },
  {
    id: 'grit-sustain',
    name: 'Grit on pitch (Chester)',
    category: 'extreme',
    summary: 'Add a layer of rasp over a supported, in-tune note — the core of Chester\'s sound.',
    how: [
      'Start with a clean, supported note.',
      'Add a little fry "rattle" on top — like a growly laugh — while the note keeps sounding.',
      'The pitch should still be there. If it turns into pure noise, back off.',
      'Distortion comes from air and placement, NOT from squeezing or volume.',
    ],
    spoken: 'Grit on pitch. Keep the note, add a light rasp on top.',
    anchor: 'zoneMid',
    reps: 3,
    ascend: 1,
    listenFirst: true,
    extreme: true,
    drive: true,
    build: (b) => [
      { dur: 3, midi: b, modes: GRIT, anyOctave: true, cue: 'Gritty note' },
      { dur: 2.5, rest: true, cue: 'Rest' },
    ],
  },
  {
    id: 'clean-dirty-switch',
    name: 'Clean ↔ grit switch',
    category: 'extreme',
    summary: 'Flip between clean and gritty on the same note without losing pitch.',
    how: ['Same note, same vowel, same support.', 'Only the "rattle" changes.', 'Aim for instant switches with no gap.'],
    spoken: 'Clean grit switch. Same note, flip between clean and gritty.',
    anchor: 'zoneMid',
    reps: 2,
    ascend: 1,
    listenFirst: true,
    extreme: true,
    drive: true,
    build: (b) => [
      { dur: 2, midi: b, modes: CLEAN, cue: 'Clean' },
      { dur: 2, midi: b, modes: GRIT, anyOctave: true, cue: 'Grit' },
      { dur: 2, midi: b, modes: CLEAN, cue: 'Clean' },
      { dur: 2, midi: b, modes: GRIT, anyOctave: true, cue: 'Grit' },
      { dur: 2.5, rest: true, cue: 'Rest' },
    ],
  },
  {
    id: 'fry-scream',
    name: 'Fry scream build',
    category: 'extreme',
    summary: 'Grow a fry into a scream by adding air and placement — not throat squeeze.',
    how: [
      'Start in a quiet fry.',
      'Gradually add air and open the mouth wide — the fry gets bigger and brighter.',
      'Keep the throat feeling open (like the start of a yawn).',
      'Stop immediately if it hurts, tickles hard, or makes you cough.',
    ],
    spoken: 'Fry scream build.',
    anchor: 'zoneMid',
    reps: 3,
    ascend: 0,
    listenFirst: false,
    extreme: true,
    drive: false,
    build: () => [
      { dur: 2, modes: ['fry'], quiet: true, cue: 'Fry' },
      { dur: 2.5, modes: SCREAMISH, cue: 'Add air → scream' },
      { dur: 3, rest: true, cue: 'Rest' },
    ],
  },
  {
    id: 'growl',
    name: 'Low guttural',
    category: 'extreme',
    summary: 'A dark, low growl from an open throat and lots of air.',
    how: [
      'Think "dark vowel" — "oh" or "uh" with a low tongue and open throat.',
      'The rumble comes from air through a relaxed fry, not from pushing down on the larynx.',
      'Short bursts only. Rest between them.',
    ],
    spoken: 'Low guttural.',
    anchor: 'zoneLow',
    reps: 3,
    ascend: 0,
    listenFirst: false,
    extreme: true,
    drive: false,
    build: () => [
      { dur: 2.5, modes: ['growl'], cue: 'Growl' },
      { dur: 3, rest: true, cue: 'Rest' },
    ],
  },
  {
    id: 'metal-blend',
    name: 'Full metal blend',
    category: 'extreme',
    summary: 'Clean → grit → scream → fry release on one phrase. The whole toolbox in one go.',
    how: ['Clean, supported note.', 'Add grit on the same note.', 'Open up into a full scream.', 'Release back down into a quiet fry.'],
    spoken: 'Full metal blend.',
    anchor: 'zoneMid',
    reps: 2,
    ascend: 1,
    listenFirst: true,
    extreme: true,
    drive: false,
    build: (b) => [
      { dur: 2, midi: b, modes: CLEAN, cue: 'Clean' },
      { dur: 2, midi: b, modes: GRIT, anyOctave: true, cue: 'Grit' },
      { dur: 2, modes: SCREAMISH, cue: 'Scream' },
      { dur: 2, modes: ['fry'], quiet: true, cue: 'Fry release' },
      { dur: 3, rest: true, cue: 'Rest' },
    ],
  },

  // ---------- Cool-down ----------
  {
    id: 'cooldown',
    name: 'Cool-down hum',
    category: 'cooldown',
    summary: 'Gentle descending hums to settle the voice after hard work.',
    how: ['Lips closed, teeth apart, hum on "mmm".', 'Feel the buzz on your lips and nose.', 'Quieter than you think.'],
    spoken: 'Cool down. Gentle hum, sliding down.',
    anchor: 'zoneMid',
    reps: 2,
    ascend: -2,
    listenFirst: true,
    drive: true,
    build: (b) => [{ dur: 4, midi: b + 4, midiEnd: b - 5, cue: 'Hum down' }],
  },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  warmup: 'Warm-up',
  pitch: 'Pitch & ear',
  power: 'Power & range (Freddie)',
  extreme: 'Extreme vocals',
  cooldown: 'Cool-down',
};

export const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;

export const WORKOUTS = {
  daily: ['siren', 'five-tone', 'sustain', 'arpeggio', 'freddie-run', 'belt-climb', 'fry-hold', 'fry-to-clean',
    'grit-sustain', 'clean-dirty-switch', 'fry-scream', 'cooldown'],
  drive: EXERCISES.filter((e) => e.drive).map((e) => e.id),
};
