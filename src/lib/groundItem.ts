// Per-item grounding orchestration: turn one item's extracted MENTIONS into GroundedEntities.
//
// Pipeline per unique mention: build a Mention (+ disambiguation hints) → dedupe by mentionKey
// (50 saves of the same song = 1 lookup) → cache lookup → groundMention (resolve → LLM select →
// confidence gate → NIL) → cache the result.
//
// THE GROUNDING INVARIANT: a mention whose type has NO available resolver (e.g. `place` while
// Places is disabled / un-keyed, so its resolver is absent from `deps.resolvers`) is NOT grounded
// and NOT cached — it is recorded once in `regroundPending` so a later pass can revisit it when a
// resolver appears. That is categorically different from a NIL. A NIL (`resolved:false`) means "a
// resolver looked and we abstained" — a measured metric (candidate count, confidence) that feeds
// calibration. Unavailable ≠ NIL: never fabricate a NIL for something we couldn't even look up.
import type { CapturedItem, MentionOut, NamedEntityType } from "./types.js";
import { groundMention, type GroundedEntity, type GroundingDeps, type Mention } from "./grounding.js";
import { mentionKey } from "./entities.js";

export interface GroundItemResult {
  groundings: GroundedEntity[];
  regroundPending: NamedEntityType[];
}

export interface GroundItemDeps extends GroundingDeps {
  cacheGet(key: string): Promise<GroundedEntity | undefined>;
  cachePut(key: string, g: GroundedEntity): Promise<void>;
}

/** MentionOut (model output) → Mention (grounding input), attaching disambiguation hints. */
function toMention(item: CapturedItem, m: MentionOut): Mention {
  const hints: Record<string, string> = {};
  // music_recording: the item's music author is the strongest disambiguator for MusicBrainz.
  if (m.type === "music_recording" && item.music?.author) hints.artist = item.music.author;
  // place: hints.locale would come from caption geo words — v1 extracts none, so hints stay empty.
  return {
    surface: m.surface,
    type: m.type,
    hints: Object.keys(hints).length ? hints : undefined,
  };
}

export async function groundItemMentions(
  item: CapturedItem,
  mentions: MentionOut[],
  deps: GroundItemDeps,
): Promise<GroundItemResult> {
  const groundings: GroundedEntity[] = [];
  const regroundPending: NamedEntityType[] = [];
  const seenKeys = new Set<string>();
  const pendingTypes = new Set<NamedEntityType>();

  for (const raw of mentions) {
    const mention = toMention(item, raw);
    const key = mentionKey(mention);
    if (seenKeys.has(key)) continue; // dedupe: same type+normalized-surface = one lookup
    seenKeys.add(key);

    // Availability first: an absent resolver means we CAN'T look — defer, never NIL.
    const available = deps.resolvers.some((r) => r.handles(mention.type));
    if (!available) {
      if (!pendingTypes.has(mention.type)) {
        pendingTypes.add(mention.type);
        regroundPending.push(mention.type);
      }
      continue; // no GroundedEntity, no cache write
    }

    const cached = await deps.cacheGet(key);
    if (cached) {
      groundings.push(cached);
      continue;
    }

    const grounding = await groundMention(mention, deps);
    groundings.push(grounding);
    // Cache both resolved and NIL: "we looked and abstained" is durable + metric-bearing.
    await deps.cachePut(key, grounding);
  }

  return { groundings, regroundPending };
}
