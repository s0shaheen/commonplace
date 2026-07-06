// Pure functions: normalize a TikTok item_list payload into export-shaped records, dedupe by id.
// Field mapping confirmed against a real /api/user/collect/item_list/ response (2026-05-26 recon).
// NOTE: TikTok returns `id` as a quoted string (19-digit), so it is safe from JS number precision loss.
// NOTE: we deliberately DROP the bulky `raw` object — it blew chrome.storage's 10MB quota and bloats
// the export. We keep the one useful nested bit (the subtitle URL) as a top-level field.

export function normalizeItem(it, source = null) {
  const author = it.author?.uniqueId ?? it.author?.unique_id ?? null;
  const video = it.video ?? {};
  const stats = it.stats ?? it.statsV2 ?? {};
  const id = it.id != null ? String(it.id) : video.id != null ? String(video.id) : null;
  const num = (v) => (v == null ? null : Number(v));
  const subs = Array.isArray(video.subtitleInfos) ? video.subtitleInfos : [];
  const engSub = subs.find((s) => /eng/i.test(s.LanguageCodeName || "")) ?? subs[0];
  return {
    id,
    sources: source ? [source] : [], // which tab(s) this item was captured from: favorites | likes | posts | reposts
    desc: it.desc ?? "",
    createTime: it.createTime ?? null,
    author,
    authorName: it.author?.nickname ?? null,
    url: author && id ? `https://www.tiktok.com/@${author}/video/${id}` : null,
    playUrl: video.playAddr ?? video.downloadAddr ?? null,
    downloadUrl: video.downloadAddr ?? null,
    cover: video.cover ?? video.originCover ?? null,
    durationSec: video.duration ?? null,
    hasSubtitles: subs.length > 0,
    subtitleUrl: engSub?.Url ?? null,
    isSlideshow: !!it.imagePost,
    music: it.music ? { name: it.music.title ?? null, author: it.music.authorName ?? null } : null,
    hashtags: Array.isArray(it.challenges) ? it.challenges.map((c) => c.title).filter(Boolean) : [],
    stats: {
      plays: num(stats.playCount),
      likes: num(stats.diggCount),
      comments: num(stats.commentCount),
      shares: num(stats.shareCount),
      collects: num(stats.collectCount),
    },
  };
}

export function extractItems(payload, source = null) {
  const list = payload?.itemList ?? payload?.items ?? [];
  return list.map((it) => normalizeItem(it, source)).filter((x) => x.id);
}

export function mergeDedupe(existing, incoming) {
  const byId = new Map(existing.map((x) => [x.id, x]));
  for (const item of incoming) {
    const prev = byId.get(item.id);
    // The same video can appear under multiple tabs (e.g. liked AND favorited) — keep the
    // freshest record but UNION the source tags so we never lose that provenance on dedupe.
    const sources = [...new Set([...(prev?.sources ?? []), ...(item.sources ?? [])])];
    byId.set(item.id, prev ? { ...prev, ...item, sources } : { ...item, sources });
  }
  return [...byId.values()];
}
