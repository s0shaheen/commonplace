// Ambient types for the JS capture helpers (capture.js stays JS: it is exercised by
// capture.test.js under node:test). Loose by design — the spike record shape is not the
// frozen schema; Task 3 replaces the internals that consume these.

export interface SpikeItem {
  id: string;
  sources: string[];
  desc: string;
  createTime: number | null;
  author: string | null;
  authorName: string | null;
  url: string | null;
  playUrl: string | null;
  downloadUrl: string | null;
  cover: string | null;
  durationSec: number | null;
  hasSubtitles: boolean;
  subtitleUrl: string | null;
  isSlideshow: boolean;
  music: { name: string | null; author: string | null } | null;
  hashtags: string[];
  stats: Record<string, number | null>;
}

export function normalizeItem(it: unknown, source?: string | null): SpikeItem;
export function extractItems(payload: unknown, source?: string | null): SpikeItem[];
export function mergeDedupe(existing: SpikeItem[], incoming: SpikeItem[]): SpikeItem[];
