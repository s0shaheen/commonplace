// Tests for the localized saved-count parser (COMPL-07). Pure; hand-computed expectations.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseLocalizedCount, latinizeDigits } from "./declaredCount.js";

describe("parseLocalizedCount — grouping separators", () => {
  it("parses comma-grouped integers", () => {
    expect(parseLocalizedCount("1,463")).toBe(1463);
    expect(parseLocalizedCount("1,234,567")).toBe(1234567);
  });

  it("parses space- and NBSP-grouped integers", () => {
    expect(parseLocalizedCount("1 463")).toBe(1463);
    expect(parseLocalizedCount("1 463")).toBe(1463);
    expect(parseLocalizedCount("12 000")).toBe(12000);
  });

  it("parses period-grouped integers (EU grouping)", () => {
    expect(parseLocalizedCount("1.463")).toBe(1463);
  });

  it("parses a bare integer", () => {
    expect(parseLocalizedCount("42")).toBe(42);
    expect(parseLocalizedCount("0")).toBe(0);
  });
});

describe("parseLocalizedCount — K/M/B abbreviations", () => {
  it("parses decimal K/M/B", () => {
    expect(parseLocalizedCount("1.5K")).toBe(1500);
    expect(parseLocalizedCount("2.3M")).toBe(2_300_000);
    expect(parseLocalizedCount("1.2B")).toBe(1_200_000_000);
  });

  it("parses integer K/M (no decimal point)", () => {
    expect(parseLocalizedCount("12K")).toBe(12000);
    expect(parseLocalizedCount("5M")).toBe(5_000_000);
  });

  it("accepts a comma as the decimal separator before a magnitude (EU: 1,5K)", () => {
    expect(parseLocalizedCount("1,5K")).toBe(1500);
  });

  it("is case-insensitive on the magnitude letter and tolerant of a space", () => {
    expect(parseLocalizedCount("1.5k")).toBe(1500);
    expect(parseLocalizedCount("3.4 M")).toBe(3_400_000);
  });
});

describe("parseLocalizedCount — non-Latin digit scripts", () => {
  it("parses Arabic-Indic digits", () => {
    expect(parseLocalizedCount("١٤٦٣")).toBe(1463); // ٠١٢٣٤٥٦٧٨٩
  });

  it("parses Extended Arabic-Indic (Persian) digits", () => {
    expect(parseLocalizedCount("۱۴۶۳")).toBe(1463);
  });

  it("parses Devanagari digits", () => {
    expect(parseLocalizedCount("१४६३")).toBe(1463);
  });

  it("parses fullwidth digits with a magnitude", () => {
    expect(parseLocalizedCount("１.５K")).toBe(1500);
  });

  it("latinizeDigits leaves non-digit characters intact", () => {
    expect(latinizeDigits("Favorites ١٤٦٣")).toBe("Favorites 1463");
    expect(latinizeDigits("abc")).toBe("abc");
  });
});

describe("parseLocalizedCount — a leading label + count, and unreadable input", () => {
  it("extracts the count from a labelled tab string", () => {
    expect(parseLocalizedCount("Favorites 1,463")).toBe(1463);
    expect(parseLocalizedCount("Liked 2.3M")).toBe(2_300_000);
  });

  it("returns null for unreadable / non-numeric input", () => {
    expect(parseLocalizedCount("")).toBeNull();
    expect(parseLocalizedCount("Favorites")).toBeNull();
    expect(parseLocalizedCount("—")).toBeNull();
    expect(parseLocalizedCount(null)).toBeNull();
    expect(parseLocalizedCount(undefined)).toBeNull();
    expect(parseLocalizedCount(1463 as unknown as string)).toBeNull(); // non-string in → null (no throw)
  });
});

describe("purity", () => {
  it("the module source has no Date.now / Math.random / DOM references (grep-verified)", () => {
    const src = readFileSync(fileURLToPath(new URL("./declaredCount.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
