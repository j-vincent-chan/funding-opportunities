-- Portfolio Intelligence evidence storage:
-- full-text/abstract documents, chunks, document annotations, and investigator/community snapshots.

CREATE TABLE IF NOT EXISTS public.source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id UUID NOT NULL REFERENCES public.community_source_items (id) ON DELETE CASCADE,
  document_kind TEXT NOT NULL
    CHECK (document_kind IN (
      'paper_abstract',
      'paper_fulltext',
      'grant_abstract',
      'grant_fulltext',
      'news_article',
      'clinical_trial_record',
      'other'
    )),
  title TEXT NOT NULL DEFAULT '',
  abstract_text TEXT,
  full_text TEXT,
  source_url TEXT,
  published_at TIMESTAMPTZ,
  language TEXT NOT NULL DEFAULT 'en',
  license TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum TEXT,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_item_id, document_kind)
);

CREATE INDEX IF NOT EXISTS idx_source_documents_source_item
  ON public.source_documents (source_item_id);

CREATE INDEX IF NOT EXISTS idx_source_documents_kind
  ON public.source_documents (document_kind);

CREATE INDEX IF NOT EXISTS idx_source_documents_published
  ON public.source_documents (published_at DESC NULLS LAST);

CREATE TRIGGER tr_source_documents_updated_at
  BEFORE UPDATE ON public.source_documents
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.source_documents (id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER,
  chunk_text TEXT NOT NULL,
  embedding JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document
  ON public.document_chunks (document_id, chunk_index);


CREATE TABLE IF NOT EXISTS public.document_ai_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.source_documents (id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  summary TEXT,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  diseases JSONB NOT NULL DEFAULT '[]'::jsonb,
  translational_stage TEXT,
  funding_relevance_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, model)
);

CREATE INDEX IF NOT EXISTS idx_document_ai_annotations_document
  ON public.document_ai_annotations (document_id);


CREATE TABLE IF NOT EXISTS public.investigator_portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  n_publications INTEGER NOT NULL DEFAULT 0,
  n_grants INTEGER NOT NULL DEFAULT 0,
  n_news INTEGER NOT NULL DEFAULT 0,
  n_honors INTEGER NOT NULL DEFAULT 0,
  n_trials INTEGER NOT NULL DEFAULT 0,
  n_social INTEGER NOT NULL DEFAULT 0,
  theme_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  trajectory_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_brief TEXT,
  evidence_source_item_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investigator_id, window_start, window_end, model)
);

CREATE INDEX IF NOT EXISTS idx_investigator_portfolio_snapshots_investigator
  ON public.investigator_portfolio_snapshots (investigator_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.community_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.pipeline_communities (id) ON DELETE CASCADE,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  n_signals INTEGER NOT NULL DEFAULT 0,
  n_investigators INTEGER NOT NULL DEFAULT 0,
  theme_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  momentum_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_strategy_brief TEXT,
  funding_playbook JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_source_item_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, window_start, window_end, model)
);

CREATE INDEX IF NOT EXISTS idx_community_intelligence_snapshots_community
  ON public.community_intelligence_snapshots (community_id, created_at DESC);


ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_ai_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigator_portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_documents_all_authenticated ON public.source_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY document_chunks_all_authenticated ON public.document_chunks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY document_ai_annotations_all_authenticated ON public.document_ai_annotations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY investigator_portfolio_snapshots_all_authenticated ON public.investigator_portfolio_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY community_intelligence_snapshots_all_authenticated ON public.community_intelligence_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.source_documents IS
  'Canonical full-text/abstract documents linked to community_source_items for portfolio intelligence.';

COMMENT ON TABLE public.document_chunks IS
  'Chunked document text (optionally with embeddings) for retrieval and synthesis.';

COMMENT ON TABLE public.document_ai_annotations IS
  'Structured LLM-derived annotations per document/model.';

COMMENT ON TABLE public.investigator_portfolio_snapshots IS
  'Windowed investigator-level synthesized intelligence snapshots with evidence links.';

COMMENT ON TABLE public.community_intelligence_snapshots IS
  'Windowed community-level strategy snapshots with evidence links and playbooks.';
