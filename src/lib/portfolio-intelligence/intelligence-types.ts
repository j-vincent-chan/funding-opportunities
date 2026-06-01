export type SourceDocumentKind =
  | "paper_abstract"
  | "paper_fulltext"
  | "grant_abstract"
  | "grant_fulltext"
  | "news_article"
  | "clinical_trial_record"
  | "other";

export type SourceDocumentInput = {
  sourceItemId: string;
  title: string;
  summaryText?: string | null;
  fullText?: string | null;
  sourceUrl?: string | null;
  publishedAt?: string | null;
  category?: string | null;
  sourceType?: string | null;
  language?: string | null;
  license?: string | null;
  rawPayload?: Record<string, unknown> | null;
};

export type SourceDocumentRow = {
  id: string;
  source_item_id: string;
  document_kind: SourceDocumentKind;
  title: string;
  abstract_text: string | null;
  full_text: string | null;
  source_url: string | null;
  published_at: string | null;
  language: string;
  license: string | null;
  raw_payload: Record<string, unknown>;
  checksum: string | null;
  ingested_at: string;
  updated_at: string;
};

export type InvestigatorPortfolioSnapshotRow = {
  id: string;
  investigator_id: string;
  window_start: string;
  window_end: string;
  ai_brief: string | null;
  theme_distribution: unknown;
  trajectory_metrics: unknown;
  evidence_source_item_ids: string[] | null;
  model: string | null;
  created_at: string;
};

export type CommunityIntelligenceSnapshotRow = {
  id: string;
  community_id: string | null;
  window_start: string;
  window_end: string;
  ai_strategy_brief: string | null;
  theme_distribution: unknown;
  momentum_metrics: unknown;
  funding_playbook: unknown;
  evidence_source_item_ids: string[] | null;
  model: string | null;
  created_at: string;
};

export type PortfolioAiJobFailureRow = {
  id: string;
  dedupe_key: string;
  job_type: "annotation" | "snapshot_investigator" | "snapshot_community";
  entity_type: "document" | "investigator" | "community";
  entity_id: string;
  model: string;
  window_start: string | null;
  window_end: string | null;
  attempt_count: number;
  status: "open" | "resolved" | "exhausted";
  first_failed_at: string;
  last_failed_at: string;
  next_retry_at: string | null;
  error_message: string;
  error_payload: Record<string, unknown>;
  recovered_at: string | null;
  created_at: string;
  updated_at: string;
};
