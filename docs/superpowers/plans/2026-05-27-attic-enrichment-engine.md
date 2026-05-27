# Attic Enrichment + Entity Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-agnostic TypeScript engine that turns captured TikTok items into enriched items + a cross-item entity index + JSON/CSV/Obsidian exports — fully unit-tested against a committed real-shaped fixture, with the two browser-bound boundaries (media fetch, Gemini call) validated by live smoke tests reusing spike-proven code.

**Architecture:** Pure transform modules (`types`, `ontology`, `entities`, `prompts`, `exporters`) are TDD'd with Vitest against a committed fixture. The `geminiClient` parse/format logic is unit-tested with canned responses (no network). The `enrich` orchestrator is unit-tested with mocked dependencies (Gemini call, media fetch, subtitle fetch injected). The browser-only `mediaFetch` (credentialed CORS + Range + DNR Referer) reuses the spike's proven mechanism and is validated by an in-extension smoke run, not a unit test. Output: given an array of `CapturedItem`, produce enriched items + entity index + all three export formats.

**Tech Stack:** TypeScript (strict), Vitest, Node ≥20. Repo: `/Users/s0shaheen/Dev/attic-extension` (Phase 1 engine lives under `src/lib/`, framework-agnostic so the later WXT MV3-shell sub-project imports it unchanged). Gemini API (`gemini-2.5-flash`) for live smoke only, founder's BYO key via the existing `src/secrets.js`.

**Spec:** `docs/superpowers/specs/2026-05-27-attic-enrichment-entities-design.md` (in the `attic` repo). **Out of scope (own follow-on plans):** the entity-aware Library UI (needs MV3 shell + IndexedDB storage sub-projects), the offscreen-doc/SW lifecycle wiring, licensing, Instagram.

---

## File Structure

New/added files in `/Users/s0shaheen/Dev/attic-extension`:

```
package.json              # MODIFY: add typescript, vitest; add scripts
tsconfig.json             # CREATE: strict TS config
vitest.config.ts          # CREATE: vitest config (node env)
fixtures/
  sample-items.json       # CREATE: ~6 hand-built CapturedItem records (committed, deterministic)
src/lib/
  types.ts                # CREATE: CapturedItem, Entity, EnrichedItem, EntityIndexEntry, etc.
  ontology.ts             # CREATE: entity-type + facet label sets (thinned port)
  entities.ts             # CREATE: normalizeEntity, dedupeEntities, buildEntityIndex
  entities.test.ts        # CREATE
  prompts.ts              # CREATE: buildTextPrompt / buildVisualPrompt / buildSlideshowPrompt
  prompts.test.ts         # CREATE
  geminiClient.ts         # CREATE: buildInlineBody, buildMediaBody, parseGeminiResponse
  geminiClient.test.ts    # CREATE
  enrich.ts               # CREATE: enrichItem orchestrator + mergeVisualIntoText (deps injected)
  enrich.test.ts          # CREATE
  exporters/
    json.ts               # CREATE: toJsonBundle
    json.test.ts          # CREATE
    csv.ts                # CREATE: toItemsCsv, toEntitiesCsv
    csv.test.ts           # CREATE
    obsidian.ts           # CREATE: toObsidianVault
    obsidian.test.ts      # CREATE
  mediaFetch.ts           # CREATE: fetchVideoBytes / fetchSlideshowImages (browser-only; live-smoke)
prompts/
  observe_video.text.md   # CREATE: text-tier prompt variant (derived from observe_video.md)
  observe_video.visual.md # CREATE: visual-tier prompt (the existing observe_video.md, renamed role)
  observe_video.slideshow.md # CREATE: slideshow image prompt
scripts/
  run-engine-smoke.mjs    # CREATE: live integration smoke over the full local fixture
```

The plan document stays in the `attic` repo (`docs/superpowers/plans/`).

---

## Task 0: Tooling + committed fixture

**Files:**

- Modify: `/Users/s0shaheen/Dev/attic-extension/package.json`
- Create: `/Users/s0shaheen/Dev/attic-extension/tsconfig.json`
- Create: `/Users/s0shaheen/Dev/attic-extension/vitest.config.ts`
- Create: `/Users/s0shaheen/Dev/attic-extension/fixtures/sample-items.json`

- [ ] **Step 1: Install dev dependencies**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npm install -D typescript@^5.5 vitest@^2.0 @types/node@^20
```

- [ ] **Step 2: Add scripts to `package.json`**

Merge these into the existing `"scripts"` block (keep the existing `"test": "node --test"` as `"test:spike"`):

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:spike": "node --test",
    "typecheck": "tsc --noEmit"
  }
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "scripts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create `fixtures/sample-items.json`**

Six records matching the spike's `normalizeItem` output shape. Covers: has-subtitles, no-subtitles, slideshow, and two items sharing one restaurant (for dedupe), one with no author.

```json
[
  {
    "id": "7001",
    "desc": "best pasta in brooklyn 🍝 #pasta #brooklyn",
    "createTime": 1710253380,
    "author": "foodietravels",
    "authorName": "Foodie Travels",
    "url": "https://www.tiktok.com/@foodietravels/video/7001",
    "playUrl": "https://v.tiktokcdn.com/7001/video/tos.mp4",
    "downloadUrl": "https://v.tiktokcdn.com/7001/dl.mp4",
    "cover": "https://p.tiktokcdn.com/7001.jpg",
    "durationSec": 42,
    "hasSubtitles": true,
    "subtitleUrl": "https://v.tiktokcdn.com/7001/sub-eng.webvtt",
    "isSlideshow": false,
    "music": { "name": "original sound", "author": "foodietravels" },
    "hashtags": ["pasta", "brooklyn"],
    "stats": {
      "plays": 1000,
      "likes": 80,
      "comments": 5,
      "shares": 2,
      "collects": 10
    }
  },
  {
    "id": "7002",
    "desc": "lilia is still the best date spot in williamsburg",
    "createTime": 1710339780,
    "author": "nyceats",
    "authorName": "NYC Eats",
    "url": "https://www.tiktok.com/@nyceats/video/7002",
    "playUrl": "https://v.tiktokcdn.com/7002/video/tos.mp4",
    "downloadUrl": null,
    "cover": "https://p.tiktokcdn.com/7002.jpg",
    "durationSec": 18,
    "hasSubtitles": false,
    "subtitleUrl": null,
    "isSlideshow": false,
    "music": null,
    "hashtags": ["nyc", "datenight"],
    "stats": {
      "plays": 500,
      "likes": 40,
      "comments": 1,
      "shares": 0,
      "collects": 7
    }
  },
  {
    "id": "7003",
    "desc": "5 books that changed how I think",
    "createTime": 1710426180,
    "author": "readwithme",
    "authorName": "Read With Me",
    "url": "https://www.tiktok.com/@readwithme/video/7003",
    "playUrl": null,
    "downloadUrl": null,
    "cover": "https://p.tiktokcdn.com/7003.jpg",
    "durationSec": null,
    "hasSubtitles": false,
    "subtitleUrl": null,
    "isSlideshow": true,
    "music": { "name": "lofi beats", "author": "dj" },
    "hashtags": ["books", "reading"],
    "stats": {
      "plays": 200,
      "likes": 30,
      "comments": 3,
      "shares": 1,
      "collects": 4
    }
  },
  {
    "id": "7004",
    "desc": "30 min full body workout no equipment",
    "createTime": 1710512580,
    "author": "fitdaily",
    "authorName": "Fit Daily",
    "url": "https://www.tiktok.com/@fitdaily/video/7004",
    "playUrl": "https://v.tiktokcdn.com/7004/video/tos.mp4",
    "downloadUrl": null,
    "cover": "https://p.tiktokcdn.com/7004.jpg",
    "durationSec": 65,
    "hasSubtitles": true,
    "subtitleUrl": "https://v.tiktokcdn.com/7004/sub-eng.webvtt",
    "isSlideshow": false,
    "music": null,
    "hashtags": ["workout", "fitness"],
    "stats": {
      "plays": 9000,
      "likes": 700,
      "comments": 40,
      "shares": 25,
      "collects": 120
    }
  },
  {
    "id": "7005",
    "desc": "Lilia in Williamsburg — get the cacio e pepe",
    "createTime": 1710598980,
    "author": "foodietravels",
    "authorName": "Foodie Travels",
    "url": "https://www.tiktok.com/@foodietravels/video/7005",
    "playUrl": "https://v.tiktokcdn.com/7005/video/tos.mp4",
    "downloadUrl": null,
    "cover": "https://p.tiktokcdn.com/7005.jpg",
    "durationSec": 27,
    "hasSubtitles": false,
    "subtitleUrl": null,
    "isSlideshow": false,
    "music": null,
    "hashtags": ["pasta", "nyc"],
    "stats": {
      "plays": 1500,
      "likes": 95,
      "comments": 8,
      "shares": 4,
      "collects": 22
    }
  },
  {
    "id": "7006",
    "desc": "no author edge case",
    "createTime": null,
    "author": null,
    "authorName": null,
    "url": null,
    "playUrl": null,
    "downloadUrl": null,
    "cover": null,
    "durationSec": null,
    "hasSubtitles": false,
    "subtitleUrl": null,
    "isSlideshow": false,
    "music": null,
    "hashtags": [],
    "stats": {
      "plays": null,
      "likes": null,
      "comments": null,
      "shares": null,
      "collects": null
    }
  }
]
```

- [ ] **Step 6: Verify tooling runs**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run
```

Expected: Vitest runs and reports "No test files found" (no `*.test.ts` yet) — exits cleanly.

- [ ] **Step 7: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add package.json package-lock.json tsconfig.json vitest.config.ts fixtures/sample-items.json
git commit -m "chore: add TS+Vitest tooling and committed enrichment fixture"
```

---

## Task 1: Core types + ontology

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/types.ts`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/ontology.ts`

No tests here — these are pure type/const declarations exercised by later tasks' tests. Typecheck is the gate.

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
// Shapes shared across the enrichment engine. CapturedItem matches the spike's normalizeItem output.

export interface CapturedItem {
  id: string;
  desc: string;
  createTime: number | null;
  author: string | null;
  authorName: string | null;
  url: string | null;
  playUrl: string | null;
  downloadUrl: string | null;
  cover: string | null;
  durationSec: number | null;
  hasSubtitles: boolean;
  subtitleUrl: string | null;
  isSlideshow: boolean;
  music: { name: string | null; author: string | null } | null;
  hashtags: string[];
  stats: {
    plays: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    collects: number | null;
  };
}

export type EntityType =
  | "place"
  | "restaurant"
  | "product"
  | "book"
  | "media"
  | "recipe"
  | "person"
  | "brand"
  | "link"
  | "other";

export interface Entity {
  type: EntityType;
  name: string;
  raw: string;
  specs?: Record<string, string>;
}

export type EnrichmentTier = "raw" | "text" | "visual";

export interface Enrichment {
  tier: EnrichmentTier;
  transcript?: string;
  on_screen_text?: string[];
  entities: Entity[];
  takeaways: string[];
  structured_content?: Record<string, unknown>;
  facets?: { topic?: string; genre?: string; affect?: string };
  error?: string;
}

export interface EnrichedItem extends CapturedItem {
  enrichment: Enrichment;
}

export interface EntityIndexEntry {
  key: string; // `${type}:${normalizedName}`
  type: EntityType;
  name: string; // chosen display name
  itemIds: string[]; // first-seen order, deduped
}

// Result-object convention (matches the parent codebase) — engine functions never throw for expected failures.
export type GeminiResult =
  | { ok: true; enrichment: Omit<Enrichment, "tier"> }
  | { ok: false; error: string };
```

- [ ] **Step 2: Create `src/lib/ontology.ts`**

```ts
// Thinned port of the ontology — the entity types the prompt may emit and the secondary facet vocab.
import type { EntityType } from "./types.js";

export const ENTITY_TYPES: readonly EntityType[] = [
  "place",
  "restaurant",
  "product",
  "book",
  "media",
  "recipe",
  "person",
  "brand",
  "link",
  "other",
] as const;

export const FACET_TOPICS = [
  "food",
  "travel",
  "fitness",
  "fashion",
  "tech",
  "finance",
  "home",
  "entertainment",
  "education",
  "other",
] as const;

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx tsc --noEmit
```

Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/lib/types.ts src/lib/ontology.ts
git commit -m "feat(engine): core types + thinned ontology"
```

---

## Task 2: Entity normalization, dedupe, and cross-item index — TDD

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/entities.ts`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/lib/entities.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/entities.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import {
  normalizeName,
  entityKey,
  dedupeEntities,
  buildEntityIndex,
} from "./entities.js";
import type { EnrichedItem, Entity } from "./types.js";

describe("normalizeName", () => {
  test("casefolds, trims, collapses whitespace", () => {
    expect(normalizeName("  Lilia  ")).toBe("lilia");
    expect(normalizeName("The   French   Laundry")).toBe("french laundry");
  });
  test("strips leading @ and 'the'", () => {
    expect(normalizeName("@gordonramsay")).toBe("gordonramsay");
    expect(normalizeName("The Bear")).toBe("bear");
  });
});

describe("entityKey", () => {
  test("combines type and normalized name", () => {
    expect(entityKey({ type: "restaurant", name: "Lilia", raw: "Lilia" })).toBe(
      "restaurant:lilia",
    );
  });
  test("same name, different type → different keys", () => {
    const a = entityKey({ type: "place", name: "Rome", raw: "Rome" });
    const b = entityKey({ type: "media", name: "Rome", raw: "Rome" });
    expect(a).not.toBe(b);
  });
});

describe("dedupeEntities", () => {
  test("collapses same-key entities within one item, keeping first raw + merging specs", () => {
    const ents: Entity[] = [
      {
        type: "restaurant",
        name: "Lilia",
        raw: "Lilia",
        specs: { neighborhood: "Williamsburg" },
      },
      {
        type: "restaurant",
        name: "lilia ",
        raw: "Lilia in Brooklyn",
        specs: { city: "Brooklyn" },
      },
    ];
    const out = dedupeEntities(ents);
    expect(out).toHaveLength(1);
    expect(out[0]!.raw).toBe("Lilia");
    expect(out[0]!.specs).toEqual({
      neighborhood: "Williamsburg",
      city: "Brooklyn",
    });
  });
});

describe("buildEntityIndex", () => {
  const mk = (id: string, ents: Entity[]): EnrichedItem =>
    ({
      id,
      enrichment: { tier: "text", entities: ents, takeaways: [] },
    }) as unknown as EnrichedItem;

  test("same entity across items → one entry with all item ids in first-seen order", () => {
    const items = [
      mk("7001", [{ type: "restaurant", name: "Lilia", raw: "Lilia" }]),
      mk("7005", [
        { type: "restaurant", name: "lilia", raw: "Lilia in Williamsburg" },
      ]),
    ];
    const index = buildEntityIndex(items);
    const lilia = index.find((e) => e.key === "restaurant:lilia");
    expect(lilia).toBeTruthy();
    expect(lilia!.itemIds).toEqual(["7001", "7005"]);
    expect(lilia!.name).toBe("Lilia");
  });

  test("does not duplicate an item id when an entity appears twice in the same item", () => {
    const items = [
      mk("7001", [
        { type: "book", name: "Dune", raw: "Dune" },
        { type: "book", name: "dune", raw: "Dune (1965)" },
      ]),
    ];
    const index = buildEntityIndex(items);
    expect(index.find((e) => e.key === "book:dune")!.itemIds).toEqual(["7001"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/entities.test.ts
```

Expected: FAIL — `Cannot find module './entities.js'`.

- [ ] **Step 3: Implement `src/lib/entities.ts`**

```ts
import type { Entity, EnrichedItem, EntityIndexEntry } from "./types.js";

export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^@/, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}

export function entityKey(entity: Pick<Entity, "type" | "name">): string {
  return `${entity.type}:${normalizeName(entity.name)}`;
}

export function dedupeEntities(entities: Entity[]): Entity[] {
  const byKey = new Map<string, Entity>();
  for (const e of entities) {
    const key = entityKey(e);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...e, specs: e.specs ? { ...e.specs } : undefined });
    } else if (e.specs) {
      existing.specs = { ...(existing.specs ?? {}), ...e.specs };
    }
  }
  return [...byKey.values()];
}

export function buildEntityIndex(items: EnrichedItem[]): EntityIndexEntry[] {
  const byKey = new Map<string, EntityIndexEntry>();
  for (const item of items) {
    for (const e of dedupeEntities(item.enrichment?.entities ?? [])) {
      const key = entityKey(e);
      let entry = byKey.get(key);
      if (!entry) {
        entry = { key, type: e.type, name: e.name, itemIds: [] };
        byKey.set(key, entry);
      }
      if (!entry.itemIds.includes(item.id)) entry.itemIds.push(item.id);
    }
  }
  return [...byKey.values()];
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/entities.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/lib/entities.ts src/lib/entities.test.ts
git commit -m "feat(engine): entity normalize/dedupe + cross-item index with tests"
```

---

## Task 3: Prompt assembly — TDD

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/prompts/observe_video.text.md`
- Create: `/Users/s0shaheen/Dev/attic-extension/prompts/observe_video.visual.md`
- Create: `/Users/s0shaheen/Dev/attic-extension/prompts/observe_video.slideshow.md`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/prompts.ts`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/lib/prompts.test.ts`

`prompts.ts` assembles the per-item user content appended to a base prompt; the base prompt text is passed in by the caller (loaded from the `.md` files at runtime) so the pure function stays testable without filesystem access.

- [ ] **Step 1: Create the three prompt files**

`prompts/observe_video.visual.md` — copy the existing spike prompt verbatim:

```bash
cd /Users/s0shaheen/Dev/attic-extension && cp prompts/observe_video.md prompts/observe_video.visual.md
```

`prompts/observe_video.text.md` (text-tier — no frames, works from caption + subtitles):

```markdown
You analyze a saved short-form video using ONLY its text metadata (caption, hashtags) and its
subtitle transcript. You CANNOT see the video. Do not invent on-screen visuals.

Return STRICT JSON:
{
"transcript": "<the subtitle text, lightly cleaned; empty string if none>",
"entities": [{ "type": "<place|restaurant|product|book|media|recipe|person|brand|link|other>",
"name": "<canonical name>", "raw": "<as mentioned>", "specs": { } }],
"takeaways": ["<1-5 concise, useful takeaways>"],
"facets": { "topic": "<one topic>", "genre": "<one genre>", "affect": "<one affect>" }
}
Only include entities actually supported by the text. Prefer precision over recall.
```

`prompts/observe_video.slideshow.md`:

```markdown
You analyze a saved image slideshow (carousel). You are given the slide images and the caption.

Return STRICT JSON with the same schema as the video analyzer:
{ "on_screen_text": ["<text visible across slides>"],
"entities": [{ "type": "...", "name": "...", "raw": "...", "specs": { } }],
"takeaways": ["..."],
"facets": { "topic": "...", "genre": "...", "affect": "..." } }
Only include entities actually supported by the slides or caption.
```

- [ ] **Step 2: Write the failing tests**

`src/lib/prompts.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import {
  buildTextPrompt,
  buildVisualPrompt,
  buildSlideshowPrompt,
} from "./prompts.js";
import type { CapturedItem } from "./types.js";

const base: CapturedItem = {
  id: "7001",
  desc: "best pasta in brooklyn",
  createTime: 1,
  author: "foodietravels",
  authorName: "Foodie Travels",
  url: "https://www.tiktok.com/@foodietravels/video/7001",
  playUrl: "u",
  downloadUrl: null,
  cover: null,
  durationSec: 42,
  hasSubtitles: true,
  subtitleUrl: "s",
  isSlideshow: false,
  music: null,
  hashtags: ["pasta", "brooklyn"],
  stats: {
    plays: null,
    likes: null,
    comments: null,
    shares: null,
    collects: null,
  },
};

describe("buildTextPrompt", () => {
  test("includes base prompt, caption, hashtags, and subtitle text", () => {
    const out = buildTextPrompt(
      "BASE_TEXT_PROMPT",
      base,
      "Welcome to Brooklyn pasta.",
    );
    expect(out).toContain("BASE_TEXT_PROMPT");
    expect(out).toContain("best pasta in brooklyn");
    expect(out).toContain("#pasta #brooklyn");
    expect(out).toContain("Welcome to Brooklyn pasta.");
  });
  test("omits the subtitle section when there is no transcript", () => {
    const out = buildTextPrompt("BASE", { ...base, hasSubtitles: false }, "");
    expect(out).not.toMatch(/Subtitles:/);
  });
});

describe("buildVisualPrompt", () => {
  test("appends caption to the base visual prompt", () => {
    const out = buildVisualPrompt("BASE_VISUAL", base);
    expect(out).toContain("BASE_VISUAL");
    expect(out).toContain("best pasta in brooklyn");
  });
});

describe("buildSlideshowPrompt", () => {
  test("appends caption to the base slideshow prompt", () => {
    const out = buildSlideshowPrompt("BASE_SLIDE", base);
    expect(out).toContain("BASE_SLIDE");
    expect(out).toContain("best pasta in brooklyn");
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/prompts.test.ts
```

Expected: FAIL — `Cannot find module './prompts.js'`.

- [ ] **Step 4: Implement `src/lib/prompts.ts`**

```ts
import type { CapturedItem } from "./types.js";

function captionBlock(item: CapturedItem): string {
  const tags = item.hashtags.length
    ? `\nHashtags: ${item.hashtags.map((t) => `#${t}`).join(" ")}`
    : "";
  return `Caption: ${item.desc}${tags}`;
}

export function buildTextPrompt(
  basePrompt: string,
  item: CapturedItem,
  transcript: string,
): string {
  const subs = transcript.trim() ? `\n\nSubtitles:\n${transcript.trim()}` : "";
  return `${basePrompt}\n\n${captionBlock(item)}${subs}`;
}

export function buildVisualPrompt(
  basePrompt: string,
  item: CapturedItem,
): string {
  return `${basePrompt}\n\n${captionBlock(item)}`;
}

export function buildSlideshowPrompt(
  basePrompt: string,
  item: CapturedItem,
): string {
  return `${basePrompt}\n\n${captionBlock(item)}`;
}
```

- [ ] **Step 5: Run to verify pass**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/prompts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add prompts/observe_video.text.md prompts/observe_video.visual.md prompts/observe_video.slideshow.md src/lib/prompts.ts src/lib/prompts.test.ts
git commit -m "feat(engine): tier prompt variants + prompt assembly with tests"
```

---

## Task 4: Gemini request builders + response parsing — TDD (no network)

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/geminiClient.ts`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/lib/geminiClient.test.ts`

The network call itself is thin and smoke-tested in Task 9. Here we unit-test the pure parts: building the request body and parsing the response into a `GeminiResult`.

- [ ] **Step 1: Write the failing tests**

`src/lib/geminiClient.test.ts`:

````ts
import { describe, test, expect } from "vitest";
import {
  buildTextBody,
  buildMediaBody,
  parseGeminiResponse,
} from "./geminiClient.js";

describe("buildTextBody", () => {
  test("wraps the prompt as a single text part with JSON response config", () => {
    const body = buildTextBody("HELLO");
    expect(body.contents[0]!.parts[0]).toEqual({ text: "HELLO" });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });
});

describe("buildMediaBody", () => {
  test("includes inline media parts before the prompt text", () => {
    const body = buildMediaBody("PROMPT", [
      { mimeType: "video/mp4", data: "QkFTRTY0" },
    ]);
    expect(body.contents[0]!.parts[0]).toEqual({
      inlineData: { mimeType: "video/mp4", data: "QkFTRTY0" },
    });
    expect(body.contents[0]!.parts.at(-1)).toEqual({ text: "PROMPT" });
  });
});

describe("parseGeminiResponse", () => {
  const wrap = (text: string) => ({
    candidates: [{ content: { parts: [{ text }] } }],
  });

  test("parses valid JSON enrichment", () => {
    const res = parseGeminiResponse(
      wrap(
        JSON.stringify({ transcript: "hi", entities: [], takeaways: ["a"] }),
      ),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enrichment.transcript).toBe("hi");
      expect(res.enrichment.takeaways).toEqual(["a"]);
    }
  });

  test("strips ```json fences before parsing", () => {
    const res = parseGeminiResponse(
      wrap('```json\n{"entities":[],"takeaways":[]}\n```'),
    );
    expect(res.ok).toBe(true);
  });

  test("returns parse_fail on non-JSON", () => {
    const res = parseGeminiResponse(wrap("not json at all"));
    expect(res).toEqual({ ok: false, error: "parse_fail" });
  });

  test("returns empty_response when no candidate text", () => {
    expect(parseGeminiResponse({})).toEqual({
      ok: false,
      error: "empty_response",
    });
  });

  test("defaults missing entities/takeaways to empty arrays", () => {
    const res = parseGeminiResponse(wrap(JSON.stringify({ transcript: "x" })));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enrichment.entities).toEqual([]);
      expect(res.enrichment.takeaways).toEqual([]);
    }
  });
});
````

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/geminiClient.test.ts
```

Expected: FAIL — `Cannot find module './geminiClient.js'`.

- [ ] **Step 3: Implement `src/lib/geminiClient.ts`**

````ts
import type { GeminiResult, Entity } from "./types.js";

export interface MediaPart {
  mimeType: string;
  data: string; // base64
}

interface GeminiBody {
  contents: { parts: Array<{ text: string } | { inlineData: MediaPart }> }[];
  generationConfig: {
    temperature: number;
    responseMimeType: string;
    maxOutputTokens: number;
  };
}

const GEN_CONFIG = {
  temperature: 0.2,
  responseMimeType: "application/json",
  maxOutputTokens: 16384,
};

export function buildTextBody(prompt: string): GeminiBody {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: GEN_CONFIG,
  };
}

export function buildMediaBody(prompt: string, media: MediaPart[]): GeminiBody {
  const parts = [...media.map((m) => ({ inlineData: m })), { text: prompt }];
  return { contents: [{ parts }], generationConfig: GEN_CONFIG };
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseGeminiResponse(json: unknown): GeminiResult {
  const text = (
    json as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  )?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "empty_response" };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    return { ok: false, error: "parse_fail" };
  }
  return {
    ok: true,
    enrichment: {
      transcript:
        typeof parsed.transcript === "string" ? parsed.transcript : undefined,
      on_screen_text: Array.isArray(parsed.on_screen_text)
        ? (parsed.on_screen_text as string[])
        : undefined,
      entities: Array.isArray(parsed.entities)
        ? (parsed.entities as Entity[])
        : [],
      takeaways: Array.isArray(parsed.takeaways)
        ? (parsed.takeaways as string[])
        : [],
      structured_content:
        parsed.structured_content &&
        typeof parsed.structured_content === "object"
          ? (parsed.structured_content as Record<string, unknown>)
          : undefined,
      facets:
        parsed.facets && typeof parsed.facets === "object"
          ? (parsed.facets as {
              topic?: string;
              genre?: string;
              affect?: string;
            })
          : undefined,
    },
  };
}
````

- [ ] **Step 4: Run to verify pass**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/geminiClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/lib/geminiClient.ts src/lib/geminiClient.test.ts
git commit -m "feat(engine): Gemini request builders + response parsing with tests"
```

---

## Task 5: Enrichment orchestrator (tier logic, merge, status) — TDD with injected deps

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/enrich.ts`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/lib/enrich.test.ts`

The orchestrator takes its side-effecting dependencies (call Gemini, fetch subtitles, fetch media) as an injected object so it is fully unit-testable with fakes.

- [ ] **Step 1: Write the failing tests**

`src/lib/enrich.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { enrichItem, mergeVisualIntoText, type EnrichDeps } from "./enrich.js";
import type { CapturedItem, GeminiResult } from "./types.js";

const item: CapturedItem = {
  id: "7001",
  desc: "best pasta in brooklyn",
  createTime: 1,
  author: "foodietravels",
  authorName: null,
  url: null,
  playUrl: "https://cdn/7001.mp4",
  downloadUrl: null,
  cover: null,
  durationSec: 42,
  hasSubtitles: true,
  subtitleUrl: "https://cdn/7001.vtt",
  isSlideshow: false,
  music: null,
  hashtags: ["pasta"],
  stats: {
    plays: null,
    likes: null,
    comments: null,
    shares: null,
    collects: null,
  },
};

const okText: GeminiResult = {
  ok: true,
  enrichment: {
    transcript: "welcome to brooklyn",
    entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }],
    takeaways: ["go to lilia"],
  },
};

function deps(over: Partial<EnrichDeps> = {}): EnrichDeps {
  return {
    callGemini: async () => okText,
    fetchSubtitles: async () => "welcome to brooklyn",
    fetchMedia: async () => [{ mimeType: "video/mp4", data: "QkFTRTY0" }],
    basePrompts: { text: "TEXT", visual: "VISUAL", slideshow: "SLIDE" },
    ...over,
  };
}

describe("enrichItem — text tier", () => {
  test("produces a text-tier enriched item with entities", async () => {
    const out = await enrichItem(item, deps(), "text");
    expect(out.enrichment.tier).toBe("text");
    expect(out.enrichment.entities[0]!.name).toBe("Lilia");
    expect(out.enrichment.transcript).toBe("welcome to brooklyn");
    expect(out.enrichment.error).toBeUndefined();
  });

  test("records error and stays raw when Gemini fails", async () => {
    const out = await enrichItem(
      item,
      deps({ callGemini: async () => ({ ok: false, error: "parse_fail" }) }),
      "text",
    );
    expect(out.enrichment.tier).toBe("raw");
    expect(out.enrichment.error).toBe("parse_fail");
    expect(out.enrichment.entities).toEqual([]);
  });

  test("skips subtitle fetch when item has none", async () => {
    let called = false;
    const out = await enrichItem(
      { ...item, hasSubtitles: false, subtitleUrl: null },
      deps({
        fetchSubtitles: async () => {
          called = true;
          return "";
        },
      }),
      "text",
    );
    expect(called).toBe(false);
    expect(out.enrichment.tier).toBe("text");
  });
});

describe("enrichItem — visual tier", () => {
  test("records media_fetch_failed and stays raw when media fetch returns empty", async () => {
    const out = await enrichItem(
      item,
      deps({ fetchMedia: async () => [] }),
      "visual",
    );
    expect(out.enrichment.tier).toBe("raw");
    expect(out.enrichment.error).toBe("media_fetch_failed");
  });

  test("produces a visual-tier item when media + gemini succeed", async () => {
    const visual: GeminiResult = {
      ok: true,
      enrichment: {
        on_screen_text: ["LILIA"],
        entities: [
          { type: "place", name: "Williamsburg", raw: "Williamsburg" },
        ],
        takeaways: [],
      },
    };
    const out = await enrichItem(
      item,
      deps({ callGemini: async () => visual }),
      "visual",
    );
    expect(out.enrichment.tier).toBe("visual");
    expect(out.enrichment.on_screen_text).toEqual(["LILIA"]);
  });
});

describe("mergeVisualIntoText", () => {
  test("upgrades tier, unions entities by key, adds on_screen_text", () => {
    const textItem = {
      ...item,
      enrichment: { ...okText.enrichment, tier: "text" as const },
    };
    const merged = mergeVisualIntoText(textItem, {
      ok: true,
      enrichment: {
        on_screen_text: ["LILIA"],
        entities: [
          { type: "restaurant", name: "lilia", raw: "Lilia sign" }, // dup of existing
          { type: "place", name: "Williamsburg", raw: "Williamsburg" }, // new
        ],
        takeaways: [],
      },
    });
    expect(merged.enrichment.tier).toBe("visual");
    expect(merged.enrichment.on_screen_text).toEqual(["LILIA"]);
    expect(merged.enrichment.entities).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/enrich.test.ts
```

Expected: FAIL — `Cannot find module './enrich.js'`.

- [ ] **Step 3: Implement `src/lib/enrich.ts`**

```ts
import type {
  CapturedItem,
  EnrichedItem,
  EnrichmentTier,
  GeminiResult,
} from "./types.js";
import { dedupeEntities } from "./entities.js";
import {
  buildTextPrompt,
  buildVisualPrompt,
  buildSlideshowPrompt,
} from "./prompts.js";
import type { MediaPart } from "./geminiClient.js";

export interface EnrichDeps {
  callGemini: (body: unknown) => Promise<GeminiResult>;
  fetchSubtitles: (url: string) => Promise<string>;
  fetchMedia: (item: CapturedItem) => Promise<MediaPart[]>;
  basePrompts: { text: string; visual: string; slideshow: string };
}

// Re-exported so callers can build bodies; kept here to avoid a circular import in tests.
import { buildTextBody, buildMediaBody } from "./geminiClient.js";

function raw(item: CapturedItem, error?: string): EnrichedItem {
  return {
    ...item,
    enrichment: { tier: "raw", entities: [], takeaways: [], error },
  };
}

export async function enrichItem(
  item: CapturedItem,
  deps: EnrichDeps,
  tier: Exclude<EnrichmentTier, "raw">,
): Promise<EnrichedItem> {
  if (tier === "text") {
    const transcript =
      item.hasSubtitles && item.subtitleUrl
        ? await deps.fetchSubtitles(item.subtitleUrl)
        : "";
    const prompt = buildTextPrompt(deps.basePrompts.text, item, transcript);
    const res = await deps.callGemini(buildTextBody(prompt));
    if (!res.ok) return raw(item, res.error);
    return {
      ...item,
      enrichment: {
        ...res.enrichment,
        entities: dedupeEntities(res.enrichment.entities),
        tier: "text",
      },
    };
  }

  // visual tier
  const media = await deps.fetchMedia(item);
  if (media.length === 0) return raw(item, "media_fetch_failed");
  const prompt = item.isSlideshow
    ? buildSlideshowPrompt(deps.basePrompts.slideshow, item)
    : buildVisualPrompt(deps.basePrompts.visual, item);
  const res = await deps.callGemini(buildMediaBody(prompt, media));
  if (!res.ok) return raw(item, res.error);
  return {
    ...item,
    enrichment: {
      ...res.enrichment,
      entities: dedupeEntities(res.enrichment.entities),
      tier: "visual",
    },
  };
}

export function mergeVisualIntoText(
  textItem: EnrichedItem,
  visual: GeminiResult,
): EnrichedItem {
  if (!visual.ok)
    return {
      ...textItem,
      enrichment: { ...textItem.enrichment, error: visual.error },
    };
  const combined = dedupeEntities([
    ...textItem.enrichment.entities,
    ...visual.enrichment.entities,
  ]);
  return {
    ...textItem,
    enrichment: {
      ...textItem.enrichment,
      tier: "visual",
      on_screen_text:
        visual.enrichment.on_screen_text ?? textItem.enrichment.on_screen_text,
      entities: combined,
      takeaways: textItem.enrichment.takeaways.length
        ? textItem.enrichment.takeaways
        : visual.enrichment.takeaways,
      error: undefined,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/enrich.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/lib/enrich.ts src/lib/enrich.test.ts
git commit -m "feat(engine): tiered enrichment orchestrator with injected deps + tests"
```

---

## Task 6: JSON + CSV exporters — TDD

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/exporters/json.ts`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/lib/exporters/json.test.ts`
- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/exporters/csv.ts`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/lib/exporters/csv.test.ts`

- [ ] **Step 1: Write failing JSON test**

`src/lib/exporters/json.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { toJsonBundle } from "./json.js";
import type { EnrichedItem } from "../types.js";

const items: EnrichedItem[] = [
  {
    id: "7001",
    desc: "pasta",
    createTime: 1,
    author: "foodietravels",
    authorName: null,
    url: "https://t/7001",
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 1,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: ["pasta"],
    stats: {
      plays: null,
      likes: null,
      comments: null,
      shares: null,
      collects: null,
    },
    enrichment: {
      tier: "text",
      entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }],
      takeaways: ["go"],
    },
  },
];

describe("toJsonBundle", () => {
  test("emits valid JSON with items and an entity index", () => {
    const out = JSON.parse(toJsonBundle(items));
    expect(out.items).toHaveLength(1);
    expect(out.entities[0].key).toBe("restaurant:lilia");
    expect(out.entities[0].itemIds).toEqual(["7001"]);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement `src/lib/exporters/json.ts`**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/exporters/json.test.ts
```

Expected: FAIL — module not found. Then create:

```ts
import type { EnrichedItem } from "../types.js";
import { buildEntityIndex } from "../entities.js";

export function toJsonBundle(items: EnrichedItem[]): string {
  return JSON.stringify(
    {
      version: 1,
      exported_at: new Date().toISOString(),
      items,
      entities: buildEntityIndex(items),
    },
    null,
    2,
  );
}
```

- [ ] **Step 3: Run to verify JSON test passes**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/exporters/json.test.ts
```

Expected: PASS.

- [ ] **Step 4: Write failing CSV test**

`src/lib/exporters/csv.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { toItemsCsv, toEntitiesCsv } from "./csv.js";
import type { EnrichedItem } from "../types.js";

const items: EnrichedItem[] = [
  {
    id: "7001",
    desc: 'pasta, "the best"',
    createTime: 1,
    author: "foodietravels",
    authorName: null,
    url: "https://t/7001",
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 1,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: ["pasta", "brooklyn"],
    stats: {
      plays: 10,
      likes: null,
      comments: null,
      shares: null,
      collects: null,
    },
    enrichment: {
      tier: "text",
      entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }],
      takeaways: ["go"],
    },
  },
];

describe("toItemsCsv", () => {
  test("has a header row and escapes quotes/commas", () => {
    const csv = toItemsCsv(items);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("id,url,author,caption");
    expect(lines[1]).toContain('"pasta, ""the best"""'); // RFC-4180 escaping
    expect(lines[1]).toContain("pasta|brooklyn"); // hashtags joined
  });
});

describe("toEntitiesCsv", () => {
  test("one row per entity with joined item ids", () => {
    const csv = toEntitiesCsv(items);
    expect(csv.trim().split("\n")[0]).toBe("key,type,name,item_ids");
    expect(csv).toContain("restaurant:lilia,restaurant,Lilia,7001");
  });
});
```

- [ ] **Step 5: Run to verify failure, then implement `src/lib/exporters/csv.ts`**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/exporters/csv.test.ts
```

Expected: FAIL — module not found. Then create:

```ts
import type { EnrichedItem } from "../types.js";
import { buildEntityIndex } from "../entities.js";

function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[]): string {
  return cells.map(cell).join(",");
}

const ITEM_HEADER = [
  "id",
  "url",
  "author",
  "caption",
  "hashtags",
  "tier",
  "entities",
  "takeaways",
  "plays",
];

export function toItemsCsv(items: EnrichedItem[]): string {
  const lines = [ITEM_HEADER.join(",")];
  for (const it of items) {
    lines.push(
      row([
        it.id,
        it.url ?? "",
        it.author ?? "",
        it.desc,
        it.hashtags.join("|"),
        it.enrichment.tier,
        it.enrichment.entities.map((e) => `${e.type}:${e.name}`).join("|"),
        it.enrichment.takeaways.join("|"),
        it.stats.plays ?? "",
      ]),
    );
  }
  return lines.join("\n") + "\n";
}

export function toEntitiesCsv(items: EnrichedItem[]): string {
  const lines = ["key,type,name,item_ids"];
  for (const e of buildEntityIndex(items)) {
    lines.push(row([e.key, e.type, e.name, e.itemIds.join("|")]));
  }
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 6: Run to verify all exporter tests pass**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/exporters/
```

Expected: PASS — json + csv tests green.

- [ ] **Step 7: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/lib/exporters/json.ts src/lib/exporters/json.test.ts src/lib/exporters/csv.ts src/lib/exporters/csv.test.ts
git commit -m "feat(engine): JSON + CSV exporters with tests"
```

---

## Task 7: Obsidian vault exporter — TDD

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/exporters/obsidian.ts`
- Test: `/Users/s0shaheen/Dev/attic-extension/src/lib/exporters/obsidian.test.ts`

Emits an array of `{ path, content }` virtual files — one note per item plus one note per entity that backlinks its source items. The caller writes them to disk / a ZIP.

- [ ] **Step 1: Write the failing test**

`src/lib/exporters/obsidian.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import { toObsidianVault } from "./obsidian.js";
import type { EnrichedItem } from "../types.js";

const items: EnrichedItem[] = [
  {
    id: "7001",
    desc: "best pasta",
    createTime: 1,
    author: "foodietravels",
    authorName: null,
    url: "https://t/7001",
    playUrl: null,
    downloadUrl: null,
    cover: null,
    durationSec: 1,
    hasSubtitles: false,
    subtitleUrl: null,
    isSlideshow: false,
    music: null,
    hashtags: ["pasta"],
    stats: {
      plays: null,
      likes: null,
      comments: null,
      shares: null,
      collects: null,
    },
    enrichment: {
      tier: "text",
      transcript: "welcome",
      entities: [{ type: "restaurant", name: "Lilia", raw: "Lilia" }],
      takeaways: ["go to lilia"],
    },
  },
];

describe("toObsidianVault", () => {
  const files = toObsidianVault(items);

  test("creates one item note and one entity note", () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("items/7001.md");
    expect(paths).toContain("entities/restaurant/Lilia.md");
  });

  test("item note has front-matter, a wikilink to the entity, and a hashtag", () => {
    const note = files.find((f) => f.path === "items/7001.md")!.content;
    expect(note).toMatch(/^---\n/);
    expect(note).toContain("creator: foodietravels");
    expect(note).toContain("[[Lilia]]");
    expect(note).toContain("#pasta");
    expect(note).toContain("welcome");
  });

  test("entity note backlinks its source item", () => {
    const note = files.find(
      (f) => f.path === "entities/restaurant/Lilia.md",
    )!.content;
    expect(note).toContain("[[7001]]");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/exporters/obsidian.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/exporters/obsidian.ts`**

```ts
import type { EnrichedItem } from "../types.js";
import { buildEntityIndex } from "../entities.js";

export interface VaultFile {
  path: string;
  content: string;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function itemNote(item: EnrichedItem): VaultFile {
  const e = item.enrichment;
  const fm = [
    "---",
    `id: ${item.id}`,
    `creator: ${item.author ?? ""}`,
    `url: ${item.url ?? ""}`,
    `tier: ${e.tier}`,
    "---",
  ].join("\n");
  const tags = item.hashtags.map((t) => `#${t}`).join(" ");
  const entityLinks = e.entities
    .map((ent) => `- [[${sanitize(ent.name)}]] (${ent.type})`)
    .join("\n");
  const takeaways = e.takeaways.map((t) => `- ${t}`).join("\n");
  const body = [
    fm,
    "",
    `# ${item.desc || item.id}`,
    tags,
    "",
    "## Takeaways",
    takeaways || "_none_",
    "",
    "## Entities",
    entityLinks || "_none_",
    "",
    "## Transcript",
    e.transcript ?? "_none_",
    "",
    item.url ? `[Open on TikTok](${item.url})` : "",
  ].join("\n");
  return { path: `items/${sanitize(item.id)}.md`, content: body };
}

export function toObsidianVault(items: EnrichedItem[]): VaultFile[] {
  const files = items.map(itemNote);
  for (const entry of buildEntityIndex(items)) {
    const backlinks = entry.itemIds.map((id) => `- [[${id}]]`).join("\n");
    files.push({
      path: `entities/${entry.type}/${sanitize(entry.name)}.md`,
      content: [
        "---",
        `type: ${entry.type}`,
        "---",
        "",
        `# ${entry.name}`,
        "",
        "## Saved in",
        backlinks,
      ].join("\n"),
    });
  }
  return files;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run src/lib/exporters/obsidian.test.ts
```

Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx vitest run && npx tsc --noEmit
```

Expected: all tests PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/lib/exporters/obsidian.ts src/lib/exporters/obsidian.test.ts
git commit -m "feat(engine): Obsidian vault exporter (item + entity notes) with tests"
```

---

## Task 8: Browser-bound media fetch (interface + live smoke)

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/src/lib/mediaFetch.ts`

`mediaFetch` runs only in a tiktok.com content-script context (credentialed CORS + Range + DNR Referer — the spike-proven Path 2). It cannot be unit-tested in Node; it ships with a documented interface that matches `EnrichDeps.fetchMedia`, and is validated by an in-extension smoke run.

- [ ] **Step 1: Implement `src/lib/mediaFetch.ts`**

```ts
import type { CapturedItem } from "./types.js";
import type { MediaPart } from "./geminiClient.js";

const INLINE_LIMIT = 18 * 1024 * 1024; // ~18 MB inline-base64 ceiling

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
  return btoa(binary);
}

// Mirrors the page's own working video request (spike Path 2). Returns [] on any failure so the
// orchestrator records `media_fetch_failed` rather than throwing. Videos over the inline limit
// return [] here; the File API path (Task 9 smoke) handles them in the live runner.
export async function fetchVideoBytes(
  item: CapturedItem,
): Promise<MediaPart[]> {
  if (!item.playUrl) return [];
  try {
    const res = await fetch(item.playUrl, {
      credentials: "include",
      headers: { Range: "bytes=0-" },
    });
    if (!res.ok && res.status !== 206) return [];
    const blob = await res.blob();
    if (blob.size > INLINE_LIMIT) return []; // too big for inline; File API handled by the runner
    return [
      { mimeType: blob.type || "video/mp4", data: await blobToBase64(blob) },
    ];
  } catch {
    return [];
  }
}

export async function fetchSubtitles(url: string): Promise<string> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return "";
    const vtt = await res.text();
    // Strip WEBVTT header, cue timings, and indices → plain transcript text.
    return vtt
      .replace(/^WEBVTT.*$/m, "")
      .replace(/^\d+$/gm, "")
      .replace(/^\d{2}:\d{2}.*-->.*$/gm, "")
      .replace(/<[^>]+>/g, "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" ");
  } catch {
    return "";
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Live smoke (manual, in-extension)**

Load the spike extension in Chrome on the TikTok Favorites tab (per the spike README). In the page console, import and call `fetchVideoBytes` against one captured item with a `playUrl`, and `fetchSubtitles` against an item with `subtitleUrl`. Confirm: `fetchVideoBytes` returns a non-empty array with a base64 `data` string for a normal-size video; `fetchSubtitles` returns non-empty plain text. Record pass/fail inline in `recon/0.1-findings.md` under a new `## Engine media-fetch smoke` heading.

Expected: both return non-empty results (reconfirms the spike's Path-2 finding through the typed module).

- [ ] **Step 4: Commit**

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add src/lib/mediaFetch.ts recon/0.1-findings.md
git commit -m "feat(engine): browser-bound media + subtitle fetch (Path 2) + smoke note"
```

---

## Task 9: Live integration smoke over the real fixture + File API for >18 MB

**Files:**

- Create: `/Users/s0shaheen/Dev/attic-extension/scripts/run-engine-smoke.mjs`

End-to-end check that the engine produces real exports from real data, using the founder's local full capture (`attic-favorites.json`) and BYO Gemini key. This is an empirical gate, not a unit test: it confirms the wired engine works against live data and that the >18 MB File API path functions.

- [ ] **Step 1: Build the engine to runnable JS for the script**

The script imports the engine. Run it through `tsx` (no build step needed):

```bash
cd /Users/s0shaheen/Dev/attic-extension && npm install -D tsx
```

- [ ] **Step 2: Create `scripts/run-engine-smoke.mjs`**

This runs text-tier enrichment in Node against the founder's full local capture, calling the real Gemini text endpoint with the key from `src/secrets.js`, then writes all three export formats to `results/`. (Media/visual tier is browser-only — covered by Task 8's smoke; this script validates the text path + all exporters end-to-end on real data.)

```js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { GEMINI_KEY } from "../src/secrets.js";
import { buildTextPrompt } from "../src/lib/prompts.ts";
import { buildTextBody, parseGeminiResponse } from "../src/lib/geminiClient.ts";
import { dedupeEntities } from "../src/lib/entities.ts";
import { toJsonBundle } from "../src/lib/exporters/json.ts";
import { toItemsCsv, toEntitiesCsv } from "../src/lib/exporters/csv.ts";
import { toObsidianVault } from "../src/lib/exporters/obsidian.ts";

const MODEL = "gemini-2.5-flash";
const TEXT_PROMPT = readFileSync(
  new URL("../prompts/observe_video.text.md", import.meta.url),
  "utf8",
);
const items = JSON.parse(
  readFileSync(process.argv[2] ?? "attic-favorites.json", "utf8"),
).slice(0, 30);

async function callGemini(body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return parseGeminiResponse(await r.json());
}

const enriched = [];
for (const item of items) {
  const prompt = buildTextPrompt(TEXT_PROMPT, item, ""); // subtitles browser-only; text-from-caption here
  const res = await callGemini(buildTextBody(prompt));
  enriched.push(
    res.ok
      ? {
          ...item,
          enrichment: {
            ...res.enrichment,
            entities: dedupeEntities(res.enrichment.entities),
            tier: "text",
          },
        }
      : {
          ...item,
          enrichment: {
            tier: "raw",
            entities: [],
            takeaways: [],
            error: res.error,
          },
        },
  );
  process.stdout.write(res.ok ? "." : "x");
  await new Promise((r) => setTimeout(r, 800));
}

mkdirSync("results/vault", { recursive: true });
writeFileSync("results/engine-export.json", toJsonBundle(enriched));
writeFileSync("results/engine-items.csv", toItemsCsv(enriched));
writeFileSync("results/engine-entities.csv", toEntitiesCsv(enriched));
for (const f of toObsidianVault(enriched)) {
  mkdirSync(`results/vault/${f.path.split("/").slice(0, -1).join("/")}`, {
    recursive: true,
  });
  writeFileSync(`results/vault/${f.path}`, f.content);
}
const ok = enriched.filter((x) => x.enrichment.tier !== "raw").length;
console.log(`\n${ok}/${enriched.length} enriched; exports written to results/`);
```

- [ ] **Step 3: Run the smoke against the real capture**

```bash
cd /Users/s0shaheen/Dev/attic-extension && npx tsx scripts/run-engine-smoke.mjs ~/Downloads/attic-favorites.json
```

Expected: a row of `.` (≥80% should be dots), then `≥24/30 enriched; exports written to results/`. Inspect `results/engine-export.json` (items + entity index), `results/engine-items.csv`, and `results/vault/` (item + entity notes). Confirm entities dedupe across items (a creator/place saved twice appears once in the index with two itemIds).

- [ ] **Step 4: Validate the >18 MB File API path (in-extension, manual)**

In the loaded extension, pick a captured item whose video is >18 MB (a long one). `fetchVideoBytes` returns `[]` for it by design. In the page console, exercise the Gemini File API resumable-upload flow on that one video's blob (upload → poll until `ACTIVE` → `generateContent` with the `fileData` URI). Confirm a valid enrichment comes back. Record the outcome in `recon/0.1-findings.md` under `## Engine File-API smoke`. If it works, note that the Phase-1 runner should route >18 MB videos through File API; if it fails, note the cap (skip-and-flag large videos) — neither blocks this engine.

- [ ] **Step 5: Commit the script (exports stay gitignored)**

`results/engine-*.json|csv` and `results/vault/` are covered by the existing `.gitignore` patterns for results artifacts; if not, add `results/engine-*` and `results/vault/` to `.gitignore` first.

```bash
cd /Users/s0shaheen/Dev/attic-extension
git add scripts/run-engine-smoke.mjs package.json package-lock.json .gitignore recon/0.1-findings.md
git commit -m "feat(engine): live integration smoke runner over real capture + File-API note"
```

---

## Self-Review

**Spec coverage (against `2026-05-27-attic-enrichment-entities-design.md`):**

- §2 two tiers → Task 5 (`enrichItem` text/visual, `mergeVisualIntoText`); selection UI is Library-UI scope (deferred), the _engine_ tier mechanics are covered.
- §3 media handling (Path-2 fetch, ≤18 MB inline, File API, slideshow, per-item failure) → Task 8 (`fetchVideoBytes`, inline limit, slideshow prompt path in Task 5) + Task 9 step 4 (File API smoke); failures map to `media_fetch_failed`/`parse_fail`/`empty_response` (Tasks 4–5).
- §4 entity extraction + normalization/dedupe + cross-item index → Task 2.
- §5 presentation → **deferred** (Library UI follow-on plan); the data it needs (entity index, tier badges via `enrichment.tier`, searchable fields) is produced here.
- §6 export (JSON + entity index, CSV + entities.csv, Obsidian vault with entity notes, `.mp4` export) → Tasks 6–7; `.mp4` export is the spike's Path-2 download, deferred to the Library-UI/export-panel plan (mechanism proven, no new engine logic).
- §7 execution model (offscreen runner, queue, checkpoint, rate-limit) → **deferred** to the MV3-shell sub-project; `EnrichDeps` injection (Task 5) is the seam the runner plugs into. The live runner (Task 9) exercises the same functions sequentially with pacing.
- §8 component boundaries → one file per unit, matching the table.
- §9 open questions → facets emitted as secondary (Tasks 4–5 default arrays/optional), BYO-key only, conservative aliasing (`normalizeName`, Task 2).

**Placeholder scan:** No TBD/TODO; every code step shows complete code; manual smoke steps name the exact thing to check and where to record it.

**Type consistency:** `CapturedItem`/`Entity`/`EnrichedItem`/`Enrichment`/`GeminiResult`/`EntityIndexEntry`/`MediaPart` defined in Task 1/Task 4 and used unchanged throughout. `entityKey`/`normalizeName`/`dedupeEntities`/`buildEntityIndex` (Task 2) reused by exporters (Tasks 6–7) and orchestrator (Task 5). `EnrichDeps.fetchMedia` signature `(item) => Promise<MediaPart[]>` matches `fetchVideoBytes` (Task 8). `buildTextBody`/`buildMediaBody`/`parseGeminiResponse` (Task 4) used by Task 5 and Task 9. Tier values `raw`/`text`/`visual` consistent across types, orchestrator, exporters, and tests.

**Note on scope:** This plan deliberately stops at the engine. Two follow-on plans complete the spec: (1) **MV3 shell + offscreen enrichment runner** (wraps `EnrichDeps` in the resumable queue), (2) **entity-aware Library UI + export panel** (the §5 presentation + `.mp4` export button). Both depend on the MV3-shell + IndexedDB-storage sub-projects from the parent spec §11.
