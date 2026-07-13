// Own-identity capture (SUP-02): learn the founder's OWN handle (and, as a bonus key, secUid) so the
// autonomous-navigation glue can reach their profile from ANY starting page. This is the PURE core —
// path/URL parsing and the "which value do we keep" decision. Every DOM read (is this the own profile?
// what's the nav profile link?) and every storage write lives in the content.js / background.ts glue,
// so "we never overwrite a known handle with junk" is a deterministic unit test, not a live-run gamble.
//
// WHY A HANDLE, NOT A secUid, DRIVES NAV: TikTok's canonical profile URL is `/@<handle>`; secUid is an
// opaque owner id the item_list URL carries but which does not compose into a navigable URL. We persist
// secUid opportunistically (it disambiguates the owner) but navigation is always by handle.

/** Valid TikTok handle chars (letters, digits, underscore, period), bounded length. */
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

/** True if `h` is a plausible handle string (not empty, not junk). */
export function isValidHandle(h: unknown): h is string {
  return typeof h === "string" && HANDLE_RE.test(h);
}

/**
 * Extract the `@handle` segment from ANY `/@handle…` path (profile root, sub-tab, OR a video/photo
 * permalink — the owner segment is the same). Returns the bare handle (no `@`) or null. Validated so a
 * malformed segment never becomes a persisted handle.
 */
export function handleFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const m = /^\/@([^/?#]+)/.exec(pathname);
  const h = m?.[1];
  return h && isValidHandle(h) ? h : null;
}

/**
 * Is this path a PROFILE page (the surface that hosts the favorites/likes/posts/reposts sub-tabs), as
 * opposed to a single video/photo permalink or the FYP? Mirrors content.js/background.ts isProfileUrl.
 */
export function isProfilePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (!/^\/@[^/]+/.test(pathname)) return false;
  return !/\/(video|photo)\//.test(pathname);
}

/** Read the `secUid` query param from an item_list URL (owner id). Null if absent/unparseable. */
export function parseSecUidFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // The URL may be relative (XHR/fetch to a same-origin path) — give it a base so URL() parses it.
    const u = new URL(url, "https://www.tiktok.com");
    const s = u.searchParams.get("secUid");
    return s && s.length > 0 ? s : null;
  } catch {
    // Fallback: a bare regex for `secUid=...` when the string isn't a valid URL.
    const m = /[?&]secUid=([^&#]+)/.exec(url);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  }
}

/** The canonical navigable profile URL for a handle. */
export function profileUrl(handle: string): string {
  return `https://www.tiktok.com/@${handle}`;
}

export interface OwnProfileFacts {
  /** An "Edit profile" control is present — only the account owner sees it. */
  editProfilePresent: boolean;
  /** A favorites sub-tab is present — favorites are private, shown only on the owner's own profile. */
  favoritesTabPresent: boolean;
}

/**
 * Is the current profile page the user's OWN? A profile is "own" when it exposes an owner-only control:
 * the Edit-profile button OR the (private) Favorites sub-tab. Either is a strong, TikTok-stable signal
 * that we're on the account's own profile, not some creator we're viewing.
 */
export function isOwnProfile(facts: OwnProfileFacts): boolean {
  return facts.editProfilePresent || facts.favoritesTabPresent;
}

/**
 * Decide which handle to persist. `confident` is true when the observation came from a strong own-profile
 * signal (isOwnProfile on a profile page) — a confident observation WINS (so an account switch is picked
 * up). Otherwise we keep any already-known handle and only fall back to a weak observation (e.g. a nav
 * link) when nothing is stored. Invalid observations are ignored — we NEVER overwrite a good handle with
 * junk, and we NEVER clear a known handle.
 */
export function chooseOwnHandle(
  stored: string | null | undefined,
  observed: string | null | undefined,
  confident: boolean,
): string | null {
  const obs = isValidHandle(observed) ? observed : null;
  const cur = isValidHandle(stored) ? stored : null;
  if (obs && confident) return obs;
  return cur ?? obs ?? null;
}
