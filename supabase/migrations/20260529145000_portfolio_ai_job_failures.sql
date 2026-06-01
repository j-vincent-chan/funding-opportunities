-- Reliability layer for Portfolio Intelligence AI jobs:
-- persistent dead-letter queue entries with retry metadata.

CREATE TABLE IF NOT EXISTS public.portfolio_ai_job_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL
    CHECK (job_type IN ('annotation', 'snapshot_investigator', 'snapshot_community')),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('document', 'investigator', 'community')),
  entity_id TEXT NOT NULL,
  model TEXT NOT NULL,
  window_start DATE,
  window_end DATE,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'exhausted')),
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at TIMESTAMPTZ,
  error_message TEXT NOT NULL,
  error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_ai_job_failures_job
  ON public.portfolio_ai_job_failures (job_type, status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_portfolio_ai_job_failures_entity
  ON public.portfolio_ai_job_failures (entity_type, entity_id);

CREATE TRIGGER tr_portfolio_ai_job_failures_updated_at
  BEFORE UPDATE ON public.portfolio_ai_job_failures
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.portfolio_ai_job_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY portfolio_ai_job_failures_all_authenticated ON public.portfolio_ai_job_failures
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.portfolio_ai_job_failures IS
  'Persistent dead-letter queue and retry state for portfolio AI annotation/snapshot jobs.';
