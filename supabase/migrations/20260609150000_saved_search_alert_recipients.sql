-- RDSG alert recipients and digest cadence tracking for saved search emails.

ALTER TABLE public.saved_funding_searches
  ADD COLUMN IF NOT EXISTS alert_rdsg_owner_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.saved_funding_searches.alert_rdsg_owner_ids IS
  'RDSG owners (rdsg_owners.id) who receive email digests for this saved search.';
COMMENT ON COLUMN public.saved_funding_searches.last_digest_sent_at IS
  'When the last digest email was sent; used with alert_frequency for daily/weekly cadence.';
