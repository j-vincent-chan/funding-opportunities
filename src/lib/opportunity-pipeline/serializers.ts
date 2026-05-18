import { PIPELINE_STAGES, type PipelineStage } from "@/lib/opportunity-pipeline/constants";

function coerceStage(raw: string | null | undefined): PipelineStage {
  const s = String(raw ?? "triage");
  return (PIPELINE_STAGES as readonly string[]).includes(s) ? (s as PipelineStage) : "triage";
}

export type PipelineCommunityRef = { id: string; slug: string; label: string };

export type PipelineFundingRow = {
  id: string;
  title: string | null;
  agency: string | null;
  close_date: string | null;
  funding_instrument: string | null;
  status: string | null;
  opportunity_number: string | null;
  source_opportunity_id: string | null;
  raw_payload_json: unknown;
};

export type PipelinePiMatchRow = {
  id: string;
  investigator_id: string;
  sort_order: number;
  match_strength: string;
  /** Investigator triage priority; defaults to medium when absent (older rows). */
  match_priority?: string | null;
  rationale: string | null;
  role_suggestion: string;
  outreach_status: string;
  notes: string | null;
  is_primary_target: boolean;
  follow_up_date: string | null;
  outreach_sent_at: string | null;
  updated_at?: string | null;
  investigators:
    | { id: string; full_name: string; email: string | null; home_department?: string | null; division?: string | null }
    | { id: string; full_name: string; email: string | null; home_department?: string | null; division?: string | null }[]
    | null;
};

export type SavedCommunityLink = {
  community_id: string;
  pipeline_communities:
    | { id: string; slug: string; label: string }
    | { id: string; slug: string; label: string }[]
    | null;
};

export type PipelineSavedRow = {
  opportunity_id: string;
  created_at: string;
  updated_at: string;
  stage: PipelineStage;
  /** Optional when not selected from API; defaults applied in normalize. */
  priority?: string | null;
  fit_confidence?: string | null;
  strategic_value: string;
  owner_id: string | null;
  internal_notes: string | null;
  why_matters: string | null;
  risks_barriers: string | null;
  area_program_tags: string[] | null;
  next_action: string | null;
  next_action_date: string | null;
  last_activity_at: string;
  closure_reason: string | null;
  outreach_count: number;
  last_outreach_at: string | null;
  cold_until?: string | null;
  archived_at?: string | null;
  funding_opportunities: PipelineFundingRow | PipelineFundingRow[] | null;
  saved_opportunity_pi_matches: PipelinePiMatchRow[] | null;
  saved_funding_opportunity_communities?: SavedCommunityLink[] | null;
};

function singleFunding(
  fo: PipelineFundingRow | PipelineFundingRow[] | null
): PipelineFundingRow | null {
  if (!fo) return null;
  return Array.isArray(fo) ? fo[0] ?? null : fo;
}

function flattenCommunities(row: PipelineSavedRow): PipelineCommunityRef[] {
  const raw = row.saved_funding_opportunity_communities;
  if (!raw?.length) return [];
  const out: PipelineCommunityRef[] = [];
  for (const link of raw) {
    const pc = link.pipeline_communities;
    const one = pc && !Array.isArray(pc) ? pc : Array.isArray(pc) ? pc[0] : null;
    if (one?.id && one.slug && one.label) {
      out.push({ id: one.id, slug: one.slug, label: one.label });
    }
  }
  return out;
}

function invName(m: PipelinePiMatchRow) {
  const inv = m.investigators;
  const one = inv && !Array.isArray(inv) ? inv : Array.isArray(inv) ? inv[0] : null;
  return one?.full_name ?? "PI";
}

export type NormalizedPipelineItem = Omit<PipelineSavedRow, "funding_opportunities"> & {
  funding_opportunities: PipelineFundingRow | null;
  communities: PipelineCommunityRef[];
  cold_until: string | null;
  archived_at: string | null;
};

export function normalizePipelineRows(raw: unknown[]): NormalizedPipelineItem[] {
  return (raw as PipelineSavedRow[]).map((row) => {
    const communities = flattenCommunities(row);
    const rest = { ...row };
    delete (rest as { saved_funding_opportunity_communities?: unknown }).saved_funding_opportunity_communities;
    return {
      ...rest,
      priority: row.priority ?? "medium",
      fit_confidence: row.fit_confidence ?? "plausible",
      stage: coerceStage(row.stage),
      funding_opportunities: singleFunding(row.funding_opportunities),
      saved_opportunity_pi_matches: [...(row.saved_opportunity_pi_matches ?? [])]
        .map((m) => ({
          ...m,
          match_priority: m.match_priority ?? "medium",
        }))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      communities,
      cold_until: row.cold_until ?? null,
      archived_at: row.archived_at ?? null,
    };
  });
}

export function outreachCardSummary(matches: PipelinePiMatchRow[]) {
  let sent = 0;
  let interested = 0;
  for (const m of matches) {
    if (["sent", "responded_interested", "responded_maybe", "responded_declined"].includes(m.outreach_status)) {
      sent += 1;
    }
    if (m.outreach_status === "responded_interested") interested += 1;
  }
  return { sent, interested, total: matches.length };
}

/** Human line for Monitor bucket cards (derived from PI outreach rows). */
export function monitorStatusLine(matches: PipelinePiMatchRow[]): string {
  if (!matches.length) return "No PIs linked";
  if (matches.some((m) => m.outreach_status === "responded_interested")) return "PI interested";
  if (
    matches.some((m) =>
      ["sent", "responded_maybe", "responded_declined"].includes(m.outreach_status)
    )
  ) {
    return "Outreach sent";
  }
  if (matches.some((m) => m.outreach_status === "drafted")) return "Draft ready";
  return "PIs identified · outreach pending";
}

export { invName };
