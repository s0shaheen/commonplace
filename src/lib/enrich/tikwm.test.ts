// Tests for the tikwm PRIMARY paid adapter's PURE normalizer + signal classifier, against the
// representative fixture. Maps the code/msg/data envelope → desc/author/music/stats/cover/playUrl/
// duration (+ subtitle when present). A `code != 0` / empty payload is a clean failure, and a daily-cap
// message is a QUOTA signal (which the policy fails over to Apify on) — neither throws.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeTikwm, tikwmSignal } from "./tikwm.js";

const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../fixtures/tikwm-sample.json", import.meta.url)), "utf8"),
);

describe("normalizeTikwm", () => {
  it("maps the data envelope → caption/author/music/stats/cover/play/duration", () => {
    const out = normalizeTikwm(sample);
    expect(out.desc).toBe(sample.data.title);
    expect(out.author).toBe("chefanna");
    expect(out.authorName).toBe("Chef Anna");
    expect(out.cover).toBe(sample.data.cover);
    expect(out.playUrl).toBe(sample.data.play);
    expect(out.durationSec).toBe(47);
    expect(out.music).toEqual({ name: "original sound", author: "Chef Anna" });
    expect(out.hashtags).toEqual(["pasta", "weeknightdinner"]);
    expect(out.stats).toEqual({ plays: 2100000, likes: 128400, comments: 812, shares: 3300, collects: 45200 });
  });

  it("maps a subtitle URL when the response carries one", () => {
    const withSub = { code: 0, data: { title: "x", subtitle: "https://www.tikwm.com/video/sub/EXAMPLE.vtt" } };
    expect(normalizeTikwm(withSub).subtitleUrl).toBe("https://www.tikwm.com/video/sub/EXAMPLE.vtt");
  });

  it("a code!=0 / empty payload → an empty partial, never a throw", () => {
    expect(normalizeTikwm({ code: -1, msg: "fail", data: null })).toEqual({});
    expect(normalizeTikwm({})).toEqual({});
    expect(normalizeTikwm(null)).toEqual({});
  });
});

describe("tikwmSignal — ok / error / quota classification", () => {
  it("code 0 with data is ok", () => {
    expect(tikwmSignal(sample)).toEqual({ ok: true, quota: false });
  });

  it("a non-zero code is a failure", () => {
    expect(tikwmSignal({ code: -1, msg: "url parsing is error" })).toEqual({ ok: false, quota: false });
  });

  it("a daily-cap / rate-limit message is a QUOTA signal (→ failover to Apify)", () => {
    expect(tikwmSignal({ code: -1, msg: "Free Api Limit is 5000 requests per day" })).toEqual({ ok: false, quota: true });
    expect(tikwmSignal({ code: -1, msg: "please wait, rate limit" })).toEqual({ ok: false, quota: true });
  });
});
