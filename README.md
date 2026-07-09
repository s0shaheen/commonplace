# Commonplace

**A commonplace book for the video age.** A local-first browser extension that turns your saved TikToks (Instagram/X to follow) into a structured library you own: every save is captured before its links rot, analyzed by an AI that writes down what it's about *with evidence receipts*, and grounded to durable public identifiers (MusicBrainz, Wikidata, Google Places) — or given an honest "not found."

The differentiator is measurement: the evaluation harness is open-source and the grounding accuracy numbers will be published, per-layer, with confidence intervals, before launch.

## Repository layout

| Path | What it is |
|---|---|
| `src/` | The MV3 extension: capture shell + the TypeScript engine (`src/lib`) — lanes, resolvers, grounding, store, queue, exporters |
| `schema/` | **The frozen data contract** (JSON Schema + SHACL + vocabularies + fixtures + CHANGELOG). Public-bound |
| `eval/` | **The open-source evaluation instrument** (Python/uv): matcher, per-layer metrics, calibration, bootstrap CIs, scorecard CLI + the annotation codebook. Public-bound |
| `docs/` | Documentation — start at `docs/README.md` (the map); `docs/specs/` governs |
| `prompts/` | Extractor prompts (`extract_v1.md` is current) |
| `scripts/` | Build (esbuild), schema-validator precompile, CWS packaging, key-exposure audit |
| `spikes/` | Historical feasibility spikes with results (evidence, not gospel) |

## Development

```bash
npm install && npm run build     # bundles the extension into dist/
npm test                         # engine tests (vitest)
npm run typecheck
cd eval && uv sync && uv run pytest -q   # evaluation harness tests
```

Load `dist/` unpacked at `chrome://extensions` (Developer mode). Set your Gemini key in the extension's options page — keys live only in `chrome.storage.local`, never in source.

- Capture: open your TikTok Favorites, **Alt+Shift+A** to scroll+capture
- Analyze/ground: **Alt+Shift+E** starts the resumable queue (survives service-worker kills)
- Export: **Alt+Shift+S** emits the library in the open schema format

## Where things stand

See `docs/strategy/roadmap.md` (status log at the bottom) and `docs/decisions/decision-log.md` for how we got here.
