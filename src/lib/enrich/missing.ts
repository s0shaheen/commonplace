// PURE content-gap detectors (design.md → "Pipeline placement" / the needsEnrichment gate).
//
// `needsEnrichment` is the COARSE gate the pipeline runs BEFORE any lane: an item is content-poor iff
// it lacks a caption OR a poster. This is exactly the spec's skip rule — a live capture carries a
// caption + poster and proceeds straight to analysis with no enrichment network call, even when it has
// no transcript (a transcript alone never pulls a content-rich item onto the network; depth is only
// pursued as a bonus once an item is already being enriched). `missingFields` derives the per-aspect
// flags tierPolicy reads to pick a lane and to decide skip vs exhausted.
//
// PURE: total functions of the item (no clock/rng/IO).

import type { CapturedItem } from "../types.js";
import type { MissingFields } from "./types.js";

function noCaption(item: CapturedItem): boolean {
  return item.desc.trim() === "";
}

function noPoster(item: CapturedItem): boolean {
  return item.cover == null;
}

function noTranscript(item: CapturedItem): boolean {
  return item.subtitleUrl == null && item.hasSubtitles !== true;
}

/** The coarse pre-network gate: content-poor iff a caption OR a poster is missing. */
export function needsEnrichment(item: CapturedItem): boolean {
  return noCaption(item) || noPoster(item);
}

/** Per-aspect gaps for the policy. Transcript counts present if a URL exists OR hasSubtitles is set. */
export function missingFields(item: CapturedItem): MissingFields {
  return {
    caption: noCaption(item),
    poster: noPoster(item),
    transcript: noTranscript(item),
  };
}
