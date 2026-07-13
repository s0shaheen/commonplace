// Tests for own-identity capture (SUP-02): handle/secUid parsing, own-profile detection, and the
// keep/overwrite decision. Pure — no DOM, no storage, no clock. The load-bearing invariant: a confident
// observation wins (account switch), but we NEVER overwrite a known handle with junk or clear it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  isValidHandle,
  handleFromPath,
  isProfilePath,
  parseSecUidFromUrl,
  profileUrl,
  isOwnProfile,
  chooseOwnHandle,
} from "./ownIdentity.js";

describe("isValidHandle", () => {
  it("accepts real-shaped handles, rejects junk", () => {
    expect(isValidHandle("founder")).toBe(true);
    expect(isValidHandle("the.founder_1")).toBe(true);
    expect(isValidHandle("")).toBe(false);
    expect(isValidHandle("has space")).toBe(false);
    expect(isValidHandle("bad/slash")).toBe(false);
    expect(isValidHandle(null)).toBe(false);
    expect(isValidHandle(42 as unknown)).toBe(false);
    expect(isValidHandle("a".repeat(31))).toBe(false); // over the length bound
  });
});

describe("handleFromPath", () => {
  it("extracts the @handle from a profile root and sub-paths", () => {
    expect(handleFromPath("/@founder")).toBe("founder");
    expect(handleFromPath("/@founder/")).toBe("founder");
    expect(handleFromPath("/@the.founder_1?lang=en")).toBe("the.founder_1");
    expect(handleFromPath("/@founder/video/12345")).toBe("founder"); // owner segment even on a permalink
  });
  it("returns null for non-profile paths and junk", () => {
    expect(handleFromPath("/foryou")).toBe(null);
    expect(handleFromPath("/")).toBe(null);
    expect(handleFromPath("/@")).toBe(null);
    expect(handleFromPath("/@bad handle")).toBe(null);
    expect(handleFromPath(null)).toBe(null);
    expect(handleFromPath(undefined)).toBe(null);
  });
});

describe("isProfilePath", () => {
  it("true for a profile root, false for a permalink or the FYP", () => {
    expect(isProfilePath("/@founder")).toBe(true);
    expect(isProfilePath("/@founder/")).toBe(true);
    expect(isProfilePath("/@founder/video/123")).toBe(false);
    expect(isProfilePath("/@founder/photo/123")).toBe(false);
    expect(isProfilePath("/foryou")).toBe(false);
    expect(isProfilePath("/")).toBe(false);
    expect(isProfilePath(null)).toBe(false);
  });
});

describe("parseSecUidFromUrl", () => {
  it("reads secUid from an absolute or relative item_list URL", () => {
    expect(
      parseSecUidFromUrl("https://www.tiktok.com/api/user/collect/item_list/?secUid=ABC123&count=30"),
    ).toBe("ABC123");
    expect(parseSecUidFromUrl("/api/post/item_list/?count=30&secUid=XYZ")).toBe("XYZ");
  });
  it("returns null when absent or unparseable", () => {
    expect(parseSecUidFromUrl("/api/post/item_list/?count=30")).toBe(null);
    expect(parseSecUidFromUrl("")).toBe(null);
    expect(parseSecUidFromUrl(null)).toBe(null);
  });
});

describe("profileUrl", () => {
  it("builds the canonical navigable profile URL", () => {
    expect(profileUrl("founder")).toBe("https://www.tiktok.com/@founder");
  });
});

describe("isOwnProfile", () => {
  it("own when an owner-only control is present", () => {
    expect(isOwnProfile({ editProfilePresent: true, favoritesTabPresent: false })).toBe(true);
    expect(isOwnProfile({ editProfilePresent: false, favoritesTabPresent: true })).toBe(true);
    expect(isOwnProfile({ editProfilePresent: false, favoritesTabPresent: false })).toBe(false);
  });
});

describe("chooseOwnHandle — keep/overwrite policy", () => {
  it("a confident observation wins (account switch is picked up)", () => {
    expect(chooseOwnHandle("old", "new", true)).toBe("new");
  });
  it("a weak observation only fills an empty store, never overwrites", () => {
    expect(chooseOwnHandle("known", "weakguess", false)).toBe("known");
    expect(chooseOwnHandle(null, "weakguess", false)).toBe("weakguess");
  });
  it("never overwrites or clears a known handle with junk", () => {
    expect(chooseOwnHandle("known", "bad handle", true)).toBe("known");
    expect(chooseOwnHandle("known", "", true)).toBe("known");
    expect(chooseOwnHandle("known", null, true)).toBe("known");
  });
  it("returns null only when nothing valid is known or observed", () => {
    expect(chooseOwnHandle(null, null, true)).toBe(null);
    expect(chooseOwnHandle("bad handle", "also bad", true)).toBe(null);
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./ownIdentity.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    // `window.tiktok.com` appears only inside a string base for URL(); assert no window IDENTIFIER use.
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/performance\./);
  });
});
