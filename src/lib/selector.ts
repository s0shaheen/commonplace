// LLM "select" disambiguation (SPEC §14: "one batched LLM select over candidates with clip
// context"). Candidate GENERATION is the KB endpoint; this is the DISAMBIGUATION step: given a
// mention + the KB's candidate list, the model picks one index with a calibrated confidence, or
// abstains. It NEVER invents an ID — it only chooses among candidates the resolvers produced.
//
// Abstention discipline: a confidently-wrong link is worse than none, so every non-pick path
// (explicit null, out-of-range index, non-integer/NaN index, malformed/non-JSON reply) collapses
// to `null` — abstain. This function NEVER throws on a bad model reply.
import type { Candidate, Mention, Selector } from "./grounding.js";

export function createLlmSelector(callModel: (prompt: string) => Promise<string>): Selector {
  return async (mention, candidates) => {
    const reply = await callModel(buildSelectPrompt(mention, candidates));
    return parseSelection(reply, candidates.length);
  };
}

function buildSelectPrompt(mention: Mention, candidates: Candidate[]): string {
  const hints = mention.hints
    ? Object.entries(mention.hints)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")
    : "(none)";
  const lines = candidates.map((c, i) => {
    const meta = c.meta ? ` — ${Object.values(c.meta).join(" · ")}` : "";
    return `  ${i}. ${c.name}${meta}`;
  });
  return [
    "You are disambiguating an extracted entity mention against a list of knowledge-base candidates.",
    "",
    `Mention surface: ${mention.surface}`,
    `Mention type: ${mention.type}`,
    `Context hints: ${hints}`,
    "",
    "Candidates:",
    ...lines,
    "",
    'Reply with ONLY JSON: {"index": <int>, "confidence": <0..1>} for the best match,',
    'or {"index": null} to abstain if none is clearly correct. Do not add prose.',
  ].join("\n");
}

/** Parse a model reply into a pick, or null to abstain. Never throws. */
export function parseSelection(
  reply: string,
  candidateCount: number,
): { index: number; confidence: number } | null {
  const obj = tryParseJsonObject(reply);
  if (!obj) return null;

  const index = obj.index;
  // Explicit abstention, or any non-integer / NaN index.
  if (index === null || index === undefined) return null;
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  // Out-of-range index → abstain (the model referenced a candidate that isn't there).
  if (index < 0 || index >= candidateCount) return null;

  const raw = obj.confidence;
  const confidence = typeof raw === "number" && Number.isFinite(raw) ? clamp01(raw) : 0;
  return { index, confidence };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function tryParseJsonObject(reply: string): Record<string, unknown> | null {
  const trimmed = (reply ?? "").trim();
  const attempts = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());
  const braced = trimmed.match(/\{[\s\S]*\}/);
  if (braced?.[0]) attempts.push(braced[0]);
  for (const a of attempts) {
    try {
      const parsed: unknown = JSON.parse(a);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate slice
    }
  }
  return null;
}
