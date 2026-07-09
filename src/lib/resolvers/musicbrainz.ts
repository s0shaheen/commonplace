// MusicBrainz resolver (free, no API key) — the KB endpoint is the candidate generator.
// Routes music_recording mentions; MusicBrainz is 1 rps/IP (the user's IP is the
// rate-limit domain), so this runs client-side on all lanes.
import type { Candidate, KbResolver } from "../grounding.js";

interface MbRecording {
  id?: string;
  title?: string;
  score?: number;
  "artist-credit"?: Array<{ name?: string }>;
}

export function parseMusicBrainzRecordings(json: unknown): Candidate[] {
  const recordings = (json as { recordings?: MbRecording[] } | null)?.recordings ?? [];
  const out: Candidate[] = [];
  for (const rec of recordings) {
    if (!rec?.id || !rec.title) continue;
    const artist = (rec["artist-credit"] ?? [])
      .map((a) => a?.name)
      .filter((n): n is string => Boolean(n))
      .join(", ");
    out.push({
      id: rec.id,
      source: "musicbrainz",
      name: rec.title,
      score: typeof rec.score === "number" ? rec.score : undefined,
      meta: artist ? { artist } : undefined,
    });
  }
  return out;
}

export interface MusicBrainzDeps {
  fetchJson: (url: string, headers?: Record<string, string>) => Promise<unknown>;
}

export function createMusicBrainzResolver(deps: MusicBrainzDeps): KbResolver {
  return {
    source: "musicbrainz",
    handles: (type) => type === "music_recording",
    async search(mention) {
      const parts = [`recording:"${mention.surface}"`];
      const artist = mention.hints?.artist;
      if (artist) parts.push(`AND artist:"${artist}"`);
      const query = encodeURIComponent(parts.join(" "));
      const url = `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=5`;
      const json = await deps.fetchJson(url, {
        // SPEC §14 etiquette UA — the Commonplace identifier every KB call must send (wikidata.ts matches).
        "User-Agent": "Commonplace/0.1 (https://commonplacehq.com)",
      });
      return parseMusicBrainzRecordings(json);
    },
  };
}
