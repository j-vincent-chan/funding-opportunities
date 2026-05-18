-- Email digests when newly updated notices match a saved search (cron + Resend)

ALTER TABLE public.saved_funding_searches
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.saved_funding_searches.email_notifications_enabled IS
  'When true, periodic job emails the user about posted/forecasted opportunities matching saved state.';

CREATE TABLE public.saved_funding_search_notification_sends (
  saved_search_id UUID NOT NULL REFERENCES public.saved_funding_searches (id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.funding_opportunities (id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (saved_search_id, opportunity_id)
);

CREATE INDEX idx_sfns_saved_search ON public.saved_funding_search_notification_sends (saved_search_id);

ALTER TABLE public.saved_funding_search_notification_sends ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role / postgres used by cron; app users do not read this table directly.
