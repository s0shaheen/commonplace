// Tests for the PURE tier-policy decision core. Hand-computed; no clock, no rng, no IO.
//
// tierPolicy answers ONE question deterministically: given what content is still missing, the user's
// enrichment setting, and the quota/failover state, which lane runs NEXT — or is the item done (`skip`)
// or out of lanes (`exhausted`)? Every transition below (oembed default, own-session depth, tikwm→apify
// failover, skip, exhausted) is a branch of that function, so this is the whole contract in one file.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tierPolicy } from "./tierPolicy.js";
import type { MissingFields, EnrichQuota } from "./types.js";

const fresh: EnrichQuota = { spent: [] };
const skeleton: MissingFields = { caption: true, poster: true, transcript: true };
const nothing: MissingFields = { caption: false, poster: false, transcript: false };

describe("tierPolicy", () => {
  it("off setting never enriches, even a bare skeleton → skip", () => {
    expect(tierPolicy(skeleton, "off", fresh)).toBe("skip");
  });

  it("nothing missing → skip (a content-rich item never hits the network)", () => {
    expect(tierPolicy(nothing, "free", fresh)).toBe("skip");
    expect(tierPolicy(nothing, "depth", fresh)).toBe("skip");
    expect(tierPolicy(nothing, "paid", fresh)).toBe("skip");
  });

  it("free default: a skeleton starts on oembed", () => {
    expect(tierPolicy(skeleton, "free", fresh)).toBe("oembed");
  });

  it("free: once oembed is spent and only transcript remains → exhausted (free cannot get a transcript)", () => {
    const afterOembed: EnrichQuota = { spent: ["oembed"] };
    const onlyTranscript: MissingFields = { caption: false, poster: false, transcript: true };
    expect(tierPolicy(onlyTranscript, "free", afterOembed)).toBe("exhausted");
  });

  it("free: once oembed filled everything → skip (clean stop, not exhausted)", () => {
    const afterOembed: EnrichQuota = { spent: ["oembed"] };
    expect(tierPolicy(nothing, "free", afterOembed)).toBe("skip");
  });

  it("depth: a skeleton still starts on oembed (the free base runs first)", () => {
    expect(tierPolicy(skeleton, "depth", fresh)).toBe("oembed");
  });

  it("depth: after oembed fills caption+poster, a missing transcript escalates to own_session", () => {
    const afterOembed: EnrichQuota = { spent: ["oembed"] };
    const onlyTranscript: MissingFields = { caption: false, poster: false, transcript: true };
    expect(tierPolicy(onlyTranscript, "depth", afterOembed)).toBe("own_session");
  });

  it("depth: once oembed and own_session are both spent and a transcript still missing → exhausted", () => {
    const spent: EnrichQuota = { spent: ["oembed", "own_session"] };
    const onlyTranscript: MissingFields = { caption: false, poster: false, transcript: true };
    expect(tierPolicy(onlyTranscript, "depth", spent)).toBe("exhausted");
  });

  it("paid: a skeleton starts on the free oembed base", () => {
    expect(tierPolicy(skeleton, "paid", fresh)).toBe("oembed");
  });

  it("paid: after oembed, remaining depth (transcript/stats) escalates to tikwm PRIMARY", () => {
    const afterOembed: EnrichQuota = { spent: ["oembed"] };
    const onlyTranscript: MissingFields = { caption: false, poster: false, transcript: true };
    expect(tierPolicy(onlyTranscript, "paid", afterOembed)).toBe("tikwm");
  });

  it("paid: tikwm error/quota fails over to apify when a token is configured (FAILOVER)", () => {
    const failed: EnrichQuota = { spent: ["oembed", "tikwm"], tikwmFailed: true, apifyAvailable: true };
    const onlyTranscript: MissingFields = { caption: false, poster: false, transcript: true };
    expect(tierPolicy(onlyTranscript, "paid", failed)).toBe("apify");
  });

  it("paid: tikwm failed but no Apify token → exhausted (honest partial, keeps oembed fields)", () => {
    const failed: EnrichQuota = { spent: ["oembed", "tikwm"], tikwmFailed: true, apifyAvailable: false };
    const onlyTranscript: MissingFields = { caption: false, poster: false, transcript: true };
    expect(tierPolicy(onlyTranscript, "paid", failed)).toBe("exhausted");
  });

  it("paid: both paid providers spent and still missing → exhausted", () => {
    const both: EnrichQuota = { spent: ["oembed", "tikwm", "apify"], tikwmFailed: true, apifyAvailable: true };
    const onlyTranscript: MissingFields = { caption: false, poster: false, transcript: true };
    expect(tierPolicy(onlyTranscript, "paid", both)).toBe("exhausted");
  });

  it("paid: tikwm succeeds and fills everything → skip (no needless failover)", () => {
    const afterTikwm: EnrichQuota = { spent: ["oembed", "tikwm"] };
    expect(tierPolicy(nothing, "paid", afterTikwm)).toBe("skip");
  });

  it("paid: never jumps to apify while tikwm is still unspent and healthy", () => {
    const afterOembed: EnrichQuota = { spent: ["oembed"], apifyAvailable: true };
    expect(tierPolicy(skeleton, "paid", afterOembed)).toBe("tikwm");
  });
});

describe("tierPolicy purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./tierPolicy.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
