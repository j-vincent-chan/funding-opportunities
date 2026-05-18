/** Active workflow buckets for saved opportunities (simplified). */
export const PIPELINE_STAGES = ["triage", "monitor", "cold", "archived"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  triage: "Triage",
  monitor: "Monitor",
  cold: "Cold",
  archived: "Archived",
};

export const PIPELINE_BUCKET_TABS = ["triage", "monitor", "cold", "archived"] as const;
export type PipelineBucketTab = (typeof PIPELINE_BUCKET_TABS)[number];

export const PIPELINE_BUCKET_LABEL: Record<PipelineBucketTab, string> = {
  triage: "Triage",
  monitor: "Monitor",
  cold: "Cold",
  archived: "Archived",
};

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type PipelinePriority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<PipelinePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const FIT_CONFIDENCES = ["weak", "plausible", "strong"] as const;
export type FitConfidence = (typeof FIT_CONFIDENCES)[number];

export const FIT_LABEL: Record<FitConfidence, string> = {
  weak: "Weak",
  plausible: "Plausible",
  strong: "Strong",
};

export const STRATEGIC_VALUES = ["opportunistic", "useful", "strategic", "highly_strategic"] as const;
export type StrategicValue = (typeof STRATEGIC_VALUES)[number];

export const STRATEGIC_VALUE_LABEL: Record<StrategicValue, string> = {
  opportunistic: "Opportunistic",
  useful: "Useful",
  strategic: "Strategic",
  highly_strategic: "Highly strategic",
};

export const CLOSURE_REASONS = [
  "submitted",
  "declined",
  "deferred",
  "not_competitive",
  "missed_timing",
  "archived",
  "other",
] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export const CLOSURE_REASON_LABEL: Record<ClosureReason, string> = {
  submitted: "Submitted",
  declined: "Declined",
  deferred: "Deferred",
  not_competitive: "Not competitive",
  missed_timing: "Missed timing",
  archived: "Archived",
  other: "Other",
};

export const MATCH_STRENGTHS = ["stretch", "plausible", "strong"] as const;
export type MatchStrength = (typeof MATCH_STRENGTHS)[number];

/** Investigator-level triage priority on a saved opportunity (distinct from opportunity-level legacy priority). */
export const MATCH_PRIORITIES = ["low", "medium", "high"] as const;
export type MatchPriority = (typeof MATCH_PRIORITIES)[number];

export const MATCH_PRIORITY_LABEL: Record<MatchPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const ROLE_SUGGESTIONS = ["primary", "collaborator", "co_pi", "mpi_candidate"] as const;
export type RoleSuggestion = (typeof ROLE_SUGGESTIONS)[number];

export const ROLE_LABEL: Record<RoleSuggestion, string> = {
  primary: "Primary",
  collaborator: "Collaborator",
  co_pi: "Co-PI",
  mpi_candidate: "MPI candidate",
};

export const OUTREACH_STATUSES = [
  "not_contacted",
  "drafted",
  "sent",
  "responded_interested",
  "responded_maybe",
  "responded_declined",
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const OUTREACH_STATUS_LABEL: Record<OutreachStatus, string> = {
  not_contacted: "Not contacted",
  drafted: "Drafted",
  sent: "Sent",
  responded_interested: "Interested",
  responded_maybe: "Maybe",
  responded_declined: "Declined",
};

export const EMAIL_DRAFT_MODES = ["exploratory", "recommended", "team_building"] as const;
export type EmailDraftMode = (typeof EMAIL_DRAFT_MODES)[number];

export const EMAIL_DRAFT_MODE_LABEL: Record<EmailDraftMode, string> = {
  exploratory: "Exploratory",
  recommended: "Recommended",
  team_building: "Team-building",
};

export const ACTIVITY_EVENT_TYPES = [
  "stage_change",
  "note",
  "outreach_sent",
  "pi_added",
  "pi_removed",
  "pi_updated",
  "pipeline_update",
  "closure",
  "communities_updated",
] as const;
