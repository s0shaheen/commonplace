// Browser→Gemini enrichment. Loaded dynamically by content.js so the video fetch runs in the
// tiktok.com page context (correct session/referer). Spike-only: founder's key, inline base64.
import { GEMINI_KEY } from "./secrets.js";

const MODEL = "gemini-2.5-flash";

async function fetchVideoBase64(url) {
  const res = await fetch(url, { headers: { Referer: "https://www.tiktok.com/" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return { b64: btoa(binary), size: bytes.length };
}

export async function enrichItem(item, prompt) {
  if (!item.playUrl) return { id: item.id, error: "no_play_url" };
  let video;
  try {
    video = await fetchVideoBase64(item.playUrl);
  } catch (e) {
    return { id: item.id, error: "video_fetch_failed", detail: String(e) };
  }
  if (video.size > 18 * 1024 * 1024) {
    return { id: item.id, error: "too_big_for_inline", bytes: video.size };
  }
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "video/mp4", data: video.b64 } },
          { text: `${prompt}\n\nCaption: ${item.desc}` },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 16384 },
  };
  let json;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    json = await r.json();
  } catch (e) {
    return { id: item.id, error: "gemini_request_failed", detail: String(e) };
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return { id: item.id, desc: item.desc, url: item.url, enrichment: JSON.parse(text) };
  } catch (_) {
    return { id: item.id, error: "parse_fail", raw: (text || JSON.stringify(json)).slice(0, 800) };
  }
}
