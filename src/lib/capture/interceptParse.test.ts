// RED-first tests for the defensive item_list envelope parser. The crux of Task 1 lives in the
// hasMore coercion: a MISSING or UNKNOWN paging signal must default to `true` (more-may-exist),
// never `false` — a false "done" is the exact §2.1 bug we are killing. Item extraction must reuse
// capture.js's normalizer verbatim (no fork).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractItems } from "../../capture.js";
import {
  parseItemListEnvelope,
  coerceHasMore,
  classifyTransport,
  parseEnvelopeStatus,
  isTerminalPage,
  type TransportFacts,
} from "./interceptParse.js";

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

describe("parseItemListEnvelope — multi-key paging read (COMPL-02: story PascalCase + snake_case)", () => {
  it("reads hasMore from has_more / HasMoreAfter / HasMore, first-defined-wins", () => {
    expect(parseItemListEnvelope({ itemList: [], has_more: false }).hasMore).toBe(false); // snake_case
    expect(parseItemListEnvelope({ itemList: [], HasMoreAfter: false }).hasMore).toBe(false); // story PascalCase
    expect(parseItemListEnvelope({ itemList: [], HasMore: false }).hasMore).toBe(false);
    expect(parseItemListEnvelope({ itemList: [], HasMoreAfter: 1 }).hasMore).toBe(true);
  });

  it("first-defined key wins even when its value is a positive false (not fall-through)", () => {
    // hasMore:false is present → honored; the later HasMore:true must NOT override it.
    expect(parseItemListEnvelope({ itemList: [], hasMore: false, HasMore: true }).hasMore).toBe(false);
  });

  it("reads cursor from the PascalCase story keys (MaxCursor / MinCursor) too", () => {
    expect(parseItemListEnvelope({ itemList: [], MaxCursor: "900" }).cursor).toBe("900");
    expect(parseItemListEnvelope({ itemList: [], minCursor: "12" }).cursor).toBe("12");
    expect(parseItemListEnvelope({ itemList: [], MinCursor: "34" }).cursor).toBe("34");
    // primary `cursor` still wins over the variants when both present
    expect(parseItemListEnvelope({ itemList: [], cursor: "-1", MaxCursor: "900" }).cursor).toBe("-1");
  });
});

describe("parseEnvelopeStatus — statusCode ?? status_code (0 = API-ok)", () => {
  it("reads statusCode first, then status_code; else null", () => {
    expect(parseEnvelopeStatus({ statusCode: 0 })).toBe(0);
    expect(parseEnvelopeStatus({ status_code: 5 })).toBe(5);
    expect(parseEnvelopeStatus({ statusCode: 0, status_code: 99 })).toBe(0); // statusCode wins
    expect(parseEnvelopeStatus({ statusCode: "10" })).toBe(10); // string coerced
    expect(parseEnvelopeStatus({})).toBe(null);
    expect(parseEnvelopeStatus(null)).toBe(null);
    expect(parseEnvelopeStatus({ statusCode: "nope" })).toBe(null); // NaN → null
  });
});

describe("classifyTransport — typed transport signal (INJ-02 / COMPL-01 / SESS-01)", () => {
  const ok = (over: Partial<TransportFacts> = {}): TransportFacts => ({
    ok: true,
    status: 200,
    contentType: "application/json",
    bodyText: JSON.stringify({ itemList: [], statusCode: 0 }),
    online: true,
    ...over,
  });

  it("offline beats everything (even a would-be-ok response)", () => {
    expect(classifyTransport(ok({ online: false }))).toBe("offline");
    expect(classifyTransport(ok({ online: false, status: 500, ok: false }))).toBe("offline");
  });

  it("401 / 403 / a login redirect → challenge (session/auth wall)", () => {
    expect(classifyTransport(ok({ ok: false, status: 401, bodyText: "" }))).toBe("challenge");
    expect(classifyTransport(ok({ ok: false, status: 403, bodyText: "" }))).toBe("challenge");
    expect(classifyTransport(ok({ ok: false, status: 302, bodyText: "" }))).toBe("challenge");
  });

  it("304 Not Modified → http_error, NOT challenge (a cache revalidation is not an auth wall)", () => {
    // A 304 is a conditional-GET revalidation with no fresh body — never a captcha/redirect wall and
    // never a false "ok" with no data. It rides the glue's transient http_error retry/stall path.
    expect(classifyTransport(ok({ ok: false, status: 304, bodyText: "" }))).toBe("http_error");
  });

  it("429 / 5xx / other non-2xx → http_error (glue decides retry vs wait)", () => {
    expect(classifyTransport(ok({ ok: false, status: 429, bodyText: "" }))).toBe("http_error");
    expect(classifyTransport(ok({ ok: false, status: 503, bodyText: "" }))).toBe("http_error");
    expect(classifyTransport(ok({ ok: false, status: 404, bodyText: "" }))).toBe("http_error");
    expect(classifyTransport(ok({ ok: false, status: 0, bodyText: "" }))).toBe("http_error");
  });

  it("EMPTY 200 body → empty_ok (SESS-01 — never a benign parse-skip)", () => {
    expect(classifyTransport(ok({ bodyText: "" }))).toBe("empty_ok");
    expect(classifyTransport(ok({ bodyText: "   \n\t  " }))).toBe("empty_ok"); // whitespace-only counts
  });

  it("200 HTML → challenge if a captcha/verify/login page, else api_error (captive portal)", () => {
    const captcha = "<!doctype html><html><body>Please complete the CAPTCHA to verify you are human</body></html>";
    expect(classifyTransport(ok({ contentType: "text/html", bodyText: captcha }))).toBe("challenge");
    const portal = "<!doctype html><html><body>Connect to WiFi — guest network portal</body></html>";
    expect(classifyTransport(ok({ contentType: "text/html", bodyText: portal }))).toBe("api_error");
  });

  it("200 JSON with a non-zero envelope status → api_error", () => {
    expect(classifyTransport(ok({ bodyText: JSON.stringify({ statusCode: 10, status_msg: "err" }) }))).toBe("api_error");
  });

  it("200 JSON that does not parse → api_error (not TikTok JSON)", () => {
    expect(classifyTransport(ok({ bodyText: "not json at all {{{", contentType: "application/json" }))).toBe("api_error");
  });

  it("200 healthy TikTok JSON, envelope status 0 → ok", () => {
    expect(classifyTransport(ok())).toBe("ok");
  });
});

describe("isTerminalPage — conservative done (invariant 3 / COMPL-01)", () => {
  it("a POSITIVE hasMore:false on a healthy page → terminal", () => {
    expect(isTerminalPage({ items: [], hasMore: false, cursor: "5" }, "ok")).toBe(true);
  });

  it("the '-1' cursor sentinel on an EMPTY healthy page → terminal", () => {
    expect(isTerminalPage({ items: [], hasMore: true, cursor: "-1" }, "ok")).toBe(true);
  });

  it("a defaulted-true hasMore is NOT done, even with items", () => {
    expect(isTerminalPage({ items: [{}] as never, hasMore: true, cursor: "5" }, "ok")).toBe(false);
  });

  it("hasMore:false on a NON-ok transport is NEVER done (an error envelope must not ship as complete)", () => {
    expect(isTerminalPage({ items: [], hasMore: false, cursor: "-1" }, "challenge")).toBe(false);
    expect(isTerminalPage({ items: [], hasMore: false, cursor: "-1" }, "empty_ok")).toBe(false);
    expect(isTerminalPage({ items: [], hasMore: false, cursor: "-1" }, "http_error")).toBe(false);
  });

  it("a '-1' cursor on a still-populated page is NOT terminal via the sentinel (needs positive hasMore:false)", () => {
    expect(isTerminalPage({ items: [{}] as never, hasMore: true, cursor: "-1" }, "ok")).toBe(false);
  });
});

describe("LIVE FIXTURE — tiktok-post-item-list-envelope.json is a genuine terminal page (COMPL-02 pin)", () => {
  const root = join(__dirname, "..", "..", "..");
  const raw = readFileSync(join(root, "fixtures", "tiktok-post-item-list-envelope.json"), "utf8");
  const json = JSON.parse(raw);

  it("parses hasMore:false and cursor:'-1' from the committed live envelope", () => {
    const env = parseItemListEnvelope(json, "posts");
    expect(env.hasMore).toBe(false);
    expect(env.cursor).toBe("-1");
    expect(env.items).toHaveLength(1); // itemList trimmed to 1 real item in the fixture
  });

  it("an OK JSON body of this envelope classifies as 'ok' (statusCode 0)", () => {
    const facts: TransportFacts = {
      ok: true,
      status: 200,
      contentType: "application/json",
      bodyText: raw,
      online: true,
    };
    expect(classifyTransport(facts)).toBe("ok");
    expect(parseEnvelopeStatus(json)).toBe(0);
  });

  it("is recognized as a genuine terminal page on a healthy transport", () => {
    const env = parseItemListEnvelope(json, "posts");
    expect(isTerminalPage(env, "ok")).toBe(true);
  });
});
