import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatting/dates";
import { resolveFundingOpportunityDescription } from "@/lib/funding-opportunities/display-text";
import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import { FundingInstrumentPills } from "@/components/funding/funding-instrument-pills";
import { ActivityFamilyPills } from "@/components/funding/activity-family-pills";
import { normalizeAgencyDisplayName } from "@/lib/funding-opportunities/agency-display";
import { extractOpportunityQuickTags } from "@/lib/quick-match/tag-opportunity";
import { buildPiQuickMatchProfile } from "@/lib/quick-match/normalize-pi";
import { rankInvestigatorsForOpportunity } from "@/lib/quick-match/engine";
import { QuickMatchInvestigatorList } from "@/components/quick-match/quick-match-lists";
import { QuickMatchTagChips } from "@/components/quick-match/quick-match-tag-chips";
import { SaveFundingOpportunityButton } from "@/components/funding/save-funding-opportunity-button";

type InvRow = {
  id: string;
  full_name: string;
  home_department: string | null;
  division: string | null;
  raw_profile_json: unknown;
  investigator_profile_features: {
    science_tags: string[] | null;
    disease_tags: string[] | null;
    method_tags: string[] | null;
    translational_tags: string[] | null;
  } | null;
};

export default async function FundingOpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const id = params.id;

  const { data: fo, error } = await supabase
    .from("funding_opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !fo) notFound();

  const { data: feats } = await supabase
    .from("opportunity_features")
    .select("*")
    .eq("opportunity_id", id)
    .maybeSingle();

  const quickTags = extractOpportunityQuickTags({
    title: fo.title,
    description: fo.description,
    agency: fo.agency,
    agency_code: fo.agency_code,
    category: fo.category,
    funding_instrument: fo.funding_instrument,
    applicant_types: fo.applicant_types,
    raw_payload_json: fo.raw_payload_json,
  });

  const { data: invRows } = await supabase
    .from("investigators")
    .select(
      "id, full_name, home_department, division, raw_profile_json, investigator_profile_features(science_tags, disease_tags, method_tags, translational_tags)"
    )
    .limit(800);

  const piProfiles = (invRows ?? []).map((row) => {
    const r = row as unknown as InvRow;
    return buildPiQuickMatchProfile(r, r.investigator_profile_features);
  });

  const quickRanked = rankInvestigatorsForOpportunity(quickTags, piProfiles);

  const descriptionText = resolveFundingOpportunityDescription(fo);
  const agencyRaw = coercePlainTextFromUnknown(fo.agency);
  const agencyShort = normalizeAgencyDisplayName(agencyRaw || null);
  const agencyDisplay = agencyShort || agencyRaw || "—";

  const { data: oppEngagements } = await supabase
    .from("strategist_engagements")
    .select("id, status, engagement_type, investigator_id, investigators(full_name)")
    .eq("opportunity_id", id)
    .limit(20);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: savedRow } = user
    ? await supabase
        .from("saved_funding_opportunities")
        .select("opportunity_id")
        .eq("user_id", user.id)
        .eq("opportunity_id", id)
        .maybeSingle()
    : { data: null };

  const initiallySaved = !!savedRow;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/funding-opportunities"
          className="text-xs font-medium text-[var(--fo-ink-muted)] hover:text-[var(--fo-title)]"
        >
          ← Search
        </Link>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <h1 className="app-page-title min-w-0 flex-1">
            {coercePlainTextFromUnknown(fo.title) || "(untitled)"}
          </h1>
          {user ? (
            <SaveFundingOpportunityButton opportunityId={id} initiallySaved={initiallySaved} />
          ) : null}
        </div>
        <p className="mt-1 app-page-description">
          {agencyDisplay} ·{" "}
          {coercePlainTextFromUnknown(fo.opportunity_number) ||
            coercePlainTextFromUnknown(fo.source_opportunity_id) ||
            "—"}{" "}
          · {coercePlainTextFromUnknown(fo.status) || "—"}
        </p>
      </div>

      {(oppEngagements ?? []).length > 0 ? (
        <Card>
          <CardHeader
            title="Strategist engagements (this notice)"
            description="Linked outreach tracked in Community Snapshot."
          />
          <CardBody className="space-y-2 text-sm">
            {(oppEngagements ?? []).map((row) => {
              type Inv = { full_name?: string };
              const inv = row.investigators as Inv | Inv[] | null | undefined;
              const name = Array.isArray(inv) ? inv[0]?.full_name : inv?.full_name;
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--fo-border)] bg-[var(--fo-paper-2)] px-3 py-2"
                >
                  <Link
                    href={`/investigators/${row.investigator_id}`}
                    className="font-medium text-[var(--fo-interaction)] hover:underline"
                  >
                    {name ?? "Investigator"}
                  </Link>
                  <Badge tone="neutral">{row.status}</Badge>
                </div>
              );
            })}
            <p className="text-xs text-[var(--fo-ink-muted)]">
              Create or edit engagements from{" "}
              <Link href="/pi-community/engagements" className="text-[var(--fo-interaction)] underline">
                Community → Engagements
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Metadata" />
        <CardBody className="space-y-2 text-sm text-[var(--fo-ink-body)]">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--fo-ink-muted)]">Posted</dt>
              <dd>{formatDate(fo.posted_date)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--fo-ink-muted)]">Close</dt>
              <dd>{formatDate(fo.close_date)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--fo-ink-muted)]">Instrument</dt>
              <dd>
                <FundingInstrumentPills
                  value={coercePlainTextFromUnknown(fo.funding_instrument) || null}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--fo-ink-muted)]">Activity family</dt>
              <dd>
                <ActivityFamilyPills
                  families={
                    Array.isArray(fo.activity_families)
                      ? (fo.activity_families as string[])
                      : undefined
                  }
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--fo-ink-muted)]">Applicant types</dt>
              <dd>
                {(() => {
                  const at = fo.applicant_types;
                  if (Array.isArray(at) && at.length > 0) {
                    return at.map((x) => String(x)).join(", ");
                  }
                  const t = coercePlainTextFromUnknown(at);
                  return t || "—";
                })()}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--fo-ink-muted)]">Award floor</dt>
              <dd>
                {fo.award_floor != null && fo.award_floor !== ""
                  ? Number(fo.award_floor).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[var(--fo-ink-muted)]">Award ceiling</dt>
              <dd>
                {fo.award_ceiling != null && fo.award_ceiling !== ""
                  ? Number(fo.award_ceiling).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="border-t border-[var(--fo-divider)] pt-3">
            <h3 className="text-xs font-semibold uppercase text-[var(--fo-ink-muted)]">Description</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {descriptionText.trim() ? descriptionText : "—"}
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="AI-Assisted Matches tags"
          description="Rule-based tags from title, description, agency, and payload text (editable dictionary in vocab-config.ts)."
        />
        <CardBody>
          <QuickMatchTagChips tags={quickTags} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="AI-Assisted Matches — investigators"
          description="Top 10 investigators by weighted tag overlap with this notice. Scores are explainable and tunable in scoring-weights.ts."
        />
        <CardBody>
          <QuickMatchInvestigatorList items={quickRanked} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Legacy extracted features"
          description="Separate extract pipeline (admin batch job). AI-Assisted Matches does not depend on this block."
        />
        <CardBody className="space-y-3 text-sm">
          {feats ? (
            <>
              <TagBlock label="Science" values={asStringArray(feats.science_tags)} />
              <TagBlock label="Disease" values={asStringArray(feats.disease_tags)} />
              <TagBlock label="Method" values={asStringArray(feats.method_tags)} />
              <TagBlock label="Translational" values={asStringArray(feats.translational_tags)} />
              <p className="text-[var(--fo-ink-body)]">
                <span className="font-medium">Mechanism:</span> {feats.mechanism_type} ·{" "}
                <span className="font-medium">Collaboration:</span> {feats.collaboration_complexity} ·{" "}
                <span className="font-medium">Human subjects:</span> {feats.human_subjects_relevance}
              </p>
              <p className="text-xs text-[var(--fo-ink-muted)]">Feature version {feats.feature_version}</p>
            </>
          ) : (
            <p className="text-[var(--fo-ink-muted)]">No legacy features row for this opportunity.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

function TagBlock({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-[var(--fo-ink-muted)]">{label}</h3>
      <div className="mt-1 flex flex-wrap gap-1">
        {values.map((t) => (
          <Badge key={t} tone="info">
            {t.replaceAll("_", " ")}
          </Badge>
        ))}
      </div>
    </div>
  );
}
