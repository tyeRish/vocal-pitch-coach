// Microphone engine: captures audio, runs pitch + vocal-mode analysis ~45 times a second,
// and broadcasts a Frame to listeners. Capture runs in an AudioWorklet so it keeps going
// when the browser throttles animation frames (e.g. a phone screen dimming in the car).

import { yin, rms } from '../lib/pitch';
import { analyzeFreq } from '../lib/music';
import {
  spectralFeatures, harmonicity, classify, ModeSmoother,
  DEFAULT_CALIBRATION, type Calibration, type VocalMode,
} from '../lib/voice';

export interface Frame {
  t: number; // seconds, on the AudioContext clock
  db: number;
  freq: number | null; // smoothed pitch, null when not voiced
  midi: number | null; // fractional MIDI note
  note: string | null;
  cents: number;
  clarity: number;
  hnr: number;
  centroid: number;
  flatness: number;
  mode: VocalMode;
  distortion: number;
}

const FFT_SIZE = 4096;
const HOP = 1024;

const WORKLET_SRC = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(${FFT_SIZE}); this.pos = 0; this.since = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) { this.buf[this.pos] = ch[i]; this.pos = (this.pos + 1) % ${FFT_SIZE}; }
      this.since += ch.length;
      if (this.since >= ${HOP}) {
        this.since = 0;
        const out = new Float32Array(${FFT_SIZE});
        out.set(this.buf.subarray(this.pos));
        out.set(this.buf.subarray(0, this.pos), ${FFT_SIZE} - this.pos);
        this.port.postMessage(out, [out.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('vpc-capture', Capture);
`;

type FrameListener = (f: Frame) => void;
type StatusListener = (running: boolean) => void;

class Engine {
  ctx: AudioContext | null = null;
  running = false;
  calibration: Calibration = { ...DEFAULT_CALIBRATION };
  sampleRate = 48000;

  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private node: AudioWorkletNode | null = null;
  private timer: number | null = null;
  private freqBuf = new Float32Array(FFT_SIZE / 2);
  private timeBuf = new Float32Array(FFT_SIZE);
  private frames = new Set<FrameListener>();
  private status = new Set<StatusListener>();
  private smoother = new ModeSmoother(8);
  private recent: { t: number; f: number }[] = [];
  private wakeLock: WakeLockSentinel | null = null;

  onFrame(fn: FrameListener) { this.frames.add(fn); return () => this.frames.delete(fn); }
  onStatus(fn: StatusListener) { this.status.add(fn); return () => this.status.delete(fn); }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  async start() {
    if (this.running) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      // Processing meant for phone calls destroys fry and distortion — turn it all off.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);

    this.ctx = ctx;
    this.stream = stream;
    this.analyser = analyser;
    this.sampleRate = ctx.sampleRate;
    this.freqBuf = new Float32Array(analyser.frequencyBinCount);
    this.smoother.reset();
    this.recent = [];

    try {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, 'vpc-capture');
      node.port.onmessage = (e: MessageEvent<Float32Array>) => this.process(e.data);
      source.connect(node);
      // Some browsers only pull audio through nodes that reach the destination.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(ctx.destination);
      this.node = node;
    } catch {
      this.timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(this.timeBuf);
        this.process(this.timeBuf);
      }, 22);
    }

    this.running = true;
    this.status.forEach((fn) => fn(true));
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.node?.port.close();
    this.node = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.releaseWakeLock();
    this.status.forEach((fn) => fn(false));
  }

  async keepAwake() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      }
    } catch { /* not supported or denied — fine */ }
  }

  releaseWakeLock() {
    void this.wakeLock?.release();
    this.wakeLock = null;
  }

  private process(buf: Float32Array) {
    if (!this.ctx || !this.analyser) return;
    const t = this.ctx.currentTime;
    const sr = this.sampleRate;
    const level = rms(buf);
    const db = level > 0 ? 20 * Math.log10(level) : -120;
    this.analyser.getFloatFrequencyData(this.freqBuf);

    const pitch = db > this.calibration.noiseDb ? yin(buf, sr) : { freq: -1, clarity: 0 };
    const spec = spectralFeatures(this.freqBuf, sr, FFT_SIZE);
    const hnr = pitch.freq > 0 ? harmonicity(this.freqBuf, pitch.freq, sr, FFT_SIZE) : NaN;
    const cls = classify({ ...spec, db, freq: pitch.freq, clarity: pitch.clarity, hnr }, this.calibration);
    const mode = this.smoother.push(cls.mode);

    // Only trust the pitch when the voice is actually periodic enough.
    const minClarity = cls.mode === 'clean' ? 0.6 : 0.4;
    const voiced = pitch.freq > 0 && pitch.clarity >= minClarity &&
      (cls.mode === 'clean' || cls.mode === 'grit' || cls.mode === 'fry');

    let freq: number | null = null;
    this.recent = this.recent.filter((r) => t - r.t < 0.12);
    if (voiced) {
      this.recent.push({ t, f: pitch.freq });
      const sorted = this.recent.map((r) => r.f).sort((a, b) => a - b);
      freq = sorted[Math.floor(sorted.length / 2)];
    }
    const info = freq ? analyzeFreq(freq) : null;

    const frame: Frame = {
      t, db, freq,
      midi: info ? info.midiFloat : null,
      note: info ? info.name : null,
      cents: info ? info.cents : 0,
      clarity: pitch.clarity,
      hnr,
      centroid: spec.centroid,
      flatness: spec.flatness,
      mode,
      distortion: cls.distortion,
    };
    this.frames.forEach((fn) => fn(frame));
  }
}

export const engine = new Engine();
