// Reference tones: a soft, piano-ish voice for "listen then sing" cues and drones.

import { midiToFreq } from '../lib/music';
import { engine } from './engine';

let ownCtx: AudioContext | null = null;
let master: GainNode | null = null;
let masterCtx: AudioContext | null = null;
let drone: { stop: () => void } | null = null;

/** Share the mic engine's context when it's running so tones and scoring use one clock. */
function context(): AudioContext {
  if (engine.ctx) return engine.ctx;
  if (!ownCtx || ownCtx.state === 'closed') ownCtx = new AudioContext();
  void ownCtx.resume();
  return ownCtx;
}

function out(ctx: AudioContext): GainNode {
  if (!master || masterCtx !== ctx) {
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    masterCtx = ctx;
  }
  return master;
}

function voice(ctx: AudioContext, freq: number, start: number, dur: number, gain = 0.6, freqEnd?: number) {
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(4000, freq * 6);
  const oscs = [
    { type: 'triangle' as OscillatorType, mult: 1, level: 1 },
    { type: 'sine' as OscillatorType, mult: 2, level: 0.25 },
  ].map(({ type, mult, level }) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq * mult, start);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd * mult, start + dur);
    const og = ctx.createGain();
    og.gain.value = level;
    o.connect(og).connect(lp);
    return o;
  });
  lp.connect(g).connect(out(ctx));
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.02);
  g.gain.setTargetAtTime(gain * 0.6, start + 0.05, 0.3);
  g.gain.setTargetAtTime(0, start + Math.max(0.05, dur - 0.06), 0.03);
  oscs.forEach((o) => { o.start(start); o.stop(start + dur + 0.3); });
  return oscs;
}

export const tone = {
  now: () => context().currentTime,

  /** Play a note at an absolute context time (defaults to now). Returns a function that cancels it. */
  note(midi: number, dur: number, at?: number, midiEnd?: number, gain = 0.6) {
    const ctx = context();
    const oscs = voice(ctx, midiToFreq(midi), at ?? ctx.currentTime, dur, gain, midiEnd !== undefined ? midiToFreq(midiEnd) : undefined);
    return () => oscs.forEach((o) => { try { o.stop(); } catch { /* not started or already stopped */ } });
  },

  /** Short beep: high = go, low = rest. */
  click(at?: number, accent = false) {
    const ctx = context();
    const t = at ?? ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 660;
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(out(ctx));
    o.start(t);
    o.stop(t + 0.09);
    return () => { try { o.stop(); } catch { /* already stopped */ } };
  },

  startDrone(midi: number) {
    this.stopDrone();
    const ctx = context();
    const t = ctx.currentTime;
    const oscs = [...voice(ctx, midiToFreq(midi), t, 3600, 0.35), ...voice(ctx, midiToFreq(midi + 7), t, 3600, 0.15)];
    drone = { stop: () => oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }) };
  },

  stopDrone() {
    drone?.stop();
    drone = null;
  },
};
