// Background bookkeeping while the mic is on: practice time, the daily extreme-vocals
// budget, and a warning when distorted singing is being forced with raw volume.

import { engine } from './audio/engine';
import { store } from './data/store';
import { EXTREME_MODES } from './lib/voice';
import { toast } from './ui/dom';

let lastT = 0;
let pendingPractice = 0;
let pendingExtreme = 0;
let loudSec = 0;
let lastLoudWarn = -Infinity;
let budgetWarned = false;

function flush() {
  if (pendingPractice > 0 || pendingExtreme > 0) store.logTime(pendingPractice, pendingExtreme);
  pendingPractice = pendingExtreme = 0;
}

export function extremeBudgetLeft() {
  return store.settings.extremeBudgetMin * 60 - store.today.extremeSec - pendingExtreme;
}

export function initSession() {
  engine.calibration = { ...store.profile.calibration };
  store.subscribe(() => { engine.calibration = { ...store.profile.calibration }; });

  engine.onFrame((f) => {
    const dt = lastT ? Math.min(0.1, Math.max(0, f.t - lastT)) : 0;
    lastT = f.t;
    if (f.mode !== 'silence') pendingPractice += dt;
    const extreme = EXTREME_MODES.includes(f.mode);
    if (extreme) pendingExtreme += dt;

    // Loudness guard: sustained distortion above the limit.
    loudSec = extreme && f.db > store.settings.loudLimitDb ? loudSec + dt : Math.max(0, loudSec - dt * 0.5);
    if (loudSec > 1.5 && f.t - lastLoudWarn > 20) {
      lastLoudWarn = f.t;
      toast('Ease off the volume — let air and placement make the distortion, not force.', 'warn');
    }

    if (!budgetWarned && extremeBudgetLeft() <= 0) {
      budgetWarned = true;
      toast(`You've hit today's ${store.settings.extremeBudgetMin}-minute extreme-vocals budget. Switch to clean work or rest.`, 'warn');
    }

    if (pendingPractice + pendingExtreme > 10) flush();
  });

  engine.onStatus((running) => {
    if (!running) { flush(); lastT = 0; }
  });
  window.addEventListener('pagehide', flush);
}
