import type { CapturedItem } from "./types.js";
import type { MediaPart } from "./geminiClient.js";

/** ~18 MB inline-base64 ceiling — applies to IMAGES (keyframes/posters), which are sent inline. */
export const INLINE_LIMIT = 18 * 1024 * 1024;

/** Video ceiling for the NATIVE lane. Video no longer goes inline: it is uploaded through the Gemini
 *  File API, so the inline limit does not apply (the pilot's real clips ran 8.7–33.8 MB — 4 of 6 were
 *  over the inline cap). This ceiling is a MEMORY bound for the offscreen document (the bytes are
 *  base64'd in-process), not a protocol limit; short-form video sits far below it, and anything above
 *  returns [] so the caller degrades honestly to keyframes rather than OOM-ing. */
export const VIDEO_BYTES_LIMIT = 128 * 1024 * 1024;

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
  return btoa(binary);
}

// Mirrors the page's own working video request (spike Path 2). Returns [] on any failure so the
// caller falls back honestly (keyframes/caption) rather than throwing or faking an analysis.
// The bytes feed the NATIVE lane, which uploads them via the Gemini File API — so the bound here is
// VIDEO_BYTES_LIMIT (a memory bound), NOT the inline-base64 limit that applies to images.
export async function fetchVideoBytes(item: CapturedItem): Promise<MediaPart[]> {
  if (!item.playUrl) return [];
  try {
    const res = await fetch(item.playUrl, { credentials: "include", headers: { Range: "bytes=0-" } });
    if (!res.ok && res.status !== 206) return [];
    const blob = await res.blob();
    if (blob.size > VIDEO_BYTES_LIMIT) return []; // beyond the memory bound → honest keyframe fallback
    return [{ mimeType: blob.type || "video/mp4", data: await blobToBase64(blob) }];
  } catch {
    return [];
  }
}

// Pure: strip a WebVTT document down to plain transcript text. Drops the WEBVTT header + metadata,
// NOTE comment blocks, cue identifiers, cue timing lines, and inline tags; dedupes consecutive
// repeated caption lines (TikTok rolling captions emit the same text across cues).
export function parseVtt(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const out: string[] = [];
  let inNote = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      inNote = false; // a blank line terminates a NOTE block
      continue;
    }
    if (inNote) continue;
    if (line === "WEBVTT" || /^WEBVTT\s/.test(line)) continue;
    if (/^NOTE\b/.test(line)) {
      inNote = true;
      continue;
    }
    if (line.includes("-->")) continue; // cue timing line (with optional cue settings)
    if ((lines[i + 1] ?? "").trim().includes("-->")) continue; // cue identifier precedes a timing line
    if (/^(Kind|Language|Region|Style):/i.test(line)) continue; // header metadata
    const text = line.replace(/<[^>]+>/g, "").trim(); // strip inline tags
    if (!text) continue;
    if (out.length > 0 && out[out.length - 1] === text) continue; // dedupe consecutive repeats
    out.push(text);
  }
  return out.join(" ");
}

export async function fetchSubtitles(url: string): Promise<string> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return "";
    return parseVtt(await res.text());
  } catch {
    return "";
  }
}

// Fetch the post's cover/poster image as a single inline keyframe. Used for slideshows (no
// seekable video) and as the poster-adjacent fallback when a clip can't be decoded for
// keyframe extraction (keyframeTimes returns [1] for null/0 duration). Returns [] on any
// failure so the orchestrator records media_fetch_failed rather than throwing.
export async function fetchPosterFrames(item: CapturedItem): Promise<MediaPart[]> {
  if (!item.cover) return [];
  try {
    const res = await fetch(item.cover, { credentials: "include" });
    if (!res.ok) return [];
    const blob = await res.blob();
    if (blob.size > INLINE_LIMIT) return [];
    return [{ mimeType: blob.type || "image/jpeg", data: await blobToBase64(blob) }];
  } catch {
    return [];
  }
}
