import { test } from "node:test";
import assert from "node:assert/strict";
import { extractItems, mergeDedupe, normalizeItem } from "./capture.js";

// Mirrors the real /api/user/collect/item_list/ shape observed in recon.
const realItem = {
  id: "7578265440993199126",
  desc: "he made the sacrifice play. #ironman",
  createTime: 1775813549,
  author: { uniqueId: "no1persona", nickname: "persona" },
  video: {
    id: "7578265440993199126",
    playAddr: "https://v16.../play",
    downloadAddr: "https://v16.../dl",
    cover: "https://p19.../cover",
    duration: 78,
    subtitleInfos: [{ LanguageCodeName: "eng-US" }],
  },
  music: { id: "123", title: "original sound", authorName: "persona" },
  challenges: [{ title: "ironman" }, { title: "avengers" }],
  stats: { playCount: 1000, diggCount: 50, commentCount: 5, shareCount: 2, collectCount: 9 },
};

test("normalizeItem keeps the 19-digit id as a string", () => {
  const out = normalizeItem(realItem);
  assert.equal(out.id, "7578265440993199126");
  assert.equal(typeof out.id, "string");
});

test("normalizeItem builds the canonical url, stats, music, hashtags, subtitle flag", () => {
  const out = normalizeItem(realItem);
  assert.equal(out.url, "https://www.tiktok.com/@no1persona/video/7578265440993199126");
  assert.equal(out.author, "no1persona");
  assert.equal(out.playUrl, "https://v16.../play");
  assert.equal(out.durationSec, 78);
  assert.equal(out.hasSubtitles, true);
  assert.deepEqual(out.hashtags, ["ironman", "avengers"]);
  assert.equal(out.music.name, "original sound");
  assert.deepEqual(out.stats, { plays: 1000, likes: 50, comments: 5, shares: 2, collects: 9 });
});

test("extractItems reads itemList and drops entries without an id", () => {
  const out = extractItems({ itemList: [realItem, { desc: "no id", video: {} }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "7578265440993199126");
});

test("extractItems handles empty / missing payloads", () => {
  assert.deepEqual(extractItems({}), []);
  assert.deepEqual(extractItems(null), []);
});

test("mergeDedupe upserts by id", () => {
  const a = [{ id: "1", desc: "old" }];
  const b = [{ id: "1", desc: "new" }, { id: "2", desc: "two" }];
  const merged = mergeDedupe(a, b);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((x) => x.id === "1").desc, "new");
});
