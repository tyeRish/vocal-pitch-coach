// Find-My-Zone analysis: full range, comfortable singing zone (tessitura), speaking pitch,
// voice type, natural key and the keys that fit the voice best.

import {
  detectKey, recommendKeys, estimateVoiceType, pitchClass, type KeyFit, type Range,
} from './music';

/** Frames that belong to a held note: the surrounding window barely moves. */
export function stableMidis(midis: (number | null)[], win = 7, maxSpread = 0.6): number[] {
  const out: number[] = [];
  const half = Math.floor(win / 2);
  for (let i = half; i < midis.length - half; i++) {
    let lo = Infinity, hi = -Infinity, ok = true;
    for (let j = i - half; j <= i + half; j++) {
      const m = midis[j];
      if (m === null) { ok = false; break; }
      lo = Math.min(lo, m);
      hi = Math.max(hi, m);
    }
    if (ok && hi - lo < maxSpread) out.push(midis[i]!);
  }
  return out;
}

export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

/** Narrowest band of semitones holding `coverage` of the time sung (at least 5 semitones wide). */
export function comfortZone(midis: number[], coverage = 0.8): Range | null {
  if (midis.length < 20) return null;
  const hist = new Map<number, number>();
  for (const m of midis) hist.set(Math.round(m), (hist.get(Math.round(m)) ?? 0) + 1);
  const keys = [...hist.keys()].sort((a, b) => a - b);
  const lo = keys[0], hi = keys[keys.length - 1];
  const need = coverage * midis.length;
  for (let w = 0; w <= hi - lo; w++) {
    let best: { low: number; sum: number } | null = null;
    for (let a = lo; a + w <= hi; a++) {
      let sum = 0;
      for (let m = a; m <= a + w; m++) sum += hist.get(m) ?? 0;
      if (sum >= need && (!best || sum > best.sum)) best = { low: a, sum };
    }
    if (best) {
      const zone = { low: best.low, high: best.low + w };
      while (zone.high - zone.low < 5) {
        zone.low--;
        if (zone.high - zone.low < 5) zone.high++;
      }
      return zone;
    }
  }
  return null;
}

export interface VoiceAnalysis {
  range: Range;
  zone: Range;
  speakingMidi: number | null;
  voiceType: string;
  naturalKey: string | null;
  keys: KeyFit[];
}

export interface ZoneRecordings {
  speak: (number | null)[];
  low: (number | null)[];
  high: (number | null)[];
  comfort: (number | null)[];
}

export function analyzeVoice(rec: ZoneRecordings): VoiceAnalysis | null {
  const comfort = stableMidis(rec.comfort);
  const all = [...stableMidis(rec.low), ...stableMidis(rec.high), ...comfort, ...stableMidis(rec.speak)].sort((a, b) => a - b);
  if (all.length < 20) return null;

  const range = { low: Math.round(percentile(all, 0.02)), high: Math.round(percentile(all, 0.98)) };
  let zone = comfortZone(comfort);
  if (!zone) {
    const span = range.high - range.low;
    zone = { low: range.low + Math.round(span * 0.25), high: range.high - Math.round(span * 0.3) };
  }
  zone = { low: Math.max(range.low, zone.low), high: Math.min(range.high, zone.high) };

  const speakVoiced = rec.speak.filter((m): m is number => m !== null).sort((a, b) => a - b);
  const hist = new Array(12).fill(0);
  for (const m of comfort) hist[pitchClass(m)]++;
  const key = detectKey(hist)[0];

  return {
    range,
    zone,
    speakingMidi: speakVoiced.length >= 10 ? Math.round(percentile(speakVoiced, 0.5)) : null,
    voiceType: estimateVoiceType(zone, range),
    naturalKey: key && key.confidence > 0.5 ? key.name : null,
    keys: recommendKeys(zone, range).slice(0, 4),
  };
}
