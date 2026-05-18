# Implementation plan: NIH opportunities, investigators, and matching

## Repo findings (historical snapshot)

- **Stack**: Next.js 14 App Router, TypeScript, Tailwind, Supabase Auth + RLS, Zod, Vitest.
- **Current data model**: `funding_opportunities` + Simpler sync; `investigators` + CSV import; `matches` / `match_feedback`; optional `POST /api/cron/matching`.
- **Removed (migration `20260413100000_remove_legacy_grants_gov_stack.sql`)**: Grants.gov `opportunities`, pursuit/watchlist/tag tables, `tracked_pis`, `opportunity_pi_suggestions`, and `/api/sync` + related app code.
- **Patterns**: Server actions in `src/app/actions/`, queries in `src/lib/queries/`, Simpler client under `src/lib/ingestion/simpler-grants/`.

## Approach

1. **Schema** — `investigators`, `funding_opportunities`, `opportunity_features`, `matches`, … (legacy Grants.gov stack dropped in favor of Simpler + this model).
2. **Simpler.Grants.gov** as a new ingestion adapter; store rows in `funding_opportunities` with dedupe on `(source_system, source_opportunity_id)`.
3. **Deterministic normalization** in `src/lib/normalization/` with editable synonym/vocab config.
4. **Two-stage match**: SQL retrieval (tag overlap + active status) → TypeScript rerank with weighted sub-scores, explanations, and persisted `matches` rows.
5. **UI**: New routes `/investigators`, `/funding-opportunities`, `/admin/matching` (review + utilities); nav links; admin-gated actions via `profiles.role === 'admin'`.
6. **Jobs**: Server actions + optional `POST /api/admin/matching-jobs` for future cron; `sync_job_logs` for errors.

## Assumptions

- Simpler API key available as `SIMPLER_GRANTS_API_KEY` (server-only).
- NIH bias uses agency/code/title/description heuristics; `is_nih_relevant` is a boolean flag for default filters.
- Investigator CSV columns align with ImmunoX-style export; unknown columns are preserved in `raw_profile_json`.
- Match recomputation **replaces only** rows with `match_status = 'suggested'` for the scoped investigator or opportunity (preserves human-reviewed rows).
