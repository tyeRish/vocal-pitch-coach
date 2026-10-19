// Scrolling piano-roll: your pitch line (colored by vocal mode) over note lanes,
// with exercise targets scrolling in from the right and your comfort zone shaded.

import { midiToName, pitchClass, type Range } from '../lib/music';
import type { VocalMode } from '../lib/voice';
import { targetMidiAt, type Target } from '../training/scoring';

export const MODE_COLORS: Record<VocalMode, string> = {
  silence: 'transparent',
  clean: '#22d3ee',
  fry: '#a78bfa',
  grit: '#f59e0b',
  scream: '#ef4444',
  growl: '#dc2626',
  breathy: '#64748b',
};

interface Point { t: number; midi: number | null; mode: VocalMode }

export interface Band { range: Range; label: string; color: string }

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export class Roll {
  windowSec = 8;
  nowFrac = 0.6;
  zone: Range | null = null;
  keyPcs: Set<number> | null = null;
  bands: Band[] = [];
  activeTarget: Target | null = null;

  private points: Point[] = [];
  private targets: Target[] = [];
  private view = { lo: 45, hi: 63 };
  private raf = 0;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver;
  private w = 0;
  private h = 0;

  constructor(private canvas: HTMLCanvasElement, private clock: () => number) {
    this.ctx = canvas.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  push(t: number, midi: number | null, mode: VocalMode) {
    this.points.push({ t, midi, mode });
    const cutoff = t - this.windowSec * 1.5;
    while (this.points.length && this.points[0].t < cutoff) this.points.shift();
  }

  setTargets(targets: Target[]) {
    this.targets = targets;
    const ms = targets.flatMap((t) => [t.step.midi, t.step.midiEnd]).filter((m): m is number => m !== undefined);
    if (ms.length) this.view = { lo: Math.min(...ms) - 4, hi: Math.max(...ms) + 4 };
  }

  clear() { this.points = []; this.targets = []; this.activeTarget = null; }

  start() {
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }

  private follow(now: number) {
    if (this.targets.length) return;
    const recent = this.points.filter((p) => p.midi !== null && now - p.t < 3).map((p) => p.midi!).sort((a, b) => a - b);
    let center: number | null = recent.length ? recent[Math.floor(recent.length / 2)] : null;
    if (center === null && this.zone) center = (this.zone.low + this.zone.high) / 2;
    if (center === null) return;
    const span = Math.max(16, this.zone ? this.zone.high - this.zone.low + 8 : 16);
    const lo = center - span / 2;
    this.view.lo += (lo - this.view.lo) * 0.08;
    this.view.hi = this.view.lo + span;
  }

  private draw() {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    const now = this.clock();
    this.follow(now);
    const labelW = 38;
    const stripH = 8;
    const plotH = h - stripH;
    const { lo, hi } = this.view;
    const y = (m: number) => plotH - ((m - lo) / (hi - lo)) * plotH;
    const laneH = plotH / (hi - lo);
    const x = (t: number) => labelW + (w - labelW) * (this.nowFrac + (t - now) / this.windowSec);

    ctx.clearRect(0, 0, w, h);

    // Lanes.
    for (let m = Math.floor(lo); m <= Math.ceil(hi); m++) {
      const pc = pitchClass(m);
      const top = y(m + 0.5);
      if (BLACK_KEYS.has(pc)) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(labelW, top, w - labelW, laneH);
      }
      if (this.keyPcs?.has(pc)) {
        ctx.fillStyle = 'rgba(34,211,238,0.05)';
        ctx.fillRect(labelW, top, w - labelW, laneH);
      }
      if (pc === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.moveTo(labelW, y(m - 0.5)); ctx.lineTo(w, y(m - 0.5)); ctx.stroke();
      }
      if (laneH >= 11 || pc === 0) {
        ctx.fillStyle = pc === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)';
        ctx.font = `${Math.min(11, Math.max(9, laneH * 0.7))}px system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(midiToName(m), 4, y(m));
      }
    }

    // Reference bands (e.g. Freddie / Chester) as thin rails on the left of the plot.
    this.bands.forEach((b, i) => {
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(labelW + 2 + i * 6, y(b.range.high + 0.5), 4, y(b.range.low - 0.5) - y(b.range.high + 0.5));
      ctx.globalAlpha = 1;
    });

    // Comfort zone.
    if (this.zone) {
      ctx.fillStyle = 'rgba(16,185,129,0.08)';
      const top = y(this.zone.high + 0.5);
      ctx.fillRect(labelW, top, w - labelW, y(this.zone.low - 0.5) - top);
    }

    // Targets.
    for (const tg of this.targets) {
      const x0 = x(tg.start), x1 = x(tg.end);
      if (x1 < labelW || x0 > w) continue;
      const active = tg === this.activeTarget;
      const listen = tg.phase === 'listen';
      if (tg.step.midi === undefined) {
        if (tg.step.rest) continue;
        // Mode-only step (e.g. fry, scream): a full-height column with a label.
        const color = MODE_COLORS[tg.step.modes?.[0] ?? 'clean'];
        ctx.fillStyle = color;
        ctx.globalAlpha = active ? 0.22 : 0.12;
        ctx.fillRect(x0, 0, x1 - x0, plotH);
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(tg.step.cue ?? '', x0 + 4, 6);
        continue;
      }
      const color = tg.step.modes?.includes('grit') ? MODE_COLORS.grit : '#e2e8f0';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(4, laneH * 0.7);
      ctx.lineCap = 'round';
      ctx.globalAlpha = listen ? 0.25 : active ? 0.75 : 0.45;
      ctx.beginPath();
      const steps = tg.step.midiEnd !== undefined ? 12 : 1;
      for (let i = 0; i <= steps; i++) {
        const t = tg.start + ((tg.end - tg.start) * i) / steps;
        const px = Math.max(labelW, Math.min(w, x(t)));
        const py = y(targetMidiAt(tg, t)!);
        if (i === 0) ctx.moveTo(px + ctx.lineWidth / 2, py); else ctx.lineTo(px - (i === steps ? ctx.lineWidth / 2 : 0), py);
      }
      if (steps === 1) ctx.lineTo(Math.max(labelW, x1 - ctx.lineWidth / 2), y(tg.step.midi));
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (!listen && laneH >= 9 && x0 > labelW) {
        ctx.fillStyle = '#0d0b14';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(midiToName(tg.step.midi), x0 + 2, y(tg.step.midi));
      }
    }

    // Now line.
    const nx = x(now);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(nx, 0); ctx.lineTo(nx, plotH); ctx.stroke();

    // Pitch line and mode strip, clipped so they never run over the note labels.
    ctx.save();
    ctx.beginPath();
    ctx.rect(labelW, 0, w - labelW, h);
    ctx.clip();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i];
      if (a.midi === null || b.midi === null || b.t - a.t > 0.12) continue;
      if (Math.abs(a.midi - b.midi) > 3) continue;
      ctx.strokeStyle = MODE_COLORS[b.mode];
      ctx.beginPath(); ctx.moveTo(x(a.t), y(a.midi)); ctx.lineTo(x(b.t), y(b.midi)); ctx.stroke();
    }

    // Mode strip along the bottom: shows fry/grit/scream even when there's no pitch.
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i];
      ctx.fillStyle = MODE_COLORS[b.mode];
      ctx.fillRect(x(a.t), plotH, Math.max(1, x(b.t) - x(a.t)), stripH);
    }
    ctx.restore();
  }
}
