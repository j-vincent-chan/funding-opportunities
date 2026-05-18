-- Backfill display agency when Simpler sent agency_code but null/blank agency_name.
-- Keeps agency filter and list views usable for NIH rows that only had a code.

UPDATE public.funding_opportunities
SET agency = btrim(agency_code)
WHERE (agency IS NULL OR btrim(agency) = '')
  AND agency_code IS NOT NULL
  AND btrim(agency_code) <> '';
