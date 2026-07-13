// Robust localized saved-count parser (COMPL-07, §4 "locale-fragile saved-count parsing"). The
// completeness guard compares captured-this-source vs the count TikTok's own UI declares near a source's
// tab ("1,463", "1.5K", "1 463", non-Latin digits). That text is localized and abbreviated, so a naive
// parseInt mis-reads it — and a mis-read declared count would falsely flag a complete source "suspicious".
//
// PURE: text in → a non-negative integer, or null when unreadable (never a throw, never a wrong number
// dressed up as a real one). The content-script glue does the DOM read (grab the tab's text); this module
// owns the fragile normalization so "1.5K → 1500" and "٠ / ۰ / fullwidth digits → Latin" are unit tests.
//
// Design bias (load-bearing): CONSERVATIVE. If the text isn't an unambiguous count, return null — a null
// declared just means the completeness guard can't flag suspicious (it defaults to the honest scroll
// outcome). A wrong number is worse than no number, exactly as preflight refuses to false-block.

// Base code points of common Unicode decimal-digit blocks (each block runs base..base+9). Covers the
// scripts a real TikTok locale might render; anything outside these stays untouched (→ likely null).
const DIGIT_BLOCK_BASES = [
  0x30, // ASCII 0-9
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic (Persian/Urdu)
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Oriya
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0e50, // Thai
  0x0ed0, // Lao
  0x0f20, // Tibetan
  0xff10, // Fullwidth
] as const;

/** The 0-9 value of a single digit char across the known blocks, or null if it isn't a decimal digit. */
function digitValue(ch: string): number | null {
  const cp = ch.codePointAt(0);
  if (cp == null) return null;
  for (const base of DIGIT_BLOCK_BASES) {
    if (cp >= base && cp <= base + 9) return cp - base;
  }
  return null;
}

/** Rewrite every recognized non-Latin decimal digit to its ASCII equivalent; leave all else intact. */
export function latinizeDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const v = digitValue(ch);
    out += v == null ? ch : String(v);
  }
  return out;
}

/** A single grouping/decimal separator between 1-3 digits and 1-2 trailing digits (e.g. "1.5", "1,5"). */
const DECIMAL_RE = /^\d{1,3}[.,]\d{1,2}$/;

/**
 * Parse a localized/abbreviated saved-count string to a non-negative integer, or null if unreadable.
 *
 * Handles: plain integers with grouping separators ("1,463", "1 463", "1.463", NBSP-grouped), K/M/B
 * magnitude abbreviations with a decimal point ("1.5K" → 1500, "2.3M" → 2 300 000), and non-Latin digit
 * scripts (Arabic-Indic, Devanagari, Thai, fullwidth, …). Anything with no leading digit run → null.
 *
 * The parser targets INTEGER counts + K/M/B abbreviations (a saved count is never fractional), so a bare
 * decimal with no magnitude is read as grouped digits — the glue is expected to hand over the whole token
 * INCLUDING any magnitude letter (e.g. "1.5K", not "1.5").
 */
export function parseLocalizedCount(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const s = latinizeDigits(text).trim();
  // First numeric run (digits + grouping/decimal separators + inner spaces) plus an optional magnitude.
  const m = /(\d[\d.,\s ]*)\s*([kmb])?/i.exec(s);
  if (!m) return null;
  const numPart = (m[1] ?? "").trim();
  const suffix = (m[2] || "").toLowerCase();

  if (suffix) {
    const mult = suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : 1e9;
    let cleaned = numPart.replace(/[\s ]/g, "");
    if (DECIMAL_RE.test(cleaned)) {
      cleaned = cleaned.replace(",", "."); // a single separator before a magnitude is the decimal point
    } else {
      cleaned = cleaned.replace(/[.,]/g, ""); // otherwise the separators are grouping → strip
    }
    const val = parseFloat(cleaned);
    if (!Number.isFinite(val)) return null;
    return Math.round(val * mult);
  }

  // No magnitude: an integer count with grouping separators — strip them and parse.
  const digits = numPart.replace(/[.,\s ]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  return parseInt(digits, 10);
}
