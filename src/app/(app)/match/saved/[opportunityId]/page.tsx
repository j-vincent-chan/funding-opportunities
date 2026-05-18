import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { expireStaleColdOpportunitiesAction } from "@/app/actions/opportunity-pipeline-actions";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { OpportunityPipelineDetailClient } from "@/components/opportunity-pipeline/opportunity-pipeline-detail-client";
import type { PipelineSuggestedInvestigator } from "@/components/opportunity-pipeline/pipeline-suggested-matches";
import { buildSuggestionWhyText } from "@/lib/opportunity-pipeline/investigator-workflow";
import { normalizePipelineRows } from "@/lib/opportunity-pipeline/serializers";

const SAVED_SELECT = `
  opportunity_id,
  created_at,
  updated_at,
  stage,
  strategic_value,
  owner_id,
  internal_notes,
  why_matters,
  risks_barriers,
  area_program_tags,
  next_action,
  next_action_date,
  last_activity_at,
  closure_reason,
  outreach_count,
  last_outreach_at,
  cold_until,
  archived_at,
  funding_opportunities (
    id,
    title,
    agency,
    close_date,
    funding_instrument,
    status,
    opportunity_number,
    source_opportunity_id,
    raw_payload_json
  ),
  saved_funding_opportunity_communities (
    community_id,
    pipeline_communities ( id, slug, label )
  ),
  saved_opportunity_pi_matches (
    id,
    investigator_id,
    sort_order,
    match_strength,
    match_priority,
    rationale,
    role_suggestion,
    outreach_status,
    notes,
    is_primary_target,
    follow_up_date,
    outreach_sent_at,
    updated_at,
    investigators ( id, full_name, email, home_department, division )
  )
`;

export default async function OpportunityPipelineDetailPage({
  params,
}: {
  params: { opportunityId: string };
}) {
  if (!z.string().uuid().safeParse(params.opportunityId).success) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <Card>
          <CardBody className="text-sm text-[var(--fo-ink-body)]">
            <Link href="/login" className="font-semibold text-[var(--fo-interaction)] underline">
              Sign in
            </Link>{" "}
            to view this opportunity.
          </CardBody>
        </Card>
      </div>
    );
  }

  await expireStaleColdOpportunitiesAction();

  const [{ data: saved, error: sErr }, { data: activities }, { data: rdsgOwners }] = await Promise.all([
    supabase
      .from("saved_funding_opportunities")
      .select(SAVED_SELECT)
      .eq("user_id", user.id)
      .eq("opportunity_id", params.opportunityId)
      .maybeSingle(),
    supabase
      .from("saved_opportunity_activity")
      .select("id, event_type, payload, created_at")
      .eq("user_id", user.id)
      .eq("opportunity_id", params.opportunityId)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("rdsg_owners").select("id, full_name, email").eq("is_active", true).order("full_name", { ascending: true }).limit(300),
  ]);

  if (sErr) {
    return (
      <div className="space-y-4">
        <Card>
          <CardBody className="text-sm text-red-700">
            <p className="font-semibold">Could not load this opportunity.</p>
            <p className="mt-2">{sErr.message}</p>
            <p className="mt-2 text-[var(--fo-ink-muted)]">
              Apply the latest Supabase migration for the opportunity pipeline, then reload.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!saved) {
    notFound();
  }

  const initialItem = normalizePipelineRows([saved])[0];
  if (!initialItem) notFound();

  const communityIds = initialItem.communities.map((c) => c.id);
  const matchedIds = new Set((initialItem.saved_opportunity_pi_matches ?? []).map((m) => m.investigator_id));
  let suggestedInvestigators: PipelineSuggestedInvestigator[] = [];

  if (communityIds.length > 0) {
    const { data: invRows, error: invErr } = await supabase
      .from("investigators")
      .select("id, full_name, email, home_department, division, research_community_id")
      .in("research_community_id", communityIds)
      .order("full_name", { ascending: true })
      .limit(80);

    if (!invErr && invRows) {
      const labelByCommunity = new Map(initialItem.communities.map((c) => [c.id, c.label]));
      const fo = initialItem.funding_opportunities;
      const agency = fo?.agency ?? null;
      const instrument = fo?.funding_instrument ?? null;
      const tags = initialItem.area_program_tags ?? [];

      suggestedInvestigators = invRows
        .filter((r) => !matchedIds.has(r.id))
        .slice(0, 12)
        .map((r) => {
          const communityLabel = r.research_community_id ? labelByCommunity.get(r.research_community_id) ?? null : null;
          return {
            id: r.id,
            full_name: r.full_name,
            email: r.email ?? null,
            home_department: r.home_department ?? null,
            division: r.division ?? null,
            research_community_id: r.research_community_id ?? null,
            why: buildSuggestionWhyText({ communityLabel, agency, instrument, tags }),
          };
        });
    }
  }

  return (
    <OpportunityPipelineDetailClient
      opportunityId={params.opportunityId}
      initialItem={initialItem}
      activities={(activities ?? []) as { id: string; event_type: string; payload: Record<string, unknown>; created_at: string }[]}
      profiles={rdsgOwners ?? []}
      suggestedInvestigators={suggestedInvestigators}
    />
  );
}
