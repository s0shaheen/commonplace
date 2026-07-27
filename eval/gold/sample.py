"""Deterministic stratified sampler over the real corpus (methodology §3).

The one invariant that makes this file worth existing: **gold is sampled from
the corpus, never pooled from the union of system outputs.** Pooling only ever
confirms what a system already found and never adds what it missed, which
inflates recall — the gold set has to be the independent truth the system is
measured *against*, so it cannot be derived from the thing being measured.

Design, in the order it runs:

1. **Enrich** every corpus item with its stratum (`hasSubtitles` x `isSlideshow`
   x duration tercile), a coarse content bucket, and any hard-case seeds.
2. **Rank** the corpus by a seeded shuffle. Every later tie-break reads this
   rank, which is what makes the whole draw reproducible from `--seed` alone
   and independent of the order the corpus file happened to be written in.
3. **Reserve** the hard slice first (§3 "seed a hard slice deliberately"),
   round-robin across the four ambiguity categories so a rare one — chain
   restaurants are 49 of 4,661 items — cannot be crowded out by proportional
   allocation.
4. **Allocate** the remaining seats across strata: proportional, but with a
   per-stratum floor so rare strata are oversampled rather than rounded to
   zero. Allocation is then bumped where reservations demand it.
5. **Fill** each stratum, preferring under-covered content buckets so one topic
   cannot monopolise a 60-item sample.
6. **Weight** every row `N_h / n_h` (Horvitz-Thompson design weight), so the
   oversampling in steps 3-4 is *corrected*, not baked in: weighted figures
   reweight to the corpus, and the weights sum to the corpus size.
7. **Carve the blind holdout** — 15-20% drawn uniformly at random and flagged,
   per §5.3, so the assisted-vs-blind recall gap measures pre-annotation bias.
8. **Shuffle** the emitted order, so a sitting does not walk one stratum at a
   time (order effects would otherwise correlate with difficulty).

Weights make steps 3-4 statistically safe: deliberately over-representing hard
and rare rows raises the information content of a 60-item sample without
biasing any reweighted estimate.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass, field
from pathlib import Path

from gold import strata

__all__ = [
    "SampleRow",
    "draw_sample",
    "distribution",
    "render_distribution",
    "row_to_dict",
    "row_from_dict",
    "write_sample",
    "read_sample",
    "main",
]

#: Corpus fields carried onto a sample row. Deliberately a whitelist: the
#: corpus is the founder's private data, and `playUrl`/`downloadUrl` are
#: expiring signed URLs that are both useless once stale and worth not copying.
ITEM_FIELDS: tuple[str, ...] = (
    "id",
    "desc",
    "hashtags",
    "author",
    "authorName",
    "durationSec",
    "hasSubtitles",
    "isSlideshow",
    "music",
    "url",
    "cover",
    "subtitleUrl",
)

DEFAULT_N = 60
DEFAULT_SEED = 20260727
DEFAULT_MIN_PER_STRATUM = 2
DEFAULT_BLIND_FRACTION = 0.175  # midpoint of the methodology's 15-20% band
DEFAULT_HARD_FRACTION = 0.20


@dataclass(frozen=True)
class SampleRow:
    """One drawn item plus everything the downstream stages need.

    ``weight`` is the design weight (population / drawn, within the stratum).
    ``blind`` marks the anchoring-bias holdout: those rows are annotated from
    scratch with no suggestions shown. ``hard_case_seeds`` is a "look here"
    hint for the annotator, not a scored label — the scored ``hard_case`` flag
    is set per mention during adjudication.
    """

    item_id: str
    stratum: dict
    stratum_key: str
    content_bucket: str
    weight: float
    blind: bool
    hard_case_seeds: tuple[str, ...] = ()
    duration_known: bool = True
    item: dict = field(default_factory=dict)


@dataclass(frozen=True)
class _Candidate:
    item_id: str
    stratum: dict
    stratum_key: str
    content_bucket: str
    seeds: tuple[str, ...]
    duration_known: bool
    rank: int
    item: dict


# --- enrichment --------------------------------------------------------------
def _enrich(corpus: Sequence[dict], seed: int) -> list[_Candidate]:
    """Attach strata/bucket/seeds and a seeded rank to every corpus item.

    Sorting by ``id`` before shuffling is what makes the draw independent of the
    corpus file's own ordering.
    """
    cuts = strata.duration_cuts([item.get("durationSec") for item in corpus])
    ordered = sorted(corpus, key=lambda i: str(i.get("id", "")))

    ranks = list(range(len(ordered)))
    random.Random(seed).shuffle(ranks)

    out: list[_Candidate] = []
    for rank, item in zip(ranks, ordered, strict=True):
        stratum = strata.stratum_of(item, cuts)
        out.append(
            _Candidate(
                item_id=str(item.get("id", "")),
                stratum=stratum,
                stratum_key=strata.stratum_key(stratum),
                content_bucket=strata.content_bucket(item),
                seeds=strata.hard_case_seeds(item),
                duration_known=bool(item.get("durationSec")),
                rank=rank,
                item={k: item[k] for k in ITEM_FIELDS if k in item},
            )
        )
    return out


# --- allocation --------------------------------------------------------------
def _allocate(population: dict[str, int], n: int, floor: int) -> dict[str, int]:
    """Proportional-with-a-floor allocation of ``n`` seats across strata.

    The floor is the oversampling mechanism (methodology §3 "Oversample rare
    strata"); the greedy largest-deficit pass that follows keeps the big strata
    roughly proportional. Every step is capped by the stratum's population and
    tie-breaks on the stratum key, so the result is deterministic.
    """
    keys = sorted(population)
    alloc = dict.fromkeys(keys, 0)

    for key in keys:
        room = n - sum(alloc.values())
        if room <= 0:
            break
        alloc[key] = max(0, min(floor, population[key], room))

    total_pop = sum(population.values()) or 1
    while sum(alloc.values()) < n:
        candidates = [k for k in keys if alloc[k] < population[k]]
        if not candidates:
            break
        candidates.sort(key=lambda k: (-(population[k] / total_pop * n - alloc[k]), k))
        alloc[candidates[0]] += 1

    return alloc


def _trim_to(alloc: dict[str, int], reserved: Counter, n: int) -> None:
    """Shrink ``alloc`` back to ``n`` seats without evicting a reserved row."""
    while sum(alloc.values()) > n:
        candidates = [k for k in sorted(alloc) if alloc[k] > reserved.get(k, 0)]
        if not candidates:
            break
        candidates.sort(key=lambda k: (-alloc[k], k))
        alloc[candidates[0]] -= 1


# --- hard-slice reservation --------------------------------------------------
def _reserve_hard_slice(
    candidates: Sequence[_Candidate], n: int, hard_fraction: float
) -> list[_Candidate]:
    """Pick real corpus rows for each ambiguity category, round-robin.

    Round-robin rather than "take the top N by rank" so a category with 49
    candidates in 4,661 items is not crowded out by one with 2,873.
    """
    per_category = max(1, math.ceil(n * hard_fraction / len(strata.HARD_CASE_CATEGORIES)))
    by_category: dict[str, list[_Candidate]] = {
        cat: sorted((c for c in candidates if cat in c.seeds), key=lambda c: c.rank)
        for cat in strata.HARD_CASE_CATEGORIES
    }

    reserved: list[_Candidate] = []
    taken: set[str] = set()
    for slot in range(per_category):
        for cat in strata.HARD_CASE_CATEGORIES:
            pool = [c for c in by_category[cat] if c.item_id not in taken]
            # A row already reserved for another category still covers this one.
            if any(cat in c.seeds for c in reserved):
                covered = sum(1 for c in reserved if cat in c.seeds)
                if covered > slot:
                    continue
            if not pool:
                continue
            pick = pool[0]
            reserved.append(pick)
            taken.add(pick.item_id)
            if len(reserved) >= math.ceil(n * hard_fraction):
                return reserved
    return reserved


# --- within-stratum fill -----------------------------------------------------
def _fill_stratum(
    pool: Sequence[_Candidate],
    k: int,
    preselected: Sequence[_Candidate],
    bucket_counts: Counter,
) -> list[_Candidate]:
    """Take ``k`` rows from ``pool``, preferring under-covered content buckets."""
    chosen = list(preselected[:k])
    for c in chosen:
        bucket_counts[c.content_bucket] += 1

    taken = {c.item_id for c in chosen}
    remaining = [c for c in pool if c.item_id not in taken]

    while len(chosen) < k and remaining:
        remaining.sort(key=lambda c: (bucket_counts[c.content_bucket], c.rank))
        pick = remaining.pop(0)
        chosen.append(pick)
        bucket_counts[pick.content_bucket] += 1

    return chosen


# --- the draw ----------------------------------------------------------------
def draw_sample(
    corpus: Sequence[dict],
    *,
    n: int = DEFAULT_N,
    seed: int = DEFAULT_SEED,
    min_per_stratum: int = DEFAULT_MIN_PER_STRATUM,
    blind_fraction: float = DEFAULT_BLIND_FRACTION,
    hard_fraction: float = DEFAULT_HARD_FRACTION,
) -> list[SampleRow]:
    """Draw a reproducible stratified sample of ``n`` items from ``corpus``."""
    if n <= 0 or not corpus:
        return []

    candidates = _enrich(corpus, seed)
    n = min(n, len(candidates))

    by_stratum: dict[str, list[_Candidate]] = {}
    for c in candidates:
        by_stratum.setdefault(c.stratum_key, []).append(c)
    for rows in by_stratum.values():
        rows.sort(key=lambda c: c.rank)

    population = {k: len(v) for k, v in by_stratum.items()}

    reserved = _reserve_hard_slice(candidates, n, hard_fraction)
    reserved_by_stratum: dict[str, list[_Candidate]] = {}
    for c in reserved:
        reserved_by_stratum.setdefault(c.stratum_key, []).append(c)
    for rows in reserved_by_stratum.values():
        rows.sort(key=lambda c: c.rank)

    alloc = _allocate(population, n, min_per_stratum)
    reserved_counts = Counter({k: len(v) for k, v in reserved_by_stratum.items()})
    for key, count in reserved_counts.items():
        alloc[key] = max(alloc[key], min(count, population[key]))
    _trim_to(alloc, reserved_counts, n)

    bucket_counts: Counter = Counter(dict.fromkeys(strata.BUCKETS, 0))
    picked: list[_Candidate] = []
    for key in sorted(alloc):
        if alloc[key] <= 0:
            continue
        picked.extend(
            _fill_stratum(
                by_stratum[key],
                alloc[key],
                reserved_by_stratum.get(key, []),
                bucket_counts,
            )
        )

    drawn_per_stratum = Counter(c.stratum_key for c in picked)

    rng = random.Random(seed ^ 0x5F5F)
    order = sorted(picked, key=lambda c: c.rank)
    blind_n = round(len(order) * blind_fraction)
    blind_ids = set(rng.sample([c.item_id for c in order], blind_n)) if blind_n else set()

    emit = list(order)
    rng.shuffle(emit)

    return [
        SampleRow(
            item_id=c.item_id,
            stratum=dict(c.stratum),
            stratum_key=c.stratum_key,
            content_bucket=c.content_bucket,
            weight=population[c.stratum_key] / drawn_per_stratum[c.stratum_key],
            blind=c.item_id in blind_ids,
            hard_case_seeds=c.seeds,
            duration_known=c.duration_known,
            item=dict(c.item),
        )
        for c in emit
    ]


# --- reporting ---------------------------------------------------------------
def distribution(rows: Sequence[SampleRow], *, corpus_size: int) -> dict:
    """The realized distribution — the evidence that a sample is sound."""
    by_key = Counter(r.stratum_key for r in rows)
    weights = {r.stratum_key: r.weight for r in rows}
    strata_rows = [
        {
            "stratum_key": key,
            "n": count,
            "share": count / len(rows) if rows else 0.0,
            "corpus_n": round(weights[key] * count),
            "corpus_share": (weights[key] * count) / corpus_size if corpus_size else 0.0,
            "weight": weights[key],
        }
        for key, count in sorted(by_key.items())
    ]

    buckets = Counter(r.content_bucket for r in rows)
    seeds = Counter(cat for r in rows for cat in r.hard_case_seeds)
    blind_n = sum(1 for r in rows if r.blind)

    return {
        "n": len(rows),
        "corpus_size": corpus_size,
        "strata": strata_rows,
        "content_buckets": [
            {"bucket": b, "n": c} for b, c in sorted(buckets.items(), key=lambda kv: -kv[1])
        ],
        "hard_case_seeds": dict(sorted(seeds.items())),
        "hard_case_rows": sum(1 for r in rows if r.hard_case_seeds),
        "blind": {
            "n": blind_n,
            "share": blind_n / len(rows) if rows else 0.0,
        },
        "weight_sum": sum(r.weight for r in rows),
    }


def render_distribution(dist: dict) -> str:
    """Render :func:`distribution` as a plain-text table for the console."""
    lines: list[str] = []
    lines.append(f"n = {dist['n']}   corpus = {dist['corpus_size']}")
    lines.append("")
    lines.append(f"{'stratum':<22} {'n':>4} {'share':>8} {'corpus':>8} {'weight':>8}")
    lines.append("-" * 54)
    for s in dist["strata"]:
        lines.append(
            f"{s['stratum_key']:<22} {s['n']:>4} {s['share']:>7.1%} "
            f"{s['corpus_share']:>7.1%} {s['weight']:>8.2f}"
        )
    lines.append("")
    lines.append(f"{'content bucket':<22} {'n':>4}")
    lines.append("-" * 28)
    for b in dist["content_buckets"]:
        lines.append(f"{b['bucket']:<22} {b['n']:>4}")
    lines.append("")
    lines.append(f"{'hard-case seed':<22} {'n':>4}")
    lines.append("-" * 28)
    for cat, count in dist["hard_case_seeds"].items():
        lines.append(f"{cat:<22} {count:>4}")
    lines.append(f"{'(rows with >=1 seed)':<22} {dist['hard_case_rows']:>4}")
    lines.append("")
    lines.append(f"blind holdout: {dist['blind']['n']} ({dist['blind']['share']:.1%})")
    lines.append(f"weight sum:    {dist['weight_sum']:.1f} (= corpus size when correct)")
    return "\n".join(lines)


# --- serialisation -----------------------------------------------------------
def row_to_dict(row: SampleRow) -> dict:
    d = asdict(row)
    d["hard_case_seeds"] = list(row.hard_case_seeds)
    return d


def row_from_dict(d: dict) -> SampleRow:
    return SampleRow(
        item_id=d["item_id"],
        stratum=d["stratum"],
        stratum_key=d["stratum_key"],
        content_bucket=d["content_bucket"],
        weight=d["weight"],
        blind=d["blind"],
        hard_case_seeds=tuple(d.get("hard_case_seeds") or ()),
        duration_known=d.get("duration_known", True),
        item=d.get("item") or {},
    )


def write_sample(
    rows: Iterable[SampleRow],
    path,
    *,
    seed: int | None = None,
    corpus_size: int | None = None,
) -> None:
    """Write ``sample.jsonl`` and, when ``seed`` is given, a sidecar manifest.

    The manifest is where reproducibility lives: the seed, the parameters, and
    the realized distribution. It sits beside gold rather than inside them
    because ``gold.schema.json`` is frozen and closed (`additionalProperties:
    false`) — the join key is ``item_id``.
    """
    rows = list(rows)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row_to_dict(row), ensure_ascii=False) + "\n")

    if seed is not None:
        manifest = {
            "seed": seed,
            "n": len(rows),
            "corpus_size": corpus_size if corpus_size is not None else len(rows),
            "distribution": distribution(
                rows, corpus_size=corpus_size if corpus_size is not None else len(rows)
            ),
        }
        manifest_path = path.with_name(path.stem + ".manifest.json")
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def read_sample(path) -> list[SampleRow]:
    rows: list[SampleRow] = []
    with Path(path).open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(row_from_dict(json.loads(line)))
    return rows


# --- CLI ---------------------------------------------------------------------
def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="gold.sample",
        description="Draw a deterministic stratified gold sample from the corpus.",
    )
    p.add_argument("--corpus", required=True, help="corpus JSON (a list of items)")
    p.add_argument("--out", required=True, help="write sample JSONL here")
    p.add_argument("--n", type=int, default=DEFAULT_N, help=f"sample size (default {DEFAULT_N})")
    p.add_argument("--seed", type=int, default=DEFAULT_SEED, help="RNG seed (recorded)")
    p.add_argument("--min-per-stratum", type=int, default=DEFAULT_MIN_PER_STRATUM)
    p.add_argument("--blind-fraction", type=float, default=DEFAULT_BLIND_FRACTION)
    p.add_argument("--hard-fraction", type=float, default=DEFAULT_HARD_FRACTION)
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    corpus_path = Path(args.corpus)
    if not corpus_path.is_file():
        print(f"error: corpus not found: {corpus_path}", file=sys.stderr)
        return 2

    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    if isinstance(corpus, dict):
        corpus = corpus.get("items") or corpus.get("data") or []
    if not isinstance(corpus, list) or not corpus:
        print(f"error: corpus {corpus_path} is not a non-empty list of items", file=sys.stderr)
        return 2

    rows = draw_sample(
        corpus,
        n=args.n,
        seed=args.seed,
        min_per_stratum=args.min_per_stratum,
        blind_fraction=args.blind_fraction,
        hard_fraction=args.hard_fraction,
    )
    write_sample(rows, args.out, seed=args.seed, corpus_size=len(corpus))

    print(render_distribution(distribution(rows, corpus_size=len(corpus))))
    print(f"\nwrote {len(rows)} rows -> {args.out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
