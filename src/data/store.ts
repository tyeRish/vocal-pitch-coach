// Everything the app remembers about you, kept in this device's localStorage.

import type { Range } from '../lib/music';
import { DEFAULT_CALIBRATION, type Calibration } from '../lib/voice';

export interface Profile {
  range?: Range;
  zone?: Range;
  speakingMidi?: number;
  voiceType?: string;
  naturalKey?: string;
  measuredAt?: string;
  calibration: Calibration;
}

export interface Settings {
  difficulty: 'easy' | 'normal' | 'hard';
  guideTone: boolean; // keep playing the target note while you sing (use headphones)
  extremeBudgetMin: number; // daily minutes of grit/scream/growl
  loudLimitDb: number; // warn when distorted singing is louder than this (dBFS)
  voiceCues: boolean;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  practiceSec: number;
  extremeSec: number;
  scores: { id: string; score: number }[];
}

interface Saved {
  profile: Profile;
  settings: Settings;
  days: DayLog[];
  ranges: { date: string; low: number; high: number }[];
}

const KEY = 'vpc:v2';

const DEFAULTS: Saved = {
  profile: { calibration: { ...DEFAULT_CALIBRATION } },
  settings: { difficulty: 'normal', guideTone: false, extremeBudgetMin: 10, loudLimitDb: -6, voiceCues: true },
  days: [],
  ranges: [],
};

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw) as Partial<Saved>;
    return {
      profile: { ...DEFAULTS.profile, ...s.profile, calibration: { ...DEFAULT_CALIBRATION, ...s.profile?.calibration } },
      settings: { ...DEFAULTS.settings, ...s.settings },
      days: s.days ?? [],
      ranges: s.ranges ?? [],
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

const state = read();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  listeners.forEach((fn) => fn());
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function day(): DayLog {
  const date = today();
  let d = state.days.find((x) => x.date === date);
  if (!d) {
    d = { date, practiceSec: 0, extremeSec: 0, scores: [] };
    state.days.push(d);
    state.days = state.days.slice(-365);
  }
  return d;
}

export const store = {
  get profile() { return state.profile; },
  get settings() { return state.settings; },
  get days() { return state.days; },
  get ranges() { return state.ranges; },
  get today() { return state.days.find((x) => x.date === today()) ?? { date: today(), practiceSec: 0, extremeSec: 0, scores: [] }; },

  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },

  updateProfile(p: Partial<Profile>) {
    Object.assign(state.profile, p);
    if (p.range) {
      state.ranges = state.ranges.filter((r) => r.date !== today());
      state.ranges.push({ date: today(), low: p.range.low, high: p.range.high });
    }
    persist();
  },

  updateCalibration(c: Partial<Calibration>) {
    Object.assign(state.profile.calibration, c);
    persist();
  },

  updateSettings(s: Partial<Settings>) {
    Object.assign(state.settings, s);
    persist();
  },

  logTime(practiceSec: number, extremeSec: number) {
    const d = day();
    d.practiceSec += practiceSec;
    d.extremeSec += extremeSec;
    persist();
  },

  logScore(id: string, score: number) {
    day().scores.push({ id, score: Math.round(score) });
    persist();
  },

  best(id: string): number | null {
    let best: number | null = null;
    for (const d of state.days) for (const s of d.scores) if (s.id === id && (best === null || s.score > best)) best = s.score;
    return best;
  },

  /** Consecutive days (ending today or yesterday) with at least 2 minutes of practice. */
  streak(): number {
    const practiced = new Set(state.days.filter((d) => d.practiceSec >= 120).map((d) => d.date));
    let n = 0;
    const d = new Date();
    if (!practiced.has(today())) d.setDate(d.getDate() - 1);
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!practiced.has(key)) return n;
      n++;
      d.setDate(d.getDate() - 1);
    }
  },

  reset() {
    Object.assign(state, structuredClone(DEFAULTS));
    persist();
  },
};
