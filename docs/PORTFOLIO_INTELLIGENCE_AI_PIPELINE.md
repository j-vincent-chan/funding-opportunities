# Portfolio Intelligence AI Pipeline

This document tracks the implementation path for full-text evidence ingestion and LLM synthesis in Portfolio Intelligence.

## Implemented (phase 1 foundation)

- Added schema for:
  - `source_documents`
  - `document_chunks`
  - `document_ai_annotations`
  - `investigator_portfolio_snapshots`
  - `community_intelligence_snapshots`
- Added seed action:
  - `seedPortfolioSourceDocuments(limit?: number)`
  - Reads `community_source_items`, writes canonical docs/chunks.
- Added URL text enrichment action:
  - `enrichPortfolioSourceDocumentsFromUrls(limit?: number, overwrite?: boolean)`
  - Fetches from `source_documents.source_url` and attempts to extract abstract/full text.
- Added service layer:
  - chunking and checksum helpers
  - upsert source documents
  - replace chunks
  - fetch latest investigator/community snapshots
- Portfolio data builder now reads the latest `investigator_portfolio_snapshots.ai_brief` (if available) for consultation summaries.

## Next steps (phase 2 extraction)

1. Build per-document extraction job:
   - Input: `source_documents` rows with text.
   - Output: `document_ai_annotations` (summary, themes, methods, diseases, translational_stage, funding tags).
2. Add strict JSON schema validation for annotation outputs.
3. Add retry/dead-letter handling for failed documents.

### Phase 2 status

- Implemented:
  - `extractPortfolioDocumentAnnotation()` in `src/lib/ai/portfolio-document-extraction.ts`
  - strict zod schema + JSON-only parsing with repair attempt
  - `annotatePortfolioSourceDocuments()` server action (bounded parallel LLM calls, bulk exists prefetch)
  - `runPortfolioDocumentAnnotationBatch()` in `src/lib/portfolio-intelligence/annotate-source-documents.ts`
  - CLI: `npm run annotate-portfolio-documents -- --until-done` (batched table walk; concurrency presets 1, 6, or 32)
  - settings admin trigger button: "Annotate documents (phase 2)"
- Pending:
  - persistent dead-letter queue table
  - multi-pass retry policy / exponential backoff

## Phase 3 synthesis status

- Implemented:
  - `synthesizePortfolioIntelligenceSnapshots()` server action
  - investigator-level aggregation from `document_ai_annotations` + `community_source_items`
  - community-level aggregation by watched community
  - snapshot writes to:
    - `investigator_portfolio_snapshots`
    - `community_intelligence_snapshots`
  - optional LLM brief generation with deterministic fallback when `OPENAI_API_KEY` is absent
  - settings admin trigger button: "Generate snapshots (phase 3)"
- Implemented UI wiring:
  - Portfolio Community View now prefers `community_intelligence_snapshots.ai_strategy_brief` when available.
- Pending hardening:
  - incremental/delta synthesis mode
  - scheduled recurring run cadence

## Reliability hardening status

- Implemented:
  - migration: `portfolio_ai_job_failures` dead-letter/retry table
  - action-level retry controls in both:
    - `annotatePortfolioSourceDocuments()`
    - `synthesizePortfolioIntelligenceSnapshots()`
  - exponential backoff scheduling via `next_retry_at`
  - automatic exhaustion cutoff via `maxAttempts`
  - automatic resolve-on-success behavior for previously failed jobs

## UI follow-ups

- Add evidence provenance in UI:
  - number of docs used
  - last snapshot timestamp
  - confidence badges
- Add "refresh briefing" action for selected investigator/community.
