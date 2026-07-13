// Pure preflight gate (C8, capture-resilience §7). Facts in, verdict out — driven with fixed inputs
// only. The load-bearing tests here are the CONSERVATIVE guards: the gate must never emit
// `not_logged_in` for a legitimate run (an empty-but-logged-in list, a flagged-empty session, or a
// promo CTA on a populated page), because a false block silently drops the founder's corpus.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assessPreflight, type PreflightFacts, type PreflightVerdict } from "./preflight.js";

// A neutral, ready baseline: on a profile page, no login CTA, tiles present, arrivals seen. Each test
// overrides only the fields it exercises.
const base: PreflightFacts = {
  onProfilePage: true,
  loginCtaPresent: false,
  ownTileCount: 12,
  sawItemListArrival: true,
};
const facts = (over: Partial<PreflightFacts>): PreflightFacts => ({ ...base, ...over });

describe("assessPreflight — one per verdict", () => {
  it("a healthy logged-in profile run ⇒ ready", () => {
    expect(assessPreflight(base)).toBe<PreflightVerdict>("ready");
  });

  it("the live logged-out page (login CTA · 0 tiles · no arrivals) ⇒ not_logged_in", () => {
    const v = assessPreflight(
      facts({ onProfilePage: true, loginCtaPresent: true, ownTileCount: 0, sawItemListArrival: false }),
    );
    expect(v).toBe<PreflightVerdict>("not_logged_in");
  });

  it("a run pointed at the FYP / a video (not a profile) ⇒ not_profile", () => {
    const v = assessPreflight(facts({ onProfilePage: false }));
    expect(v).toBe<PreflightVerdict>("not_profile");
  });
});

describe("assessPreflight — conservative guards (never false-block a legitimate run)", () => {
  it("login CTA present but tiles ARE present (promo/upsell strip on a populated page) ⇒ ready", () => {
    const v = assessPreflight(facts({ loginCtaPresent: true, ownTileCount: 24, sawItemListArrival: true }));
    expect(v).toBe<PreflightVerdict>("ready");
  });

  it("login CTA present, 0 tiles, but an item_list arrival WAS seen (grid still loading) ⇒ ready", () => {
    const v = assessPreflight(facts({ loginCtaPresent: true, ownTileCount: 0, sawItemListArrival: true }));
    expect(v).toBe<PreflightVerdict>("ready");
  });

  it("logged-in but EMPTY list (0 favorites, NO login CTA) ⇒ ready (not misread as logged-out)", () => {
    const v = assessPreflight(facts({ loginCtaPresent: false, ownTileCount: 0, sawItemListArrival: false }));
    expect(v).toBe<PreflightVerdict>("ready");
  });

  it("flagged-empty session (SESS-01: 0 tiles, no CTA, but empty_ok arrivals seen) ⇒ ready (recovery ladder owns it)", () => {
    const v = assessPreflight(facts({ loginCtaPresent: false, ownTileCount: 0, sawItemListArrival: true }));
    expect(v).toBe<PreflightVerdict>("ready");
  });

  it("only TWO of the three logged-out tells (CTA + no arrival, but tiles present) ⇒ ready", () => {
    const v = assessPreflight(facts({ loginCtaPresent: true, ownTileCount: 3, sawItemListArrival: false }));
    expect(v).toBe<PreflightVerdict>("ready");
  });
});

describe("assessPreflight — precedence when signals co-occur", () => {
  it("logged-OUT and off-profile at once ⇒ not_logged_in (the more actionable reason wins)", () => {
    const v = assessPreflight(
      facts({ onProfilePage: false, loginCtaPresent: true, ownTileCount: 0, sawItemListArrival: false }),
    );
    expect(v).toBe<PreflightVerdict>("not_logged_in");
  });

  it("off-profile but logged IN (tiles + arrivals) ⇒ not_profile (not misread as logged-out)", () => {
    const v = assessPreflight(facts({ onProfilePage: false, ownTileCount: 20, sawItemListArrival: true }));
    expect(v).toBe<PreflightVerdict>("not_profile");
  });

  it("exhaustive fact sweep: not_logged_in ⟺ exactly (CTA ∧ 0 tiles ∧ no arrival)", () => {
    let checked = 0;
    for (const onProfilePage of [true, false]) {
      for (const loginCtaPresent of [true, false]) {
        for (const ownTileCount of [0, 1, 12]) {
          for (const sawItemListArrival of [true, false]) {
            const v = assessPreflight({ onProfilePage, loginCtaPresent, ownTileCount, sawItemListArrival });
            checked++;
            const isLoggedOut = loginCtaPresent && ownTileCount === 0 && !sawItemListArrival;
            if (isLoggedOut) {
              expect(v).toBe("not_logged_in"); // fires on the triple-guard REGARDLESS of onProfilePage
            } else if (!onProfilePage) {
              expect(v).toBe("not_profile");
            } else {
              expect(v).toBe("ready");
            }
          }
        }
      }
    }
    expect(checked).toBe(2 * 2 * 3 * 2);
  });
});

describe("preflight module purity (invariant §5.1: pure core, no glue)", () => {
  it("the source reads no DOM, clock, or RNG globals", () => {
    const src = readFileSync(fileURLToPath(new URL("./preflight.ts", import.meta.url)), "utf8");
    for (const forbidden of ["document", "window", "globalThis", "Date.now", "Math.random", "querySelector", "performance"]) {
      expect(src.includes(forbidden), `module must not reference ${forbidden}`).toBe(false);
    }
  });
});
