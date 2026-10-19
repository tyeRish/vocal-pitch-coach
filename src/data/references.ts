// Reference singers. Ranges are approximate — published figures vary by source and era,
// and these are meant as a map to steer by, not a target to force your voice into.

import type { Range } from '../lib/music';

export interface Reference {
  id: string;
  name: string;
  range: Range; // approximate full chest/belt range
  zone: Range; // where much of their best-known material sits
  notes: string[];
}

export const REFERENCES: Reference[] = [
  {
    id: 'freddie',
    name: 'Freddie Mercury',
    range: { low: 41, high: 72 }, // ~F2–C5 in chest/mix, plus falsetto above
    zone: { low: 55, high: 69 }, // ~G3–A4
    notes: [
      'Huge chest-dominant belt that stays bright and forward, rarely shouty.',
      'Very fast, clean runs and ornaments — agility comes from staying light.',
      'Fluid switches into falsetto/head voice for effect rather than straining up.',
    ],
  },
  {
    id: 'chester',
    name: 'Chester Bennington',
    range: { low: 40, high: 71 }, // ~E2–B4
    zone: { low: 60, high: 69 }, // ~C4–A4
    notes: [
      'Clean lines in a high, bright mix; screams often sit around the same pitches.',
      'Distortion layered on top of a supported, pitched tone — the note is still there.',
      'Seamless clean → scream → clean switches inside one phrase.',
    ],
  },
];
