"""Pre-annotation with a DIFFERENT model family than the pipeline (methodology §5.1).

The extraction pipeline under evaluation is Gemini, so the pre-annotator is
**Claude**. That is a methodology requirement, not a preference: a Gemini
pre-annotator grading a Gemini pipeline shares its blind spots, so agreement
measures a correlated error rather than correctness, and self-preference
inflates it further. Substituting the family is therefore not a free swap — it
weakens the independence claim the artifact rests on. This module makes that
cost visible rather than silent:

* the substitution needs an explicit, deliberately awkward CLI flag, and
* ``preannotator_family`` is stamped on the payload **and on every item**, so
  a substituted run is legible in the artifact forever.

Suggestions are never answers (guidelines.md §1.3). Nothing emitted here
carries a ``gold_id``, a ``nil``, or a "verified" bit — only *candidates* to
adjudicate. The review tool re-derives every decision from the human pass, and
the ID gate there means even a correct candidate cannot become gold until the
annotator opens its authoritative record.

**Blind rows never reach the model at all** — they are the anchoring-bias
control (§5.3), and a suggestion leaking onto one would destroy the measurement
it exists to make.

Status: this path is BUILT and unit-tested against a recorded response, but has
never been run. ``ANTHROPIC_API_KEY`` is not present in this repo; the CLI
fails with an actionable message rather than silently degrading to a weaker
pre-annotator.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections.abc import Sequence
from functools import cache
from pathlib import Path
from typing import Protocol, runtime_checkable

__all__ = [
    "MissingApiKey",
    "Annotator",
    "AnthropicAnnotator",
    "NullAnnotator",
    "load_api_key",
    "build_suggestions",
    "main",
]

#: Per the claude-api reference; adaptive thinking is this model's default.
DEFAULT_MODEL = "claude-opus-5"
DEFAULT_MAX_TOKENS = 8000
CLAUDE_FAMILY = "anthropic"

TYPES: tuple[str, ...] = (
    "music_recording", "place", "screen_work", "book", "person",
    "product", "brand_org", "software_app", "game",
)
AUTHORITIES: tuple[str, ...] = ("musicbrainz", "google_places", "wikidata", "openlibrary")


class MissingApiKey(RuntimeError):
    """Raised when the Anthropic key needed for the §5.1 pre-annotator is absent."""


@runtime_checkable
class Annotator(Protocol):
    """The pluggable pre-annotator seam.

    ``family``/``model`` are stamped onto every record, so any implementation
    is self-identifying on the artifact it produced.
    """

    family: str
    model: str

    def annotate(self, row: dict) -> dict:
        """Return a suggestions dict for one sample row. Never raises for
        model-side failures — a per-item ``error`` is recorded instead, so one
        bad item cannot abort a whole run."""


# --- repo / vocab ------------------------------------------------------------
@cache
def _repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "schema" / "vocab").is_dir():
            return parent
    raise FileNotFoundError("could not locate repo root containing schema/vocab")


@cache
def facet_vocab() -> dict[str, tuple[str, ...]]:
    data = json.loads((_repo_root() / "schema" / "vocab" / "facets.json").read_text())
    return {name: tuple(spec["values"]) for name, spec in data["facets"].items()}


# --- key loading -------------------------------------------------------------
_ENV_LINE = re.compile(r"^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$")


def load_api_key(env_path=None, var: str = "ANTHROPIC_API_KEY") -> str | None:
    """Read ``var`` from the process environment, else from ``.env.local``.

    The process environment wins so a shell export can override the file
    without editing it. Returns ``None`` when the key is absent or empty —
    never a placeholder, because a placeholder would fail at request time with
    a 401 instead of at startup with an explanation.
    """
    from_env = os.environ.get(var, "").strip()
    if from_env:
        return from_env

    path = Path(env_path) if env_path is not None else _repo_root() / ".env.local"
    if not path.is_file():
        return None

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith("#"):
            continue
        match = _ENV_LINE.match(line)
        if not match or match.group(1) != var:
            continue
        value = match.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        return value.strip() or None
    return None


# --- prompt + schema ---------------------------------------------------------
def _facet_lines() -> str:
    return "\n".join(f"  - {name}: {', '.join(values)}" for name, values in facet_vocab().items())


def build_system_prompt() -> str:
    """The codebook, compressed — built from the FROZEN vocabularies so it
    cannot drift from what the review tool and the schema gate enforce."""
    return f"""You are pre-annotating short-form video metadata for an entity-grounding \
benchmark. Your output is a set of SUGGESTIONS for a human adjudicator, never an answer. \
The adjudicator confirms or overrides every one of them, and independently verifies every \
identifier against its authoritative record, so a confident guess costs them time while an \
honest omission costs nothing.

A mention is worth extracting when it names a RIGID INDIVIDUAL — one specific, persistent, \
re-identifiable thing a saver would return to — that could in principle resolve to a durable \
external ID. A category ("a good pizza place"), a technique ("cable lateral raise"), a role \
("a nutritionist"), or a mood is NOT an entity; leave those out of mentions. Over-typing \
generic services and kinds into entities is the single error to avoid.

The nine groundable types, with the authority each resolves to:
  - music_recording -> musicbrainz (the RECORDING that plays, never the composition)
  - place -> google_places (a specific outlet; a chain named as a brand is brand_org)
  - screen_work -> wikidata (film / TV / series)
  - book -> openlibrary or wikidata
  - person -> wikidata (public figures and named creators only)
  - product, brand_org, software_app, game -> wikidata

Candidate IDs: propose at most two per mention, and ONLY when you have real reason to \
believe the identifier exists and is correct. An empty candidate list is the right answer \
whenever you are unsure — the adjudicator will search. Never invent an identifier, and never \
propose one purely because the name matches: a confidently wrong durable ID is the worst \
outcome this benchmark measures. Many mentions legitimately have NO id (a platform "original \
sound", a small local cafe, an indie product) — those are valid NIL answers for the human to \
record, so still list the mention with no candidates.

Also suggest:
  - concepts: kinds/ideas pinned to an authority node (e.g. a Wikidata QID), not entities
  - facets: item-level descriptors, values from this CLOSED vocabulary only:
{_facet_lines()}
  - claims: propositions the video asserts (faithfulness to the video, never world-truth)

Use only the evidence given. Do not speculate about what the video probably shows."""


def build_output_schema() -> dict:
    """A structured-outputs schema within the documented constraints.

    No recursion, no numeric or length constraints, ``additionalProperties:
    false`` and an explicit ``required`` on every object.
    """
    candidate = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "authority": {"type": "string", "enum": list(AUTHORITIES)},
            "id": {"type": "string"},
            "label": {"type": "string"},
        },
        "required": ["authority", "id", "label"],
    }
    mention = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "surface": {"type": "string"},
            "type": {"type": "string", "enum": list(TYPES)},
            "aliases": {"type": "array", "items": {"type": "string"}},
            "candidates": {"type": "array", "items": candidate},
            "confidence": {"type": "number"},
            "evidence": {"type": "string"},
        },
        "required": ["surface", "type", "aliases", "candidates", "confidence", "evidence"],
    }
    concept = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "concept_id": {"type": "string"},
            "authority": {"type": "string"},
            "label": {"type": "string"},
        },
        "required": ["concept_id", "authority", "label"],
    }
    facet = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "facet": {"type": "string", "enum": list(facet_vocab())},
            "value": {"type": "string"},
        },
        "required": ["facet", "value"],
    }
    claim = {
        "type": "object",
        "additionalProperties": False,
        "properties": {"statement": {"type": "string"}},
        "required": ["statement"],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "mentions": {"type": "array", "items": mention},
            "concepts": {"type": "array", "items": concept},
            "facets": {"type": "array", "items": facet},
            "claims": {"type": "array", "items": claim},
        },
        "required": ["mentions", "concepts", "facets", "claims"],
    }


def build_user_prompt(row: dict) -> str:
    """Everything known about the item — nothing inferred."""
    item = row.get("item") or {}
    content = row.get("content") or {}
    music = item.get("music") or {}
    parts = [
        "Here is everything known about one saved video.",
        "",
        f"caption: {item.get('desc') or '(none — this video has no caption)'}",
        f"hashtags: {', '.join(item.get('hashtags') or []) or '(none)'}",
        f"creator: {item.get('authorName') or ''} (@{item.get('author') or ''})",
        f"attached sound: {music.get('name') or '(none)'}"
        + (f" — {music['author']}" if music.get("author") else ""),
        f"duration: {item.get('durationSec') or 'n/a'}s"
        + ("  [slideshow]" if item.get("isSlideshow") else ""),
        f"url: {item.get('url') or ''}",
    ]
    if content.get("transcript"):
        parts += ["", "transcript:", content["transcript"]]
    if content.get("on_screen_text"):
        parts += ["", "on-screen text:", content["on_screen_text"]]
    parts += ["", "Suggest mentions, concepts, facets and claims for a human to adjudicate."]
    return "\n".join(parts)


# --- normalisation -----------------------------------------------------------
def _empty() -> dict:
    return {"mentions": [], "concepts": [], "facets": {}, "claims": []}


def normalise(raw: dict) -> dict:
    """Coerce a model payload into the review tool's suggestion shape.

    Anything outside the frozen ontology is dropped rather than passed through:
    an invalid type or facet value would only reach the founder as a suggestion
    he has to reject, which is the one cost the pre-annotation exists to avoid.
    Mentions survive the loss of a bad candidate — the surface is still worth
    adjudicating.
    """
    out = _empty()

    for m in raw.get("mentions") or []:
        if not isinstance(m, dict):
            continue
        surface = str(m.get("surface") or "").strip()
        mention_type = m.get("type")
        if not surface or mention_type not in TYPES:
            continue
        candidates = [
            {
                "authority": c.get("authority"),
                "id": str(c.get("id") or "").strip(),
                "label": str(c.get("label") or ""),
            }
            for c in (m.get("candidates") or [])
            if isinstance(c, dict)
            and c.get("authority") in AUTHORITIES
            and str(c.get("id") or "").strip()
        ]
        out["mentions"].append(
            {
                "surface": surface,
                "type": mention_type,
                "aliases": [str(a) for a in (m.get("aliases") or []) if str(a).strip()],
                "candidates": candidates,
                "confidence": m.get("confidence") if isinstance(m.get("confidence"), (int, float)) else None,
                "evidence": str(m.get("evidence") or ""),
            }
        )

    for c in raw.get("concepts") or []:
        if isinstance(c, dict) and str(c.get("concept_id") or "").strip():
            out["concepts"].append(
                {
                    "concept_id": str(c["concept_id"]).strip(),
                    "authority": str(c.get("authority") or "wikidata"),
                    "label": str(c.get("label") or ""),
                }
            )

    vocab = facet_vocab()
    facets = raw.get("facets") or []
    pairs = facets.items() if isinstance(facets, dict) else (
        (f.get("facet"), f.get("value")) for f in facets if isinstance(f, dict)
    )
    for name, value in pairs:
        if name in vocab and value in vocab[name]:
            out["facets"][name] = value

    for c in raw.get("claims") or []:
        if isinstance(c, dict) and str(c.get("statement") or "").strip():
            out["claims"].append({"statement": str(c["statement"]).strip()})

    return out


# --- annotators --------------------------------------------------------------
class NullAnnotator:
    """Produces empty suggestions without calling anything.

    Exists so the sampler -> review-tool contract can be exercised end to end
    before the Anthropic key lands. Its family is ``none``, which is stamped on
    the artifact like any other, so a dry-run file can never be mistaken for a
    real pre-annotated one.
    """

    family = "none"
    model = "none"

    def annotate(self, row: dict) -> dict:
        return _empty()


class AnthropicAnnotator:
    """The §5.1 pre-annotator: Claude, a different family than the pipeline.

    ``client`` is injectable so the request this builds and the parsing of a
    recorded response are unit-tested without a network call. The real client
    is imported lazily, so the ``anthropic`` SDK is only needed by operators
    who actually run pre-annotation — the scoring harness stays dependency-light.
    """

    family = CLAUDE_FAMILY

    def __init__(
        self,
        api_key: str | None = None,
        *,
        model: str = DEFAULT_MODEL,
        client=None,
        env_path=None,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ):
        self.model = model
        self.max_tokens = max_tokens
        self._system = build_system_prompt()
        self._schema = build_output_schema()

        if client is not None:
            self._client = client
            return

        key = api_key or load_api_key(env_path=env_path)
        if not key:
            raise MissingApiKey(
                "ANTHROPIC_API_KEY is not set.\n"
                "\n"
                "The gold set's pre-annotator must be a DIFFERENT model family than the\n"
                "pipeline under evaluation (Gemini) — evaluation-methodology.md §5.1. Using\n"
                "Gemini to pre-annotate a Gemini pipeline would inflate agreement through\n"
                "correlated errors and self-preference, so there is no safe silent fallback.\n"
                "\n"
                "Fix one of:\n"
                "  1. add  ANTHROPIC_API_KEY=sk-ant-...  to .env.local  (gitignored), or\n"
                "  2. export ANTHROPIC_API_KEY in your shell.\n"
                "\n"
                "To exercise the review tool before the key exists, run with --dry-run\n"
                "(empty suggestions, stamped preannotator_family=none)."
            )

        try:
            import anthropic  # noqa: PLC0415 - optional dependency, operators only
        except ImportError as exc:  # pragma: no cover - environment-dependent
            raise MissingApiKey(
                "the `anthropic` SDK is not installed.\n"
                "It is an optional dependency so the scoring harness stays light:\n"
                "  cd eval && uv sync --group preannotate"
            ) from exc

        self._client = anthropic.Anthropic(api_key=key)

    def annotate(self, row: dict) -> dict:
        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self._system,
                thinking={"type": "adaptive"},
                output_config={"format": {"type": "json_schema", "schema": self._schema}},
                messages=[{"role": "user", "content": build_user_prompt(row)}],
            )
        except Exception as exc:  # noqa: BLE001 - one bad item must not abort the run
            return dict(_empty(), error=f"request failed: {exc}")

        # Safety classifiers can decline a request; that arrives as a normal
        # 200 with stop_reason "refusal" and possibly no content at all, so it
        # is checked before anything reads response.content.
        if getattr(response, "stop_reason", None) == "refusal":
            details = getattr(response, "stop_details", None)
            category = getattr(details, "category", None) if details else None
            return dict(_empty(), error=f"refusal ({category or 'unspecified'})")

        text = "".join(
            getattr(block, "text", "")
            for block in getattr(response, "content", []) or []
            if getattr(block, "type", "") == "text"
        )
        try:
            raw = json.loads(text)
        except (TypeError, ValueError) as exc:
            return dict(_empty(), error=f"unparseable model output: {exc}")

        return normalise(raw)


# --- payload assembly --------------------------------------------------------
def build_suggestions(
    rows: Sequence[dict], annotator: Annotator, *, seed: int | None = None, dry_run: bool = False
) -> dict:
    """Run ``annotator`` over the assisted rows and assemble the review payload.

    Blind rows are skipped entirely — not merely stripped afterwards — so no
    suggestion can leak onto the anchoring-bias control.
    """
    family = getattr(annotator, "family", "unknown")
    substituted = family not in (CLAUDE_FAMILY, "none")

    items = []
    for row in rows:
        blind = bool(row.get("blind"))
        items.append(
            {
                "item_id": row.get("item_id"),
                "blind": blind,
                "stratum": row.get("stratum"),
                "stratum_key": row.get("stratum_key"),
                "content_bucket": row.get("content_bucket"),
                "weight": row.get("weight"),
                "hard_case_seeds": row.get("hard_case_seeds") or [],
                "item": row.get("item") or {},
                "content": row.get("content") or {},
                "preannotator_family": family,
                "suggestions": None if blind else annotator.annotate(row),
            }
        )

    payload = {
        "version": "1.0",
        "n": len(items),
        "blind_n": sum(1 for i in items if i["blind"]),
        "seed": seed,
        "dry_run": dry_run,
        "preannotator_family": family,
        "preannotator_model": getattr(annotator, "model", "unknown"),
        "family_substituted": substituted,
        "items": items,
    }
    if substituted:
        payload["substitution_warning"] = (
            f"Pre-annotated with family '{family}', not Claude. "
            "evaluation-methodology.md §5.1 requires a different model family than the "
            "pipeline under evaluation; if this family matches the pipeline, agreement is "
            "inflated by correlated errors and self-preference, and any independence claim "
            "based on this gold set is weaker than stated."
        )
    return payload


# --- CLI ---------------------------------------------------------------------
def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="gold.preannotate",
        description="Pre-annotate a gold sample with Claude (a different family than the pipeline).",
    )
    p.add_argument("--sample", required=True, help="sample JSONL from gold.sample")
    p.add_argument("--out", required=True, help="write suggestions JSON here")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--env", default=None, help="path to .env.local (default: repo root)")
    p.add_argument("--limit", type=int, default=0, help="annotate only the first N rows")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="emit empty suggestions without calling any model (exercises the review tool)",
    )
    p.add_argument(
        "--family",
        default=CLAUDE_FAMILY,
        help="pre-annotator family (only 'anthropic' satisfies methodology §5.1)",
    )
    p.add_argument(
        "--i-accept-a-weaker-independence-claim",
        action="store_true",
        help="required to use a non-Claude family; the substitution is stamped on every record",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    sample_path = Path(args.sample)
    if not sample_path.is_file():
        print(f"error: sample not found: {sample_path}", file=sys.stderr)
        return 2

    rows = [json.loads(line) for line in sample_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if args.limit:
        rows = rows[: args.limit]

    if args.family != CLAUDE_FAMILY and not args.i_accept_a_weaker_independence_claim:
        print(
            f"error: --family {args.family} is not the methodology's pre-annotator.\n"
            "\n"
            "evaluation-methodology.md §5.1 requires a model family DIFFERENT from the\n"
            "pipeline under evaluation (Gemini). Substituting one silently would weaken the\n"
            "artifact's independence claim without leaving a trace, so it is opt-in:\n"
            "\n"
            "  re-run with --i-accept-a-weaker-independence-claim\n"
            "\n"
            "The substitution is then stamped on the payload and on every item record.",
            file=sys.stderr,
        )
        return 2

    annotator: Annotator
    if args.dry_run:
        annotator = NullAnnotator()
    elif args.family == CLAUDE_FAMILY:
        try:
            annotator = AnthropicAnnotator(model=args.model, env_path=args.env)
        except MissingApiKey as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 3
    else:
        print(
            f"error: no pre-annotator is implemented for family '{args.family}'.\n"
            "Only the Anthropic (Claude) pre-annotator ships — deliberately, because it is\n"
            "the one the methodology sanctions. Implement the Annotator protocol to add one.",
            file=sys.stderr,
        )
        return 4

    payload = build_suggestions(rows, annotator, dry_run=args.dry_run)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    errors = sum(1 for i in payload["items"] if (i["suggestions"] or {}).get("error"))
    print(
        f"wrote {payload['n']} items ({payload['blind_n']} blind, no suggestions) -> {args.out}\n"
        f"pre-annotator: {payload['preannotator_family']} / {payload['preannotator_model']}"
        + (f"\nitems with errors: {errors}" if errors else "")
    )
    if payload["family_substituted"]:
        print(f"WARNING: {payload['substitution_warning']}", file=sys.stderr)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
