import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { expireStaleColdOpportunitiesAction } from "@/app/actions/opportunity-pipeline-actions";
import { OpportunityPipelineListClient } from "@/components/opportunity-pipeline/opportunity-pipeline-list-client";
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
    source_system,
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

export default async function OpportunityPipelinePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-16">
        <header className="rounded-2xl border border-stone-200/90 bg-white px-5 py-5 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Opportunity pipeline</h1>
          <p className="mt-2 text-sm text-stone-600">Track saved notices from triage through outreach and active development.</p>
        </header>
        <Card>
          <CardBody className="text-sm text-[var(--fo-ink-body)]">
            <p>
              <Link href="/login" className="font-semibold text-[var(--fo-interaction)] underline">
                Sign in
              </Link>{" "}
              to open your pipeline.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  await expireStaleColdOpportunitiesAction();

  const [{ data: rows, error }, { data: rdsgOwners }, { data: communityRows }] = await Promise.all([
    supabase
      .from("saved_funding_opportunities")
      .select(SAVED_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("rdsg_owners").select("id, full_name, email").eq("is_active", true).order("full_name", { ascending: true }).limit(300),
    supabase.from("pipeline_communities").select("id, slug, label").order("sort_order", { ascending: true }),
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-16">
        <header className="rounded-2xl border border-stone-200/90 bg-white px-5 py-5 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">Opportunity pipeline</h1>
        </header>
        <Card>
          <CardBody className="text-sm text-red-700">
            <p className="font-semibold">Could not load pipeline.</p>
            <p className="mt-2">{error.message}</p>
            <p className="mt-2 text-[var(--fo-ink-muted)]">
              If you recently pulled code, apply the latest Supabase migration so `saved_funding_opportunities` includes
              pipeline columns and related tables exist.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const items = normalizePipelineRows(rows ?? []);

  return (
    <OpportunityPipelineListClient
      items={items}
      profiles={rdsgOwners ?? []}
      communities={(communityRows ?? []) as { id: string; slug: string; label: string }[]}
    />
  );
}
