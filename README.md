# Attic Phase 0 Spike (throwaway)

Validates: (1) complete in-browser capture of TikTok Favorites, (2) AI-enriched export value.

## Setup

1. `cp src/secrets.example.js src/secrets.js` and paste your Gemini key.
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.

## Run

- **Capture (gate 0.2):** Log into TikTok, open your **Favorites** tab (bookmark icon) on your profile. Press **Alt+Shift+A** to auto-scroll + capture. When it finishes it downloads `attic-favorites.json`. Watch the service-worker console (`chrome://extensions` → "service worker") for live counts.
- **Enrich (gate 0.3):** On the same tab, after capture, press **Alt+Shift+E** to enrich the first 20 items → downloads `attic-enriched.json`. Watch the page console for per-item `ok`/`ERROR`.

## Tests

`npm test`

## Gates

See `recon/0.1-findings.md`, `results/0.4-value-test.md`, `results/0.8-spike-decision.md`.
Endpoint: `GET /api/user/collect/item_list/` · item array `itemList` · `id` is a string.
