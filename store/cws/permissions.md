# Permission justifications — Commonplace

This is the Chrome Web Store reviewer's permissions questionnaire, pre-answered. Every entry below
corresponds to exactly one line in the shipped `manifest.json` — nothing is requested that isn't
defended here, and nothing is defended here that isn't requested. Minimal host permissions are a
standing constraint (SPEC §25); breadth would be both a review risk and a conversion cost (SPEC §18).

---

## API permissions

### `storage`
Stores the user's settings and small library metadata (capture preferences, the local-model /
bring-your-own-key choice, lane flags). No saved-content bytes and no secrets leave the device via
this API; it is local configuration state only.

### `unlimitedStorage`
The library is a personal archive that grows without a fixed ceiling — analysis records, poster
thumbnails, and structured entities for potentially thousands of saved videos. `unlimitedStorage`
lifts the default quota so a person's own collection is never silently truncated. All of it stays
on the user's machine (local-first, SPEC §25).

### `downloads`
Powers the core promise: **export**. When the user exports their library to the open schema, the
`downloads` API writes the resulting file to their own Downloads folder. It is used only for
user-initiated exports of the user's own data — no background or silent downloads.

### `declarativeNetRequest`
Analysis of a saved video needs to fetch **the user's own media** from TikTok's CDNs, which reject
requests that lack a matching `Referer`. A static declarative rule (see `rules.json`) sets that
header for the user's own fetches using `declarativeNetRequestWithHostAccess`, scoped to the TikTok
CDN hosts below. It reads no request bodies and blocks nothing; it only makes the user's own media
fetchable. Declarative-only means the extension never sees or intercepts network traffic.

### `offscreen`
MV3 service workers have no DOM and are killed aggressively. Analysis (decoding keyframes, running
the extraction/grounding pipeline) needs a document context. `offscreen` hosts a single hidden
document that does this work, so the pipeline can run without a visible tab and survive service-worker
churn.

### `alarms`
Analysis is a resumable queue that must survive the service worker being torn down mid-run. `alarms`
wakes the worker to revive the queue from its last checkpoint (resume in-flight items, apply 429
backoff) so a long analysis run completes reliably instead of stalling when Chrome suspends the worker.

---

## Host permissions

### `*://*.tiktok.com/*`
The site the user is on. The content scripts run here to detect the videos the user saves and to
render the one-click capture HUD. This is the single first-party surface the product captures from.

### `*://*.tiktokcdn.com/*`, `*://*.tiktokcdn-us.com/*`, `*://*.tiktokv.com/*`, `*://*.ttwstatic.com/*`
TikTok's media/content delivery networks. These are the hosts that actually serve the video,
poster, and asset bytes for the items **the user themselves saved**. Host access here is what lets
the extension fetch the user's own media (paired with the `declarativeNetRequest` Referer rule above)
so it can be analyzed and archived locally. No other CDN is contacted.

### `https://generativelanguage.googleapis.com/*`
The **Google Gemini API** (Generative Language API), used by the managed analysis lane. This is
contacted only when the user opts into managed analysis with their **own** provider key; the key is
stored locally and used solely for the user's own requests. Users who run the local lane never touch
this host.

### `https://musicbrainz.org/*`
The **MusicBrainz API** — the open music-metadata database used to ground music entities (tracks,
artists, releases) to durable public IDs (MBIDs). Read-only lookups; part of the grounding step that
produces the receipts the product is built on.

### `https://www.wikidata.org/*`
The **Wikidata API** — the open knowledge base used to ground general entities (people, places,
organizations, works) to durable Wikidata QIDs. Read-only lookups; the second pillar of grounding
alongside MusicBrainz.

### `https://places.googleapis.com/*`
The **Google Places API**, used by the places resolver to ground location entities to stable place
IDs. It sits behind an interface and a flag (a key is provided later), so it is dormant unless the
user enables place grounding; the host is declared so the resolver can function when turned on.

### `http://localhost/*`
The **local model runtime** (e.g. Ollama) for the local analysis lane. This is how the local-first
promise is kept: when the user chooses local analysis, extraction and grounding-selection calls go
to a model on their own machine and nothing about their content leaves the device. Contacted only
when the local lane is active.
