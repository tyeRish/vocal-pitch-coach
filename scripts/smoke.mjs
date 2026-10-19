// End-to-end smoke test: runs the app in headless Chromium with a synthetic "voice" fed in
// as the microphone, clicks through every tab, checks the live readout and saves screenshots.
//
// Usage: npm run dev   (in another terminal)
//        npm run smoke [-- <screenshot dir>]

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const URL = process.env.APP_URL ?? 'http://localhost:5173/';
const outDir = resolve(process.argv[2] ?? join(tmpdir(), 'vpc-smoke'));
mkdirSync(outDir, { recursive: true });

// --- Synthetic voice: 2 s silence, 5 s clean A3 (220 Hz), 5 s gritty A3. ---
function wav(path) {
  const sr = 48000;
  const secs = 12;
  const n = sr * secs;
  const data = new Int16Array(n);
  let seed = 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  let shake = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    if (t >= 2) {
      for (let h = 1; h <= 20; h++) v += Math.sin(2 * Math.PI * 220 * h * t + h) / h;
      v *= 0.25;
      if (t >= 7) {
        shake = 0.97 * shake + 0.03 * rnd();
        v *= 1 + 12 * shake;
        v *= 1 + 0.4 * Math.sin(Math.PI * 220 * t);
      }
    }
    data[i] = Math.max(-1, Math.min(1, v)) * 32767;
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  Buffer.from(data.buffer).copy(buf, 44);
  writeFileSync(path, buf);
}

const wavPath = join(outDir, 'voice.wav');
wav(wavPath);

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wavPath}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failed = true; };

// Seed a measured voice profile so pages show results instead of the intro.
await page.goto(URL);
await page.evaluate(() => localStorage.setItem('vpc:v2', JSON.stringify({
  profile: { range: { low: 41, high: 69 }, zone: { low: 48, high: 57 }, voiceType: 'Baritone', speakingMidi: 47, naturalKey: 'E minor' },
})));

// --- Coach with live audio ---
await page.goto(`${URL}#coach`);
await page.reload(); // a hash-only goto doesn't reload, and the store reads localStorage at startup
await page.click('.mic-toggle');
await page.waitForTimeout(5500); // into the clean A3
const cleanNote = await page.textContent('.note-big');
const cleanMode = await page.textContent('.readout .mode-badge');
await shot('1-coach-clean');
check(cleanNote === 'A3', `clean tone reads A3 (got ${cleanNote})`);
check(cleanMode === 'Clean', `clean tone reads mode Clean (got ${cleanMode})`);
await page.waitForTimeout(4500); // into the gritty part
const gritMode = await page.textContent('.readout .mode-badge');
await shot('2-coach-grit');
check(gritMode !== 'Clean' && gritMode !== '—', `gritty tone is not Clean (got ${gritMode})`);

// --- Every tab renders without errors ---
for (const tab of ['zone', 'train', 'lab', 'drive', 'more']) {
  await page.goto(`${URL}#${tab}`);
  await page.waitForTimeout(600);
  await shot(`3-${tab}`);
  check((await page.locator('.view').count()) > 0, `${tab} renders`);
}

// --- Run an exercise for a few seconds ---
await page.goto(`${URL}#train`);
await page.click('text=Five-tone scale');
await page.click('text=▶ Start');
await page.waitForTimeout(4000);
await shot('4-exercise-running');
check((await page.locator('.player canvas').count()) === 1, 'exercise player shows the roll');

check(errors.length === 0, `no page errors${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
console.log(`Screenshots: ${outDir}`);
await browser.close();
process.exit(failed ? 1 : 0);
