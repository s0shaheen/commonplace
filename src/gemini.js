// Browser→Gemini enrichment, loaded dynamically by content.js.
//
// IMPORTANT FINDING (0.3): TikTok's video CDN blocks cross-origin byte reads (CORS 403), so the
// full video cannot be fetched client-side to send to Gemini. Visual/video enrichment therefore
// requires a server-side proxy (deferred decision). This spike instead tests the *viable local
// path*: TEXT-only enrichment from caption + hashtags + bundled subtitles. Cheap, private, no proxy.
import { GEMINI_KEY } from "./secrets.js";

const MODEL = "gemini-2.5-flash";

// Subtitle files are also on TikTok's CDN and may be CORS-blocked too — degrade gracefully.
async function fetchSubtitles(url) {
  if (!url) return { text: "", status: "none" };
  try {
    const r = await fetch(url);
    if (!r.ok) return { text: "", status: `http_${r.status}` };
    const vtt = await r.text();
    const text = vtt
      .replace(/^WEBVTT[\s\S]*?\n\n/, "")
      .replace(/\d\d:\d\d:\d\d[.,]\d+\s*-->.*$/gm, "")
      .replace(/^\d+$/gm, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return { text, status: "ok" };
  } catch (e) {
    return { text: "", status: "fetch_error" };
  }
}

const PROMPT = `You are enriching a saved TikTok for a personal, searchable archive. Using ONLY the metadata below, output STRICT JSON (no prose) with keys:
"transcript": string (clean the subtitles into readable text; "" if none),
"entities": array of {"type","name","detail"} for any places/restaurants/products/books/movies/songs/people mentioned,
"takeaways": array of short strings (what a viewer would save this for),
"topic": one lowercase word.`;

export async function enrichItem(item) {
  const { text: subtitles, status: subStatus } = await fetchSubtitles(item.subtitleUrl);
  const meta = [
    `Caption: ${item.desc || "(none)"}`,
    `Hashtags: ${(item.hashtags || []).join(", ") || "(none)"}`,
    `Creator: @${item.author || "?"} (${item.authorName || ""})`,
    `Music: ${item.music?.name || "(none)"}`,
    `Subtitles: ${subtitles || "(none available)"}`,
  ].join("\n");
  const body = {
    contents: [{ parts: [{ text: `${PROMPT}\n\n${meta}` }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 4096 },
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
  const txt = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return { id: item.id, desc: item.desc, url: item.url, subtitleStatus: subStatus, enrichment: JSON.parse(txt) };
  } catch (_) {
    return { id: item.id, error: "parse_fail", subtitleStatus: subStatus, raw: (txt || JSON.stringify(json)).slice(0, 800) };
  }
}
