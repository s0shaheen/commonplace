# Spike #3 media harvest (2026-07-07)

Fetched still-live TikTok saves from the real corpus for the native-video-vs-[VTT+keyframes+OCR] experiment.

- **60 live / 61 tried (98% still live)** — 1 dead. Fetcher: `fetch.sh` (yt-dlp, stops at 60).
- **Strata:** 31 with VTT subtitles / 29 without — near-balanced, ideal for the experiment's core question (does the cheap VTT path tie native video?).
- Per item: `.mp4` + `.info.json` (+ `.vtt` where present). 285MB total. **All gitignored** (personal content); only this summary + the harness are committed.
- Candidate pool was 110 (55/55 stratified by `hasSubtitles`) from 3,855 non-slideshow corpus URLs.

Next: run both pipeline paths on these 60 → compare typed-mention recovery + cost → settle the managed-lane spine (SPEC §13/§15).
