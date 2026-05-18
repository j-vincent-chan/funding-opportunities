-- Distinct agency keys for filter UI (avoids .limit(n) on full rows, which truncates alphabetically
-- when many rows share early-alphabet agencies).

CREATE OR REPLACE FUNCTION public.list_funding_agency_option_rows()
RETURNS TABLE(agency text, agency_code text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT f.agency, f.agency_code
  FROM public.funding_opportunities f
  WHERE f.agency IS NOT NULL OR f.agency_code IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.list_funding_agency_option_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_funding_agency_option_rows() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_funding_agency_option_rows() TO service_role;

COMMENT ON FUNCTION public.list_funding_agency_option_rows() IS
  'Distinct (agency, agency_code) pairs for funding opportunity filters; not row-limited.';
