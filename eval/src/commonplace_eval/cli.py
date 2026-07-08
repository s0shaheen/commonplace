"""``commonplace-eval`` — the command-line face of the eval instrument.

Three subcommands, stdlib ``argparse`` only:

* ``score`` — load a gold + prediction JSONL, build the per-layer scorecard, write
  the JSON report (``--out``) and/or the markdown matrix (``--md``), and print the
  matrix to stdout. ``--bootstrap`` sets B for the clustered CIs.
* ``check-schemas`` — validate every ``schema/fixtures/valid`` (must pass) and
  ``schema/fixtures/invalid`` (must fail) against ``item.schema.json``; print a
  pass/fail matrix and exit non-zero if ANY fixture lands on the wrong side (a
  valid one that fails, or an invalid one that passes) — the schema's own
  regression gate.
* ``validate-matcher`` — score the matcher against human-judged pairs.

``main(argv)`` returns the process exit code (0 = success). This module is the
only entry point besides ``io.py`` that touches the filesystem.
"""

from __future__ import annotations

import argparse
import json
import sys
from functools import cache
from pathlib import Path

from commonplace_eval import io, scorecard
from commonplace_eval.matcher_validation import validate_matcher
from commonplace_eval.schema_gate import validate_item

__all__ = ["main"]


@cache
def _fixtures_dir() -> Path:
    """Locate ``schema/fixtures`` by walking up from this module."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "schema" / "fixtures"
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError("could not locate schema/fixtures")


# --- score -------------------------------------------------------------------
def _cmd_score(args: argparse.Namespace) -> int:
    gold = io.load_gold(args.gold)
    pred = io.load_pred(args.pred)
    hierarchy = io.load_hierarchy(args.hierarchy) if args.hierarchy else None
    facet_vocab = io.load_facet_vocab()

    sc = scorecard.build_scorecard(
        gold,
        pred,
        c=args.c,
        k=args.k,
        B=args.bootstrap,
        seed=args.seed,
        hierarchy=hierarchy,
        facet_vocab=facet_vocab,
    )

    if args.out:
        Path(args.out).write_text(json.dumps(sc, indent=2) + "\n", encoding="utf-8")

    md = scorecard.render_markdown(sc)
    if args.md:
        Path(args.md).write_text(md, encoding="utf-8")

    print(md)
    return 0


# --- check-schemas -----------------------------------------------------------
def _cmd_check_schemas(_args: argparse.Namespace) -> int:
    fixtures = _fixtures_dir()
    rows: list[tuple[str, str, str, bool]] = []
    all_ok = True

    for path in sorted((fixtures / "valid").glob("*.json")):
        errors = validate_item(json.loads(path.read_text()))
        ok = errors == []
        rows.append((f"valid/{path.name}", "pass", "pass" if ok else "FAIL", ok))
        all_ok = all_ok and ok

    for path in sorted((fixtures / "invalid").glob("*.json")):
        errors = validate_item(json.loads(path.read_text()))
        ok = errors != []
        rows.append((f"invalid/{path.name}", "fail", "fail" if ok else "PASS", ok))
        all_ok = all_ok and ok

    width = max((len(r[0]) for r in rows), default=8)
    print(f"{'fixture'.ljust(width)}  expected  actual   result")
    for name, expected, actual, ok in rows:
        print(f"{name.ljust(width)}  {expected:<8}  {actual:<7}  {'OK' if ok else 'WRONG'}")
    print(f"\n{sum(1 for r in rows if r[3])}/{len(rows)} fixtures on the expected side.")

    return 0 if all_ok else 1


# --- validate-matcher --------------------------------------------------------
def _cmd_validate_matcher(args: argparse.Namespace) -> int:
    result = validate_matcher(args.pairs)
    c = result["confusion"]
    print("Matcher validation vs human judgment")
    print(f"  n         = {result['n']}")
    print(f"  precision = {result['precision']:.4f}")
    print(f"  recall    = {result['recall']:.4f}")
    print(f"  f1        = {result['f1']:.4f}")
    print(f"  confusion = tp={c['tp']} fp={c['fp']} fn={c['fn']} tn={c['tn']}")
    return 0


# --- parser ------------------------------------------------------------------
def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="commonplace-eval",
        description="Commonplace eval instrument: per-layer scorecard, schema gate, matcher validation.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_score = sub.add_parser("score", help="build the per-layer scorecard from gold + pred JSONL")
    p_score.add_argument("--gold", required=True, help="gold records JSONL")
    p_score.add_argument("--pred", required=True, help="prediction records JSONL")
    p_score.add_argument("--out", help="write the JSON report here")
    p_score.add_argument("--md", help="write the markdown matrix here")
    p_score.add_argument("--hierarchy", help="concept hierarchy JSON (edges) for hierarchical F1")
    p_score.add_argument("--seed", type=int, default=0, help="bootstrap seed (default 0)")
    p_score.add_argument("--bootstrap", type=int, default=2000, help="bootstrap resamples B (default 2000)")
    p_score.add_argument("--c", type=float, default=10.0, help="Φ_c wrong-id penalty (default 10)")
    p_score.add_argument("--k", type=int, default=5, help="concept top-k (default 5)")
    p_score.set_defaults(func=_cmd_score)

    p_check = sub.add_parser("check-schemas", help="validate schema/fixtures/{valid,invalid}")
    p_check.set_defaults(func=_cmd_check_schemas)

    p_match = sub.add_parser("validate-matcher", help="score the matcher against human-judged pairs")
    p_match.add_argument("--pairs", required=True, help="pairs JSONL (a/b/human_match)")
    p_match.set_defaults(func=_cmd_validate_matcher)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
