# Attic Phase 0 Kill-Gate Spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In ~1 week of throwaway code, prove or kill the two load-bearing assumptions behind the Attic pivot: (1) a logged-in user's TikTok Favorites can be captured completely in-browser, and (2) the AI-enriched export is meaningfully more useful than the raw export pasted into ChatGPT.

**Architecture:** A raw (no-framework) Manifest V3 extension that injects a MAIN-world script to monkeypatch `fetch`/`XHR` and skim TikTok's own already-signed `item_list` responses while auto-scrolling the Favorites tab. An ISOLATED content script relays captures to a service-worker collector that dedupes and exports JSON. A second manual flow fetches video bytes (in the tiktok.com page context, so the session is correct) and enriches ~20 items via the Gemini API using the ported `observe_video` prompt. Pure transform logic is TDD'd; live-site behavior is validated against explicit acceptance gates.

**Tech Stack:** Raw MV3 (hand-written `manifest.json`, no WXT — speed over reuse for throwaway code), vanilla ES modules, `node:test` for unit tests, Gemini API (`gemini-2.5-flash`, founder's own key, inline base64 video). New git repo at `/Users/s0shaheen/Dev/attic-extension`.

**Adaptation note:** This is exploratory validation code. TDD applies to `capture.js` (pure). Tasks 4, 6, 7 are empirical gates run against live TikTok / real users, not unit tests — their "expected result" is a measured threshold from the spec's kill criteria.

**Kill criteria (from the spec — the gates this plan exists to test):**

- ❌ Kill if capture < ~95% of a real Favorites set, or a soft-block occurs in one run (Task 4).
- ❌ Kill if video → Gemini from the browser can't reliably produce valid enriched JSON (Task 6).
- ❌ Kill/pivot if users find raw + ChatGPT "good enough" (Task 7).
- ✅ Proceed to Phase 1 only if all three clear (Task 8).

---

## File Structure

New repo `/Users/s0shaheen/Dev/attic-extension`:

```
attic-extension/
  .gitignore                 # excludes secrets.js (holds the Gemini key)
  package.json               # type:module; "test": "node --test"
  README.md                  # how to load unpacked + run each spike step
  manifest.json              # MV3 manifest (two content scripts: MAIN + ISOLATED)
  prompts/
    observe_video.md         # copied verbatim from the old repo
  src/
    main-world.js            # MAIN world: monkeypatch fetch/XHR, postMessage captures
    content.js               # ISOLATED: relay to SW; Alt+Shift+A scroll; Alt+Shift+E enrich
    background.js            # service worker: collect, dedupe, persist, export downloads
    capture.js               # PURE: extractItems(), mergeDedupe()  ← unit tested
    capture.test.js          # node:test unit tests for capture.js
    gemini.js                # browser→Gemini enrich (fetch video bytes, inline call)
    secrets.example.js       # template; real secrets.js is gitignored
  recon/
    0.1-findings.md          # filled during DevTools recon
  results/
    0.4-value-test.md        # user study notes + decision
    0.8-spike-decision.md    # final go/kill writeup
```

The plan document itself stays in the current repo (`docs/plans/`). All spike _code_ lives in the new repo above.

---

## Task 0: Scaffold the new spike repo

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/.gitignore`
- Create: `/Users/s0shaheen/Dev/attic-extension/package.json`
- Create: `/Users/s0shaheen/Dev/attic-extension/README.md`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/secrets.example.js`

- [ ] **Step 1: Create the repo directory and init git**

```bash
mkdir -p /Users/s0shaheen/Dev/attic-extension/src /Users/s0shaheen/Dev/attic-extension/prompts /Users/s0shaheen/Dev/attic-extension/recon /Users/s0shaheen/Dev/attic-extension/results
cd /Users/s0shaheen/Dev/attic-extension && git init -q
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
src/secrets.js
*.log
attic-favorites*.json
attic-enriched*.json
```

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "attic-extension-spike",
  "private": true,
  "type": "module",
  "version": "0.0.1",
  "description": "Throwaway Phase 0 kill-gate spike for the Attic pivot.",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 4: Write `src/secrets.example.js`**

```js
// Copy to src/secrets.js (gitignored) and paste the founder's own Gemini API key.
export const GEMINI_KEY = "PASTE_YOUR_GEMINI_KEY_HERE";
```

- [ ] **Step 5: Write `README.md`**

```markdown
# Attic Phase 0 Spike (throwaway)

Validates: (1) complete in-browser capture of TikTok Favorites, (2) AI-enriched export value.

## Setup

1. `cp src/secrets.example.js src/secrets.js` and paste your Gemini key.
2. Chrome → `chrome://extensions` → enable Developer mode → "Load unpacked" → select this folder.

## Run

- **Capture (0.2):** Log into TikTok, open your **Favorites** tab on your profile. Press **Alt+Shift+A** to auto-scroll+capture. When it finishes it downloads `attic-favorites.json`. Check the service-worker console (`chrome://extensions` → "service worker") for live counts.
- **Enrich (0.3):** On the same tab, press **Alt+Shift+E** to enrich the first 20 captured items → downloads `attic-enriched.json`.

## Tests

`npm test`
```

- [ ] **Step 6: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add .gitignore package.json README.md src/secrets.example.js
git commit -q -m "chore: scaffold Phase 0 spike repo"
```

---

## Task 1: DevTools recon of the live Favorites endpoint (Spike step 0.1)

This is **load-bearing and manual** — the Favorites endpoint cannot be cribbed from any existing tool (traktok recon confirmed it). The starting hypotheses are `/api/user/collection/item_list/`, `/api/favorite/item_list/`, or `/api/post/item_list/`.

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/recon/0.1-findings.md`

- [ ] **Step 1: Capture the live request in DevTools**

In Chrome, logged into TikTok, open your profile → **Favorites** tab. Open DevTools → Network → filter `item_list`. Scroll the Favorites list to trigger pagination. For the request that returns your saved videos, record: the full URL + path, query params (`secUid`, `cursor`, `count`, `coIdList`, `msToken`, `X-Bogus`, etc.), and whether a fresh signed request fires on each scroll.

- [ ] **Step 2: Inspect the response shape**

Click the request → Response. Record: where the item array lives (`itemList` vs `items`), the per-item fields present (`id`, `desc`, `author.uniqueId`, `video.playAddr`/`downloadAddr`, `video.cover`, `createTime`), and where the pagination cursor + `hasMore` live.

- [ ] **Step 3: Write findings to `recon/0.1-findings.md`**

Fill this template with the real values observed:

```markdown
# 0.1 DevTools Recon — TikTok Favorites

- Endpoint path: <e.g. /api/user/collection/item_list/ or /api/favorite/item_list/>
- Method: GET
- Key query params: secUid=..., cursor=..., count=..., coIdList=..., msToken=..., X-Bogus=...
- Signed per scroll? : YES/NO
- Item array path in response: itemList | items
- Cursor field: cursor | maxCursor · hasMore field: hasMore
- Per-item fields confirmed: id, desc, author.uniqueId, video.playAddr, video.cover, createTime
- Video URL playable from extension fetch (with Referer)? : UNKNOWN (tested in Task 5)

## DECISION GATE

- [ ] A queryable JSON endpoint returns my saved videos with a cursor → PROCEED to Task 2.
- [ ] No XHR fires / pure SSR / endpoint returns no items → RED. Stop and report (pivot to Mode B / data-export import).
```

- [ ] **Step 4: Update the interceptor target regex if needed**

The default target in `main-world.js` (Task 3) is `/\/api\/(post|favorite|user\/collection)\/item_list/i`. If 0.1 revealed a different path, note the exact regex to use so Task 3 matches it.

- [ ] **Step 5: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add recon/0.1-findings.md
git commit -q -m "docs(recon): record live TikTok Favorites endpoint findings"
```

**Expected result:** The DECISION GATE's first box is checked. If the second is checked instead, the spike halts here with a RED signal.

---

## Task 2: Pure capture logic (extract + dedupe) — TDD

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/capture.js`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/capture.test.js`

- [ ] **Step 1: Write the failing tests**

`src/capture.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractItems, mergeDedupe } from "./capture.js";

test("extractItems pulls id/desc/author/playUrl from itemList", () => {
  const payload = {
    itemList: [
      {
        id: "1",
        desc: "hi",
        createTime: 100,
        author: { uniqueId: "bob" },
        video: { playAddr: "u", cover: "c" },
      },
    ],
  };
  const out = extractItems(payload);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "1");
  assert.equal(out[0].author, "bob");
  assert.equal(out[0].playUrl, "u");
  assert.equal(out[0].cover, "c");
});

test("extractItems handles `items` key and empty payloads", () => {
  assert.deepEqual(extractItems({}), []);
  assert.equal(extractItems({ items: [{ id: "9", video: {} }] }).length, 1);
});

test("extractItems drops entries without an id", () => {
  assert.equal(extractItems({ itemList: [{ desc: "no id" }] }).length, 0);
});

test("mergeDedupe upserts by id and preserves order of first-seen", () => {
  const a = [{ id: "1", desc: "old" }];
  const b = [
    { id: "1", desc: "new" },
    { id: "2", desc: "two" },
  ];
  const merged = mergeDedupe(a, b);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((x) => x.id === "1").desc, "new");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npm test
```

Expected: FAIL — `Cannot find module './capture.js'`.

- [ ] **Step 3: Implement `src/capture.js`**

```js
// Pure functions: extract normalized items from a TikTok item_list payload, and dedupe by id.
export function extractItems(payload) {
  const list = payload?.itemList ?? payload?.items ?? [];
  return list
    .map((it) => ({
      id: it.id ?? it.video?.id ?? null,
      desc: it.desc ?? "",
      createTime: it.createTime ?? null,
      author: it.author?.uniqueId ?? it.author?.unique_id ?? null,
      playUrl: it.video?.playAddr ?? it.video?.downloadAddr ?? null,
      cover: it.video?.cover ?? it.video?.originCover ?? null,
      raw: it,
    }))
    .filter((x) => x.id);
}

export function mergeDedupe(existing, incoming) {
  const byId = new Map(existing.map((x) => [x.id, x]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npm test
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/capture.js src/capture.test.js
git commit -q -m "feat: pure TikTok item extract + dedupe with tests"
```

---

## Task 3: The MV3 capture extension (MAIN-world interceptor + relay + collector)

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/manifest.json`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/main-world.js`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/content.js`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/background.js`

- [ ] **Step 1: Write `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Attic Spike — TikTok Favorites Capture",
  "version": "0.0.1",
  "description": "Throwaway spike: captures the logged-in user's own TikTok Favorites via MAIN-world interception.",
  "permissions": ["storage", "downloads"],
  "host_permissions": [
    "*://*.tiktok.com/*",
    "https://generativelanguage.googleapis.com/*"
  ],
  "background": { "service_worker": "src/background.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["*://*.tiktok.com/*"],
      "js": ["src/main-world.js"],
      "world": "MAIN",
      "run_at": "document_start"
    },
    {
      "matches": ["*://*.tiktok.com/*"],
      "js": ["src/content.js"],
      "world": "ISOLATED",
      "run_at": "document_start"
    }
  ]
}
```

- [ ] **Step 2: Write `src/main-world.js` (MAIN world — no `chrome.*`)**

If Task 1 found a different endpoint path, update the `TARGET` regex accordingly.

```js
// Runs in the page's MAIN world. Skims TikTok's OWN already-signed item_list responses.
(() => {
  const TARGET = /\/api\/(post|favorite|user\/collection)\/item_list/i;

  function emit(url, json) {
    try {
      window.postMessage({ __attic: true, kind: "item_list", url, json }, "*");
    } catch (_) {}
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (url && TARGET.test(url)) {
        res
          .clone()
          .json()
          .then((json) => emit(url, json))
          .catch(() => {});
      }
    } catch (_) {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__atticUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener("load", function () {
      try {
        if (this.__atticUrl && TARGET.test(this.__atticUrl)) {
          emit(this.__atticUrl, JSON.parse(this.responseText));
        }
      } catch (_) {}
    });
    return origSend.apply(this, a);
  };

  console.log("[attic-spike] MAIN-world interceptor installed");
})();
```

- [ ] **Step 3: Write `src/content.js` (ISOLATED — relays + drives scroll)**

```js
// Relays MAIN-world captures to the service worker; Alt+Shift+A starts throttled auto-scroll.
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || e.data.__attic !== true) return;
  if (e.data.kind === "item_list") {
    chrome.runtime.sendMessage({
      kind: "item_list",
      url: e.data.url,
      json: e.data.json,
    });
  }
});

let scrolling = false;
async function autoScroll() {
  if (scrolling) return;
  scrolling = true;
  let lastHeight = 0;
  let stable = 0;
  while (stable < 5) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000)); // human-like jitter
    const h = document.body.scrollHeight;
    if (h === lastHeight) stable++;
    else {
      stable = 0;
      lastHeight = h;
    }
  }
  scrolling = false;
  chrome.runtime.sendMessage({ kind: "scroll_done" });
  console.log("[attic-spike] auto-scroll complete");
}

window.addEventListener("keydown", (e) => {
  if (e.altKey && e.shiftKey && e.code === "KeyA") autoScroll();
});
console.log(
  "[attic-spike] content relay ready — press Alt+Shift+A on the Favorites tab to start",
);
```

- [ ] **Step 4: Write `src/background.js` (service worker — collect/dedupe/export)**

Note: MV3 service workers lack `FileReader`/`URL.createObjectURL`, so the download uses a base64 `data:` URL built with `btoa`.

```js
import { extractItems, mergeDedupe } from "./capture.js";

let items = [];

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.kind === "item_list") {
    const incoming = extractItems(msg.json);
    items = mergeDedupe(items, incoming);
    chrome.storage.local.set({ items, count: items.length });
    console.log(`[attic-spike] +${incoming.length}, total ${items.length}`);
  } else if (msg.kind === "scroll_done") {
    exportItems("attic-favorites.json", items);
  }
  return true;
});

function exportItems(filename, data) {
  const json = JSON.stringify(data, null, 2);
  const dataUrl =
    "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
  chrome.downloads.download({ url: dataUrl, filename });
  console.log(`[attic-spike] exported ${data.length} items → ${filename}`);
}
```

- [ ] **Step 5: Load unpacked and smoke-test the wiring**

In Chrome: `chrome://extensions` → Developer mode → "Load unpacked" → select `/Users/s0shaheen/Dev/attic-extension`. Open any tiktok.com page. In the page console expect `MAIN-world interceptor installed` and `content relay ready`. In the service-worker console (extensions page → "service worker") expect no errors on load.

Expected: both console messages appear; no load errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add manifest.json src/main-world.js src/content.js src/background.js
git commit -q -m "feat: MV3 MAIN-world capture, relay, and SW collector"
```

---

## Task 4: Live capture run + completeness measurement (Spike gate 0.2)

**Empirical gate — not a unit test.** Acceptance = captured count ≥ 95% of visible Favorites, no soft-block.

**Files:**

- Modify: `/Users/s0shaheen/Dev/attic-extension/recon/0.1-findings.md` (append the measured result)

- [ ] **Step 1: Note the ground-truth Favorites count**

On your TikTok profile, open the **Favorites** tab and record the total count shown (or, if not shown, scroll fully once manually and count). Call this `VISIBLE_N`.

- [ ] **Step 2: Run the capture**

Reload the Favorites tab. Open the service-worker console. Press **Alt+Shift+A**. Let it run to completion (it stops after the page height is stable for 5 polls and downloads `attic-favorites.json`). Watch for throttling: empty responses, a captcha, or a "something went wrong" banner.

- [ ] **Step 3: Measure completeness**

```bash
cd ~/Downloads && cat attic-favorites.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
```

Call this `CAPTURED_N`. Compute `CAPTURED_N / VISIBLE_N`.

- [ ] **Step 4: Record the result and apply the kill gate**

Append to `recon/0.1-findings.md`:

```markdown
## 0.2 Capture result

- VISIBLE_N: <n> CAPTURED_N: <n> ratio: <pct>%
- Soft-block observed? : YES/NO (describe)
- GATE: ratio ≥ 95% AND no soft-block → PASS → Task 5. Else → KILL signal (record in 0.8).
```

- [ ] **Step 5: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add recon/0.1-findings.md
git commit -q -m "docs(recon): record 0.2 capture completeness result"
```

**Expected result:** ratio ≥ 95% and no soft-block. If not, this is a kill signal recorded in Task 8.

---

## Task 5: Port the perception prompt + browser→Gemini enrichment (Spike step 0.3)

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/prompts/observe_video.md`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/gemini.js`
- Modify: `/Users/s0shaheen/Dev/attic-extension/src/content.js`
- Modify: `/Users/s0shaheen/Dev/attic-extension/src/background.js`
- Modify: `/Users/s0shaheen/Dev/attic-extension/manifest.json`

- [ ] **Step 1: Copy the prompt verbatim from the old repo**

```bash
cp /Users/s0shaheen/Dev/attic/src/backend/prompts/perception/v2/observe_video.md /Users/s0shaheen/Dev/attic-extension/prompts/observe_video.md
```

- [ ] **Step 2: Expose the prompt as a web-accessible resource**

Add to `manifest.json` (top level, after `content_scripts`):

```json
  ,
  "web_accessible_resources": [
    { "resources": ["prompts/observe_video.md"], "matches": ["*://*.tiktok.com/*"] }
  ]
```

- [ ] **Step 3: Write `src/gemini.js`**

Runs in the tiktok.com content-script context so the video fetch carries the page session. Uses inline base64 (simplest for short videos); items over ~18 MB are skipped and recorded as `too_big_for_inline` (File API fallback is a Phase 1 concern, not a spike blocker).

```js
import { GEMINI_KEY } from "./secrets.js";

const MODEL = "gemini-2.5-flash";

async function fetchVideoBase64(url) {
  const res = await fetch(url, {
    headers: { Referer: "https://www.tiktok.com/" },
  });
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return { b64: btoa(binary), size: bytes.length };
}

export async function enrichItem(item, prompt) {
  if (!item.playUrl) return { id: item.id, error: "no_play_url" };
  let video;
  try {
    video = await fetchVideoBase64(item.playUrl);
  } catch (e) {
    return { id: item.id, error: "video_fetch_failed", detail: String(e) };
  }
  if (video.size > 18 * 1024 * 1024) {
    return { id: item.id, error: "too_big_for_inline", bytes: video.size };
  }
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "video/mp4", data: video.b64 } },
          { text: `${prompt}\n\nCaption: ${item.desc}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
    },
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = await r.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return { id: item.id, desc: item.desc, enrichment: JSON.parse(text) };
  } catch (_) {
    return {
      id: item.id,
      error: "parse_fail",
      raw: (text || JSON.stringify(json)).slice(0, 800),
    };
  }
}
```

- [ ] **Step 4: Wire an `Alt+Shift+E` enrich trigger into `src/content.js`**

Add this import at the top of `src/content.js`:

```js
import { enrichItem } from "./gemini.js";
```

Then add this handler (append to the file):

```js
async function runEnrichment() {
  const promptUrl = chrome.runtime.getURL("prompts/observe_video.md");
  const prompt = await (await fetch(promptUrl)).text();
  const { items = [] } = await chrome.storage.local.get("items");
  const subset = items.slice(0, 20);
  console.log(`[attic-spike] enriching ${subset.length} items…`);
  const results = [];
  for (const item of subset) {
    const out = await enrichItem(item, prompt);
    results.push(out);
    console.log(
      `[attic-spike] enriched ${out.id}`,
      out.error ? `ERROR ${out.error}` : "ok",
    );
    await new Promise((r) => setTimeout(r, 1200)); // pacing
  }
  chrome.runtime.sendMessage({ kind: "export_enriched", results });
}

window.addEventListener("keydown", (e) => {
  if (e.altKey && e.shiftKey && e.code === "KeyE") runEnrichment();
});
```

Because `content.js` now uses `import`, change its registration in `manifest.json` to a module. Replace the ISOLATED content-script entry with:

```json
{
  "matches": ["*://*.tiktok.com/*"],
  "js": ["src/content.js"],
  "world": "ISOLATED",
  "run_at": "document_start",
  "type": "module"
}
```

> If Chrome rejects `"type": "module"` on a content script in your Chrome version, fall back to a dynamic import inside `content.js`: `const { enrichItem } = await import(chrome.runtime.getURL("src/gemini.js"));` and add `src/gemini.js` + `src/secrets.js` to `web_accessible_resources`. Record which path worked in `results/0.4-value-test.md`.

- [ ] **Step 5: Handle the enriched export in `src/background.js`**

Add to the `onMessage` listener (a new `else if` branch before `return true;`):

```js
  else if (msg.kind === "export_enriched") {
    exportItems("attic-enriched.json", msg.results);
  }
```

- [ ] **Step 6: Reload the extension and commit**

Reload at `chrome://extensions`. Then:

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add manifest.json prompts/observe_video.md src/gemini.js src/content.js src/background.js
git commit -q -m "feat: browser→Gemini enrichment with ported observe_video prompt"
```

---

## Task 6: Enrichment run + validity measurement (Spike gate 0.3)

**Empirical gate.** Acceptance = ≥ ~80% of the 20 items return valid parsed JSON with a non-empty `entities`/transcript payload.

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/results/0.4-value-test.md` (start it here; value test appended in Task 7)

- [ ] **Step 1: Ensure the key is set**

```bash
cd /Users/s0shaheen/Dev/attic-extension && test -f src/secrets.js && echo "secrets.js present" || echo "MISSING: cp src/secrets.example.js src/secrets.js and paste key"
```

Expected: `secrets.js present`.

- [ ] **Step 2: Run enrichment**

On your TikTok Favorites tab (with items already captured from Task 4), press **Alt+Shift+E**. Watch the page console for per-item `ok`/`ERROR` lines. It downloads `attic-enriched.json` when done.

- [ ] **Step 3: Measure validity**

```bash
cd ~/Downloads && python3 -c "
import json
d = json.load(open('attic-enriched.json'))
ok = [x for x in d if x.get('enrichment')]
errs = {}
for x in d:
    if x.get('error'): errs[x['error']] = errs.get(x['error'],0)+1
withent = [x for x in ok if x['enrichment'].get('entities')]
print(f'total={len(d)} valid_json={len(ok)} with_entities={len(withent)} errors={errs}')
"
```

- [ ] **Step 4: Record result and apply the kill gate**

Create `results/0.4-value-test.md`:

```markdown
# 0.3 Enrichment validity

- total: <n> valid_json: <n> with_entities: <n> errors: <dict>
- video_fetch worked from extension? : YES/NO (key risk — note any `video_fetch_failed`/`too_big_for_inline`)
- GATE: valid_json ≥ 80% of attempted AND video fetch worked → PASS → Task 7.
  If video fetch is blocked, note the fallback (thumbnail+caption-only) and reassess in 0.8.

# 0.4 Value test (filled in Task 7)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add results/0.4-value-test.md
git commit -q -m "docs(results): record 0.3 enrichment validity"
```

**Expected result:** ≥ 80% valid JSON and the video fetch succeeded. A blocked video fetch is the key risk this task exists to surface — record it precisely.

---

## Task 7: Value test with real people (Spike gate 0.4)

**Empirical gate with humans.** Acceptance = a clear majority find the enriched export materially faster/better than raw + ChatGPT for a real retrieval task.

**Files:**

- Modify: `/Users/s0shaheen/Dev/attic-extension/results/0.4-value-test.md`

- [ ] **Step 1: Prepare the two artifacts**

Artifact A = `attic-enriched.json` (from Task 6). Artifact B = the raw captured `attic-favorites.json` (or a raw TikTok data export) the tester pastes into ChatGPT/Claude.

- [ ] **Step 2: Run the protocol with 5 people**

For each tester, give them one real retrieval task (e.g., "find a restaurant / recipe / product you'd want from this saved set"). Have them try it once with Artifact A (the enriched export, in their LLM) and once with Artifact B (raw, in their LLM). Randomize order. Record: which was faster, which gave the better answer, and a 1-sentence reaction.

- [ ] **Step 3: Record results + decision under the `# 0.4 Value test` heading**

```markdown
## 0.4 Value test results (N=5)

| Tester | Faster (A/B) | Better answer (A/B) | Reaction |
| ------ | ------------ | ------------------- | -------- |
| 1      |              |                     |          |
| 2      |              |                     |          |
| 3      |              |                     |          |
| 4      |              |                     |          |
| 5      |              |                     |          |

- GATE: majority prefer A (enriched) on speed AND answer quality → PASS.
  If raw+ChatGPT is "good enough" for most → KILL/PIVOT (ship pure exporter or stop).
```

- [ ] **Step 4: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add results/0.4-value-test.md
git commit -q -m "docs(results): record 0.4 value-test outcomes"
```

**Expected result:** majority prefer the enriched export. Otherwise the AI moat is unproven — recorded as a kill/pivot in Task 8.

---

## Task 8: Spike decision (go / kill) against all kill criteria

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/results/0.8-spike-decision.md`

- [ ] **Step 1: Aggregate the three gates**

Write `results/0.8-spike-decision.md`:

```markdown
# Phase 0 Spike Decision

| Gate        | Criterion                                 | Result            | Pass? |
| ----------- | ----------------------------------------- | ----------------- | ----- |
| 0.2 capture | ≥95% of Favorites, no soft-block          | <ratio>, <block?> | ☐     |
| 0.3 enrich  | ≥80% valid JSON + video fetch works       | <numbers>         | ☐     |
| 0.4 value   | majority prefer enriched over raw+ChatGPT | <tally>           | ☐     |

## Decision

- [ ] ALL THREE PASS → PROCEED to Phase 1. Next: re-run brainstorming/writing-plans on sub-project #1 (Scraper) and #2 (MV3 shell + resumable queue) from the design spec.
- [ ] ANY FAIL → STOP / PIVOT. Record which gate failed and the pivot implication (e.g. Mode B data-export import if scrape blocked; pure exporter if value unproven).

## Notes / surprises

<free text — anything learned that should reshape the Phase 1 architecture>
```

- [ ] **Step 2: Fill in each gate from the recorded results and check the boxes**

Pull the numbers from `recon/0.1-findings.md` and `results/0.4-value-test.md`. Make the explicit PROCEED/STOP call.

- [ ] **Step 3: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add results/0.8-spike-decision.md
git commit -q -m "docs(results): Phase 0 spike go/kill decision"
```

**Expected result:** a single, explicit, evidence-backed PROCEED or STOP decision — the entire purpose of Phase 0.

---

## Self-Review

**Spec coverage:** Phase 0 steps 0.1–0.4 → Tasks 1, 3+4, 5+6, 7; kill criteria → gates in Tasks 4/6/7 and aggregated in Task 8; "reuse founder's own key + existing prompts, zero new infra" → Task 5 copies `observe_video.md`, uses `secrets.js`, no proxy/billing/licensing built (correctly out of scope for the spike). Phase 1 architecture, pricing, store-policy, licensing, Mode B import → intentionally **not** in this plan (gated behind the spike passing). No spec Phase-0 requirement is unaddressed.

**Placeholder scan:** No "TBD/TODO/handle edge cases" — every code step shows complete code; manual steps show the exact template to fill. The two `<...>` markers are result-recording blanks in deliverable templates (intended to be filled at runtime), not implementation placeholders.

**Type consistency:** `extractItems`/`mergeDedupe` signatures match across `capture.js`, its tests, and `background.js`. The item shape (`id`, `desc`, `author`, `playUrl`, `cover`, `createTime`, `raw`) is consistent from `capture.js` through `gemini.js` (`item.playUrl`, `item.desc`, `item.id`). Message `kind` values (`item_list`, `scroll_done`, `export_enriched`) match between `content.js`/`background.js`. The `enrichItem(item, prompt)` signature matches its call site in `content.js`.
