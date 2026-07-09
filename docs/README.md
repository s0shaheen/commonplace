# Commonplace documentation

This is the map. Read top-down if you're new; jump by directory if you're not.

## Directory layout (what lives where, and why)

| Directory | Document class | Mutability |
|---|---|---|
| `strategy/` | Where we're going: the roadmap and the session-handoff pointer | Living — updated per phase |
| `specs/` | **Governing, normative documents.** The product specification, the knowledge ontology, the evaluation methodology, the knowledge-organization standard. Code and plans conform to these; conflicts resolve in their favor. | Versioned — changed deliberately, never casually |
| `decisions/` | The decision log (ADR-style). Every consequential engineering/product call, with context and rationale. | Append-only |
| `research/` | Dated evidence: research runs, censuses, analyses. Cited by specs and decisions. | Immutable once written |
| `plans/` | Implementation plans executed by the agentic build loop (one per phase/feature, dated). | Immutable once executed |
| `design/` | Design briefs and the design system (pre-G2: the Claude Design brief). | Living until G2 |
| `archive/` | Superseded documents, kept for lineage: the strategy dossier, early briefs, gate-0 artifacts, early specs. Nothing in here governs anything. | Frozen |

## Reading order for a newcomer

1. `strategy/session-handoff.md` — where things stand right now
2. `strategy/roadmap.md` — the phase plan and status log
3. `specs/product-specification.md` — what we're building and why (governing)
4. `specs/knowledge-ontology.md` — the data model (governing; its teaching companion is `specs/schema-derivation-walkthrough.html`)
5. `specs/evaluation-methodology.md` — how accuracy is measured (governing)
6. `decisions/decision-log.md` — how we got here

## File-naming convention (enforced)

- **kebab-case, descriptive, no underscored prefixes** (`knowledge-ontology.md`, never `_ONTOLOGY.md`). A stranger should guess the content from the name alone.
- **Research and plans are dated**: `YYYY-MM-DD-<topic>.md`. The date is the date of the work, not the file's last edit.
- **Specs are versioned inside the document** (front-matter or header), not in the filename.
- **Never delete a governing doc — archive it** (`archive/superseded/`) with a first-line pointer to its successor.
- New decision → append to `decisions/decision-log.md` with the next `DEC-NNN` id. If a single decision needs more than a page, give it its own file: `decisions/adr-NNN-<slug>.md`.

## Machine-facing artifacts elsewhere in the repo

- `schema/` — the frozen data contract (JSON Schema + SHACL + vocabularies + fixtures + CHANGELOG). Public-bound.
- `eval/` — the open-source evaluation harness + annotation codebook (`eval/construct.md`, `eval/guidelines.md`). Public-bound.
- `.superpowers/sdd/progress.md` — the (gitignored) execution ledger the build loop maintains.
