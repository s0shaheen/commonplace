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
// orchestrator records `media_fetch_failed` rather than throwing.
// TODO(file-api): an oversized-but-successful download also returns [] here, conflated with a real
// fetch failure. When the File API path lands (runner task), distinguish "too big" so it can be
// routed to resumable upload instead of being mislabeled media_fetch_failed.
export async function fetchVideoBytes(item: CapturedItem): Promise<MediaPart[]> {
  if (!item.playUrl) return [];
  try {
    const res = await fetch(item.playUrl, { credentials: "include", headers: { Range: "bytes=0-" } });
    if (!res.ok && res.status !== 206) return [];
    const blob = await res.blob();
    if (blob.size > INLINE_LIMIT) return []; // too big for inline; File API handled by the runner
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
