-- Remove receipt pattern, administrative-load (complexity flags), and clinical relevance columns.

DROP INDEX IF EXISTS public.idx_funding_opps_rd_complexity_flags;
DROP INDEX IF EXISTS public.idx_funding_opps_rd_clinical_score;

ALTER TABLE public.funding_opportunities
  DROP COLUMN IF EXISTS rd_receipt_pattern,
  DROP COLUMN IF EXISTS rd_complexity_flags,
  DROP COLUMN IF EXISTS rd_clinical_relevance_score;

ALTER TABLE public.opportunity_features
  DROP COLUMN IF EXISTS clinical_relevance_score;
