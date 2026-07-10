// RED-first tests for the defensive item_list envelope parser. The crux of Task 1 lives in the
// hasMore coercion: a MISSING or UNKNOWN paging signal must default to `true` (more-may-exist),
// never `false` — a false "done" is the exact §2.1 bug we are killing. Item extraction must reuse
// capture.js's normalizer verbatim (no fork).
import { describe, it, expect } from "vitest";
import { extractItems } from "../../capture.js";
import { parseItemListEnvelope, coerceHasMore } from "./interceptParse.js";

// The real /api/user/collect/item_list/ item shape, mirrored from capture.test.js.
const realItem = {
  id: "7578265440993199126",
  desc: "he made the sacrifice play. #ironman",
  createTime: 1775813549,
  author: { uniqueId: "no1persona", nickname: "persona" },
  video: {
    id: "7578265440993199126",
    playAddr: "https://v16.../play",
    downloadAddr: "https://v16.../dl",
    cover: "https://p19.../cover",
    duration: 78,
    subtitleInfos: [{ LanguageCodeName: "eng-US", Url: "https://sub.../en.vtt" }],
  },
  music: { id: "123", title: "original sound", authorName: "persona" },
  challenges: [{ title: "ironman" }],
  stats: { playCount: 1000, diggCount: 50, commentCount: 5, shareCount: 2, collectCount: 9 },
};

describe("coerceHasMore — defensive, fail-safe-toward-more", () => {
  it("reads true / 1 / '1' / 'true' as true", () => {
    expect(coerceHasMore(true)).toBe(true);
    expect(coerceHasMore(1)).toBe(true);
    expect(coerceHasMore("1")).toBe(true);
    expect(coerceHasMore("true")).toBe(true);
  });

  it("reads false / 0 / '0' / 'false' as false (an explicit stop is honored)", () => {
    expect(coerceHasMore(false)).toBe(false);
    expect(coerceHasMore(0)).toBe(false);
    expect(coerceHasMore("0")).toBe(false);
    expect(coerceHasMore("false")).toBe(false);
  });

  it("MISSING SIGNAL MUST NOT END CAPTURE: absent/undefined/null/garbage → true", () => {
    // WHY: false-completion is the #1 bug (§2.1). hasMore's on-wire shape is UNVERIFIED in recon
    // (recon/0.1-findings.md:8 copied only the itemList subtree). A signal we can't read must mean
    // "more may exist" and let scrollState's giveup backstop end an actually-finished list — never
    // a guessed `false` here.
    expect(coerceHasMore(undefined)).toBe(true);
    expect(coerceHasMore(null)).toBe(true);
    expect(coerceHasMore("maybe")).toBe(true);
    expect(coerceHasMore({})).toBe(true);
    expect(coerceHasMore(2)).toBe(true);
  });
});

describe("parseItemListEnvelope", () => {
  it("hasMore:false → false", () => {
    expect(parseItemListEnvelope({ itemList: [realItem], hasMore: false }).hasMore).toBe(false);
  });

  it("hasMore:1 → true (TikTok's numeric truthy encoding)", () => {
    expect(parseItemListEnvelope({ itemList: [realItem], hasMore: 1 }).hasMore).toBe(true);
  });

  it("hasMore ABSENT → true (missing signal must not end capture)", () => {
    expect(parseItemListEnvelope({ itemList: [realItem] }).hasMore).toBe(true);
  });

  it("reads cursor, then maxCursor, then max_cursor; else null", () => {
    expect(parseItemListEnvelope({ itemList: [], cursor: "120" }).cursor).toBe("120");
    expect(parseItemListEnvelope({ itemList: [], maxCursor: "240" }).cursor).toBe("240");
    expect(parseItemListEnvelope({ itemList: [], max_cursor: "360" }).cursor).toBe("360");
    expect(parseItemListEnvelope({ itemList: [] }).cursor).toBe(null);
    // numeric cursor is coerced to a string (ids/cursors stay strings — precision safety)
    expect(parseItemListEnvelope({ itemList: [], cursor: 480 }).cursor).toBe("480");
  });

  it("item extraction still matches capture.js exactly (no fork of the normalizer)", () => {
    const payload = { itemList: [realItem, { desc: "no id", video: {} }], hasMore: true };
    expect(parseItemListEnvelope(payload, "likes").items).toEqual(extractItems(payload, "likes"));
  });

  it("empty / null payloads are safe (empty items, defaults toward more)", () => {
    expect(parseItemListEnvelope({})).toEqual({ items: [], hasMore: true, cursor: null });
    expect(parseItemListEnvelope(null)).toEqual({ items: [], hasMore: true, cursor: null });
  });
});
