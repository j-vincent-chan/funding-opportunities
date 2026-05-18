# Community intelligence layer — audit, plan, and implementation notes

## Phase 1 — Audit (current state)

### Stack

- **Next.js 14** App Router, **Supabase** (Postgres + Auth + RLS), **TypeScript**, **Tailwind**, **Recharts** on Community Snapshot charts.

### What “Community Snapshot” did before this work

- **Route:** `/pi-community` (`src/app/(app)/pi-community/page.tsx`).
- **Data:** Reads **`investigators`** with nested **`investigator_profile_features`** (`science_tags`, `disease_tags` only in the query).
- **Transforms:** `investigatorDbRowsToCommunityRows` maps tag arrays into synthetic “primary/secondary” research and disease strings for aggregation (`src/lib/tracked-pis/community-aggregates.ts` — legacy path name; logic is investigator-based).
- **Metrics:** `buildPiCommunityAggregates` → total PIs, counts with primary science/disease, department/division histograms, tag token histograms.
- **UI:** Three KPI tiles, optional **OpenAI** narrative (`generatePiCommunityNarrative`), four **Recharts** horizontal bar charts (`CommunityBarChart`), one department chart.
- **Nav:** Single item “Community Snapshot” in `app-shell.tsx`.

### What already existed elsewhere (reused, not duplicated)

| Area | Location | Role |
|------|----------|------|
| Investigator entity | `investigators`, `investigator_profile_features` | Canonical directory + normalized tags (`science_tags`, `disease_tags`, `method_tags`, `translational_tags`) |
| Funding fit | `matches` ↔ `funding_opportunities` | Explainable scores; investigator detail already lists matches |
| NIH heuristics | `nihBiasFromOpportunity`, `is_nih_relevant` on opportunities | Funding landscape bias; unchanged |
| CSV / raw JSON | `raw_profile_json`, CSV column mapping | Survey-style fields already land in `raw_profile_json` |
| Disambiguation hook | `nih_profile_id` on `investigators` | Intended for NIH profile / RePORTER linkage |
| Charts / cards | `CommunityBarChart`, `Card` | Reused for new overview widgets |

### Gaps (nothing to duplicate — net new)

- No **`strategist_engagements`** (manual outreach tracking).
- No cached **PubMed** or **NIH RePORTER** rows in Postgres (only env hints and CSV mapping to `nih_profile_id`).
- No **`investigator_relationships`** table (collaboration graph).
- No proposals table — **`linked_proposal_id`** on engagements is optional UUID without FK until a proposals module exists.

### Extend vs replace

| Piece | Decision |
|-------|----------|
| Community Snapshot page | **Extend** — add strategist KPIs, links, and optional ingestion summaries; keep existing tag charts and AI block. |
| Tag system | **Extend** — keep `investigator_profile_features` arrays; optional structured fields can later be JSONB on the same row or split only if needed. |
| `lib/tracked-pis/community-aggregates` | **Keep** — rename deferred to avoid churn; aggregates remain the source for tag charts. |
| Investigator detail | **Extend** — add engagements, publications, grants, collaborators sections. |

### Assumptions and limitations (explicit)

- **PubMed co-authorship** is a proxy for collaboration; coverage depends on query quality and name ambiguity.
- **NIH RePORTER** is not the full funding universe; API text search can miss or mis-associate awards.
- **Name disambiguation** is imperfect; we store **confidence/provenance** fields and support optional **`pubmed_query_override`** / **`orcid`** on investigators.
- **Strategist-entered engagements** are the **source of truth** for operational outreach relative to automated signals.
- **Biosketch parsing** is out of scope unless added later.

---

## Schema added (migration `20260414120000_community_intelligence.sql`)

- **`investigators`**: `orcid`, `pubmed_query_override` (optional disambiguation).
- **`strategist_engagements`**: manual tracking with status vocabulary, links to `funding_opportunities` and optional `proposal_id`, owner `profiles`.
- **`investigator_publications`**: cached PubMed rows per investigator.
- **`investigator_nih_grants`**: cached RePORTER project rows per investigator.
- **`investigator_relationships`**: edges (co-authorship from shared PMIDs; coinvestigator from shared RePORTER project numbers).

---

## Files touched

- **New:** migration above; `src/lib/community/*` ingestion + collaboration helpers; `src/app/actions/community-intelligence.ts`; `src/app/(app)/pi-community/engagements/page.tsx`; components under `src/components/community/`.
- **Updated:** `pi-community/page.tsx`, `investigators/[id]/page.tsx`, `app-shell.tsx`, README.

---

## Recommended next steps

- Batch nightly refresh for PubMed/RePORTER with rate limits.
- Richer RePORTER parsing (multiple PIs per project) for collaboration edges.
- Proposal entity and FK for `linked_proposal_id`.
- Optional rename `lib/tracked-pis/community-aggregates.ts` → `lib/community/community-aggregates.ts`.
