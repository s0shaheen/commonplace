// Ingestion planning + keyframe extraction for the keyframes_vtt lane.
//
// Two halves, deliberately split: (1) `keyframeTimes` is pure timestamp planning and is
// unit-tested; (2) `extractKeyframes` needs a DOM (<video> decode + <canvas> capture) and
// therefore runs ONLY in the offscreen document — never in the service worker or in the
// vitest "node" environment. It takes an explicit `doc: Document` so the DOM dependency is
// injected, not global, keeping the untestable half quarantined behind one function.

import type { MediaPart } from "./geminiClient.js";

// N evenly-spaced sample midpoints over the clip: [(i+0.5)*d/n] for i in 0..n-1, rounded to
// 3dp. A null/0 duration yields a single poster-adjacent frame at t=1 (nothing to sample).
export function keyframeTimes(durationSec: number | null, n = 6): number[] {
  if (!durationSec || durationSec <= 0) return [1];
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    times.push(Math.round(((i + 0.5) * durationSec) / n * 1000) / 1000);
  }
  return times;
}

// OFFSCREEN-ONLY. blob URL → <video> seek → <canvas> drawImage → JPEG dataURL → base64
// MediaPart, one per requested timestamp. Returns [] on any decode/seek failure so the
// orchestrator records a media-fetch failure rather than throwing. Not unit-tested (no DOM
// in vitest); the planning half above is the tested surface.
export async function extractKeyframes(videoBlob: Blob, times: number[], doc: Document): Promise<MediaPart[]> {
  const url = URL.createObjectURL(videoBlob);
  try {
    const video = doc.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    await once(video, "loadedmetadata", "error");

    const canvas = doc.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return [];

    const frames: MediaPart[] = [];
    for (const t of times) {
      video.currentTime = t;
      await once(video, "seeked", "error");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const data = dataUrl.split(",")[1] ?? "";
      if (data) frames.push({ mimeType: "image/jpeg", data });
    }
    return frames;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Resolve on `okEvent`, reject on `errEvent`. Offscreen-only helper (touches DOM events).
function once(el: HTMLMediaElement, okEvent: string, errEvent: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const done = (fn: () => void) => () => {
      el.removeEventListener(okEvent, ok);
      el.removeEventListener(errEvent, err);
      fn();
    };
    const ok = done(resolve);
    const err = done(() => reject(new Error(errEvent)));
    el.addEventListener(okEvent, ok, { once: true });
    el.addEventListener(errEvent, err, { once: true });
  });
}
