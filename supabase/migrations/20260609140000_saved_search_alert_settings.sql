-- Saved search alert preferences and visit tracking for chip strip + flyout UI.

ALTER TABLE public.saved_funding_searches
  ADD COLUMN IF NOT EXISTS alert_frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (alert_frequency IN ('instant', 'daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS alert_forecasted_notices BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_matched_at TIMESTAMPTZ;

COMMENT ON COLUMN public.saved_funding_searches.alert_frequency IS
  'Email alert cadence: instant, daily, or weekly digest.';
COMMENT ON COLUMN public.saved_funding_searches.alert_forecasted_notices IS
  'When false, alert matching excludes forecasted notices.';
COMMENT ON COLUMN public.saved_funding_searches.last_viewed_at IS
  'When the user last loaded this saved search in the funding list.';
COMMENT ON COLUMN public.saved_funding_searches.last_matched_at IS
  'Most recent updated_at among opportunities matching this search (UI display).';
