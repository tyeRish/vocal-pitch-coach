// Note math, key detection and "where should I sing" recommendations.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const MINOR = [0, 2, 3, 5, 7, 8, 10];

// Krumhansl-Kessler key profiles: how strongly each scale degree implies a key.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface Range {
  low: number; // MIDI note
  high: number;
}

export const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);
export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const pitchClass = (m: number) => ((Math.round(m) % 12) + 12) % 12;

export function midiToName(m: number): string {
  const r = Math.round(m);
  return NOTE_NAMES[pitchClass(r)] + (Math.floor(r / 12) - 1);
}

export function nameToMidi(name: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()]!;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return base + acc + (parseInt(m[3], 10) + 1) * 12;
}

/** Nearest note and how many cents sharp (+) or flat (-) the frequency is. */
export function analyzeFreq(freq: number) {
  const midiFloat = freqToMidi(freq);
  const midi = Math.round(midiFloat);
  return { midi, midiFloat, cents: (midiFloat - midi) * 100, name: midiToName(midi) };
}

export function keyName(tonicPc: number, mode: 'major' | 'minor') {
  return `${NOTE_NAMES[tonicPc]} ${mode}`;
}

export function scalePcs(tonicPc: number, mode: 'major' | 'minor'): Set<number> {
  return new Set((mode === 'major' ? MAJOR : MINOR).map((i) => (tonicPc + i) % 12));
}

function correlation(a: number[], b: number[]) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export interface KeyGuess {
  tonic: number;
  mode: 'major' | 'minor';
  name: string;
  confidence: number; // correlation, -1..1
}

/** Guess the key from a 12-bin histogram of how long each pitch class was sung. */
export function detectKey(hist: number[]): KeyGuess[] {
  if (hist.reduce((s, v) => s + v, 0) <= 0) return [];
  const out: KeyGuess[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const prof = mode === 'major' ? KK_MAJOR : KK_MINOR;
      const rotated = hist.map((_, pc) => prof[(pc - tonic + 12) % 12]);
      out.push({ tonic, mode, name: keyName(tonic, mode), confidence: correlation(hist, rotated) });
    }
  }
  return out.sort((x, y) => y.confidence - x.confidence);
}

const overlap = (a: Range, b: Range) =>
  Math.max(0, Math.min(a.high, b.high) - Math.max(a.low, b.low));

export interface KeyFit {
  tonicMidi: number;
  name: string;
  /** Where the bulk of a typical melody would sit in this key. */
  body: Range;
  score: number; // 0..1
}

/**
 * Rank the 12 keys for a singer. A typical rock/metal vocal line lives mostly between
 * the tonic and the fifth above it, and reaches from a fourth below up to the octave.
 */
export function recommendKeys(zone: Range, range: Range): KeyFit[] {
  const fits: KeyFit[] = [];
  const zoneCenter = (zone.low + zone.high) / 2;
  for (let pc = 0; pc < 12; pc++) {
    let best: KeyFit | null = null;
    for (let t = 24 + pc; t <= 84; t += 12) {
      const body = { low: t, high: t + 7 };
      const full = { low: t - 5, high: t + 12 };
      const score =
        0.5 * (overlap(body, zone) / 7) +
        0.3 * (overlap(full, range) / 17) +
        0.2 * Math.max(0, 1 - Math.abs(t + 3.5 - zoneCenter) / 12);
      if (!best || score > best.score) best = { tonicMidi: t, name: NOTE_NAMES[pc], body, score };
    }
    fits.push(best!);
  }
  return fits.sort((a, b) => b.score - a.score);
}

/** Best number of semitones to shift a song so it fits your range and centers on your zone. */
export function transposeSong(song: Range, zone: Range, range: Range) {
  let best = { shift: 0, cost: Infinity };
  const zoneCenter = (zone.low + zone.high) / 2;
  for (let s = -12; s <= 12; s++) {
    const low = song.low + s, high = song.high + s;
    const outside = Math.max(0, range.low - low) + Math.max(0, high - range.high);
    const cost = outside * 10 + Math.abs((low + high) / 2 - zoneCenter) + Math.abs(s) * 0.05;
    if (cost < best.cost) best = { shift: s, cost };
  }
  const low = song.low + best.shift, high = song.high + best.shift;
  return { shift: best.shift, low, high, fits: low >= range.low && high <= range.high };
}

export const VOICE_TYPES: { name: string; range: Range }[] = [
  { name: 'Bass', range: { low: 40, high: 64 } }, // E2–E4
  { name: 'Baritone', range: { low: 45, high: 69 } }, // A2–A4
  { name: 'Tenor', range: { low: 48, high: 72 } }, // C3–C5
  { name: 'Contralto', range: { low: 53, high: 77 } }, // F3–F5
  { name: 'Mezzo-Soprano', range: { low: 57, high: 81 } }, // A3–A5
  { name: 'Soprano', range: { low: 60, high: 84 } }, // C4–C6
];

/**
 * Voice type whose classical range is centered closest to yours. Comfortable zones usually
 * sit a few semitones below the middle of a voice type's range, so the zone is nudged up.
 */
export function estimateVoiceType(zone: Range, range: Range): string {
  const center = 0.6 * ((range.low + range.high) / 2) + 0.4 * ((zone.low + zone.high) / 2 + 4);
  let best = VOICE_TYPES[0], bestDist = Infinity;
  for (const vt of VOICE_TYPES) {
    const d = Math.abs((vt.range.low + vt.range.high) / 2 - center);
    if (d < bestDist) { bestDist = d; best = vt; }
  }
  return best.name;
}
