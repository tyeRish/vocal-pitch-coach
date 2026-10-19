# 🤘 Vocal Pitch Coach

A vocal coach for singers who want **both**: Freddie Mercury–style clean power and range, *and* Chester Bennington–style grit and screams. It runs in the browser on your laptop or phone, installs like an app, works offline, and has a hands-free **Drive Mode** for car sessions.

**Live app:** https://tyerish.github.io/vocal-pitch-coach/ (open on your phone → Share / ⋮ menu → *Add to Home Screen*)

## What it does

| Tab | What it's for |
|---|---|
| 🎤 **Coach** | Live note, cents meter, **vocal mode** (clean / fry / grit / scream / growl), distortion meter, live **key detection**, scrolling pitch roll, drone to sing against, Freddie/Chester zones overlaid. |
| 🎯 **Zone** | 1-minute test → your range, **sweet spot** (where to sing most), voice type, speaking pitch, the key you gravitate to, the **best keys** for your voice, you vs. Freddie & Chester, and a **song key fitter**. |
| 🎵 **Train** | Daily workout + warm-ups, pitch & ear exercises, Freddie-style agility and belt building. Every exercise auto-transposes into your zone. |
| 🔥 **Lab** | Calibrate the mode detector to your voice, free-play mode meter, and the extreme track: fry → fry-to-clean → grit on pitch → clean/grit switching → fry screams → gutturals → full metal blend. Daily extreme-vocals budget and loudness guard. |
| 🚗 **Drive** | Eyes-free sessions: spoken instructions, beeps for go/rest, spoken scores. Skips full screams and gutturals. |
| 📈 **More** | Streak, practice history, range over time, personal bests, technique guide, settings. |

### How the vocal-mode detection works
Each audio frame (~45/s) is analysed for:
- **Pitch & periodicity** — YIN pitch detection (40–1400 Hz, so it hears fry too)
- **Harmonic-to-noise ratio** — grit fills in the gaps between harmonics
- **Spectral flatness & centroid** — noise-like vs. tonal, bright scream vs. dark growl

These are compared against *your own* clean tone (Lab → Calibrate). It's a well-informed estimate, not a laryngoscope: it hears the sound you make, not whether your throat is doing it safely.

## Safety
Extreme vocals done right shouldn't hurt. Pain, burning, coughing or next-day hoarseness mean you pushed too hard — rest. Hoarseness lasting more than 2 weeks: see an ENT. The app enforces a daily extreme budget (default 10 min) and warns when distortion is being forced with volume. A real extreme-vocals coach is worth it.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run phone      # HTTPS on your local network — open the "Network" URL on your phone
npm test           # unit tests (pitch, mode detection, music theory, scoring, zone analysis)
npm run smoke      # end-to-end test in headless Chromium with a synthetic voice (needs `npm run dev` running)
npm run build      # production build → dist/
```

Stack: TypeScript + Vite, no UI framework. PWA via `vite-plugin-pwa`. Audio capture via an AudioWorklet so analysis keeps running when the screen dims.

```
src/
  lib/        music theory, YIN pitch, vocal-mode features & classifier, zone analysis   (pure, unit-tested)
  audio/      mic engine, reference tones, speech
  training/   exercise timelines, scoring, live runner
  data/       exercises, reference singers, local storage
  ui/ views/  piano roll, DOM helpers, one file per tab
```

Pushing to `main` runs the tests, builds, and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## License
MIT
