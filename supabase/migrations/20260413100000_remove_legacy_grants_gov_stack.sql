-- Remove Grants.gov opportunities, pursuit workflow, watchlists, tracked PIs,
-- and AI suggestion tables (superseded by funding_opportunities + investigators).

DROP FUNCTION IF EXISTS public.opportunity_ids_without_pursuit();

DROP TABLE IF EXISTS public.opportunity_pi_suggestions;
DROP TABLE IF EXISTS public.opportunity_watchlist_matches;
DROP TABLE IF EXISTS public.opportunity_tags;
DROP TABLE IF EXISTS public.pursuit_records;
DROP TABLE IF EXISTS public.watchlist_rules;
DROP TABLE IF EXISTS public.opportunities;
DROP TABLE IF EXISTS public.tags;
DROP TABLE IF EXISTS public.tracked_pis;
DROP TABLE IF EXISTS public.watchlists;
