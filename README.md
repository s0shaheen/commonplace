# commonplace

a browser extension that saves your tiktok likes and favorites into a library you actually own, before the links rot.

it grabs each saved video's info locally (nothing leaves your machine unless you turn on analysis). optionally, it runs everything through an ai that writes down what each video is about, with the exact evidence it used, and links the people, places, and songs to real public ids (wikidata, musicbrainz, google places) instead of guessing. instagram and x are next.

it's early and under active development, so expect rough edges.

## running it

you'll need node, plus uv if you want to run the analysis tests.

```bash
npm install
npm run build      # bundles the extension into dist/
npm test           # engine tests (vitest)
npm run typecheck
```

then open chrome://extensions, turn on developer mode, and load the `dist/` folder unpacked. if you want the ai analysis, paste your gemini key into the extension's options page. keys only ever live in chrome.storage.local, never in the repo.

the analysis side is python:

```bash
cd eval && uv sync && uv run pytest -q
```

## using it

open your tiktok profile, go to likes or favorites, then:

- `alt+shift+a`: scroll and capture
- `alt+shift+e`: analyze and ground the captured items (a queue that survives the service worker getting killed)
- `alt+shift+s`: export the whole library as json

## where stuff lives

- `src/`: the extension. capture is in `content.js` and `main-world.js`, the engine is in `src/lib` (analysis lanes, resolvers, grounding, storage, the queue, exporters)
- `schema/`: the data format everything conforms to (json schema, shacl, fixtures). this one is meant to stay stable
- `eval/`: how we measure whether the analysis is any good. python, open source
- `docs/`: start at `docs/README.md`. the specs in `docs/specs/` are the source of truth
- `prompts/`: the prompts the analyzer uses
- `scripts/`: build, packaging, and a check that no api keys snuck into the bundle
- `spikes/`: old experiments and what they found

## why

saved videos disappear. accounts get banned, posts get taken down, links break, and the thing you meant to come back to is just gone. this keeps your own copy, organized well enough that you can find it again later. and the accuracy of the analysis is measured out in the open in `eval/`, so it isn't just a vibe.
