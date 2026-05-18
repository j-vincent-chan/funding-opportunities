import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { generatePiCommunityNarrative } from "@/lib/ai/pi-community-narrative";
import {
  buildCapabilityMatrix,
  buildDeptThemeMatrix,
  buildEquityByRank,
  buildExclusiveEngagementStages,
  buildGroupedPipeline,
  buildMechanismByDeptHeatmap,
  buildNetworkSample,
  buildOutcomeSnapshot,
  buildPublicationGrantTrends,
  buildStrategistFunnel,
  buildTerminalEngagementCounts,
  buildThemeIcHeatmap,
} from "@/lib/community/community-snapshot-builders";
import {
  investigatorDbRowsToCommunityRows,
  buildPiCommunityAggregates,
  topCounts,
} from "@/lib/tracked-pis/community-aggregates";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CommunityBarChart } from "@/components/pi-community/community-charts";
import { CommunitySnapshotDashboard } from "@/components/pi-community/community-snapshot-dashboard";
import { BulkRefreshCachesPanel } from "@/components/pi-community/bulk-refresh-caches-panel";
import { Button } from "@/components/ui/button";
import { recomputeCommunityCollaborationsFormAction } from "@/app/actions/community-intelligence";

export const dynamic = "force-dynamic";

export default async function PiCommunityPage() {
  const supabase = createClient();
  const graphCommonsGraphUrl =
    process.env.NEXT_PUBLIC_GRAPHCOMMON_GRAPH_URL?.trim() ||
    process.env.NEXT_PUBLIC_GRAPHCOMMONS_GRAPH_URL?.trim() ||
    null;
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoIso = yearAgo.toISOString().slice(0, 10);

  const [
    { data: invRows, error },
    pubRecentRes,
    grantsRes,
    engagementsRes,
    relRes,
    pubsForTrendRes,
    grantsForVizRes,
    engagementsFullRes,
    relSampleRes,
  ] = await Promise.all([
    supabase.from("investigators").select(
      "id, full_name, home_department, division, rank, investigator_profile_features(science_tags, disease_tags, method_tags, translational_tags)"
    ),
    supabase
      .from("investigator_publications")
      .select("*", { count: "exact", head: true })
      .gte("publication_date", yearAgoIso),
    supabase
      .from("investigator_nih_grants")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("strategist_engagements").select("*", { count: "exact", head: true }),
    supabase
      .from("investigator_relationships")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "pubmed_coauthorship"),
    supabase.from("investigator_publications").select("publication_date"),
    supabase.from("investigator_nih_grants").select("investigator_id, fiscal_year, project_num, ic_name"),
    supabase.from("strategist_engagements").select("investigator_id, status"),
    supabase
      .from("investigator_relationships")
      .select("investigator_a_id, investigator_b_id, evidence_count, source_type")
      .order("evidence_count", { ascending: false })
      .limit(450),
  ]);

  const pubRecentCount = pubRecentRes.count ?? 0;
  const grantCount = grantsRes.count ?? 0;
  const engagementCount = engagementsRes.count ?? 0;
  const collaborationEdges = relRes.count ?? 0;

  const investigators = invRows ?? [];
  const nameById = new Map(investigators.map((r) => [r.id as string, r.full_name as string]));

  const normalized = investigators.map((r) => {
    const f = r.investigator_profile_features as
      | { science_tags?: string[]; disease_tags?: string[] }
      | { science_tags?: string[]; disease_tags?: string[] }[]
      | null
      | undefined;
    const features = Array.isArray(f) ? f[0] : f;
    return {
      home_department: r.home_department as string | null,
      division: r.division as string | null,
      investigator_profile_features: features ?? null,
    };
  });

  const communityRows = investigatorDbRowsToCommunityRows(normalized);
  const agg = buildPiCommunityAggregates(communityRows);
  const narrative = await generatePiCommunityNarrative(agg).catch(() => null);

  const openAi = Boolean(process.env.OPENAI_API_KEY?.trim());

  const pubDates = (pubsForTrendRes.data ?? []).map((p) => p.publication_date as string | null);
  const grantYears = (grantsForVizRes.data ?? []).map((g) => g.fiscal_year as number | null);
  const trendData = buildPublicationGrantTrends(pubDates, grantYears);

  const engagementsList = (engagementsFullRes.data ?? []) as {
    investigator_id: string;
    status: string;
  }[];
  const statusList = engagementsList.map((e) => e.status);
  const funnelStages = buildStrategistFunnel(statusList);
  const groupedPipeline = buildGroupedPipeline(statusList);
  const terminalCounts = buildTerminalEngagementCounts(statusList);
  const outcome = buildOutcomeSnapshot(statusList);
  const engagementStages = buildExclusiveEngagementStages(investigators.length, engagementsList);

  const engagedIds = new Set(engagementsList.map((e) => e.investigator_id));
  const rankEngagement = buildEquityByRank(
    investigators.map((i) => ({ id: i.id as string, rank: i.rank as string | null })),
    engagedIds
  );

  const engagementFrequency = new Map<string, number>();
  for (const e of engagementsList) {
    const id = e.investigator_id;
    engagementFrequency.set(id, (engagementFrequency.get(id) ?? 0) + 1);
  }
  const recurringInvestigatorCount = Array.from(engagementFrequency.values()).filter(
    (n) => n >= 2
  ).length;

  const deptThemeRows = investigators.map((r) => {
    const f = r.investigator_profile_features as
      | { science_tags?: string[] }
      | { science_tags?: string[] }[]
      | null
      | undefined;
    const features = Array.isArray(f) ? f[0] : f;
    return {
      home_department: r.home_department as string | null,
      division: r.division as string | null,
      science_tags: features?.science_tags ?? [],
    };
  });
  const deptThemeMatrix = buildDeptThemeMatrix(deptThemeRows, 10, 10);

  const invById = new Map(
    investigators.map((r) => {
      const f = r.investigator_profile_features as
        | { science_tags?: string[] }
        | { science_tags?: string[] }[]
        | null
        | undefined;
      const features = Array.isArray(f) ? f[0] : f;
      return [
        r.id as string,
        {
          home_department: r.home_department as string | null,
          division: r.division as string | null,
          firstTheme: features?.science_tags?.[0] ?? null,
        },
      ] as const;
    })
  );

  const grantRows = (grantsForVizRes.data ?? []) as {
    investigator_id: string;
    fiscal_year: number | null;
    project_num: string | null;
    ic_name: unknown;
  }[];
  const mechanismRows = grantRows.map((g) => {
    const inv = invById.get(g.investigator_id);
    return {
      home_department: inv?.home_department ?? null,
      division: inv?.division ?? null,
      project_num: g.project_num,
    };
  });
  const mechanismDeptMatrix = buildMechanismByDeptHeatmap(mechanismRows, 10, 6);

  const themeIcPairs = grantRows.map((g) => ({
    theme: invById.get(g.investigator_id)?.firstTheme ?? null,
    ic_name: g.ic_name,
  }));
  const themeIcMatrix = buildThemeIcHeatmap(themeIcPairs, 8, 8);

  const capabilityRows = investigators.map((r) => {
    const f = r.investigator_profile_features as
      | { method_tags?: string[] }
      | { method_tags?: string[] }[]
      | null
      | undefined;
    const features = Array.isArray(f) ? f[0] : f;
    return {
      home_department: r.home_department as string | null,
      division: r.division as string | null,
      method_tags: features?.method_tags ?? [],
    };
  });
  const capabilityMatrix = buildCapabilityMatrix(capabilityRows, 10, 10);

  const rawEdges = (relSampleRes.data ?? []) as {
    investigator_a_id: string;
    investigator_b_id: string;
    evidence_count: number;
  }[];
  const { nodes: networkNodes, edges: networkEdges } = buildNetworkSample(
    rawEdges,
    nameById,
    48,
    400
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="app-page-title">Community Snapshot</h1>
        <p className="app-page-description">
          Strategist-facing view: collaboration structure, activity trends, funding and mechanism
          coverage, engagement depth, capability signals, equity slices, and outcome rates — backed by
          your investigator directory, cached PubMed / NIH RePORTER data, and{" "}
          <Link href="/pi-community/engagements" className="text-[var(--fo-interaction)] underline hover:text-[var(--fo-title)]">
            engagement tracking
          </Link>
          . Directory:{" "}
          <Link href="/investigators" className="text-[var(--fo-interaction)] underline hover:text-[var(--fo-title)]">
            Investigators
          </Link>
          .
        </p>
        {!openAi ? (
          <p className="mt-2 text-sm text-amber-800">
            Set <code className="rounded bg-amber-100 px-1">OPENAI_API_KEY</code> in{" "}
            <code className="rounded bg-amber-100 px-1">.env.local</code> for the narrative section.
          </p>
        ) : null}
      </header>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Publications (12 mo, cached)
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {pubRecentCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            NIH projects (cached, active flag)
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {grantCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Strategist engagements
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {engagementCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Co-authorship edges
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {collaborationEdges.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <span>
          After refreshing PubMed on investigator pages, rebuild shared-publication collaboration
          pairs:
        </span>
        <form action={recomputeCommunityCollaborationsFormAction}>
          <Button type="submit" variant="secondary">
            Recompute co-authorship graph
          </Button>
        </form>
      </div>

      <BulkRefreshCachesPanel />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Investigators
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {agg.totalPis.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            With primary science tag
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {agg.withPrimaryResearchArea.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            With primary disease tag
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {agg.withPrimaryDisease.toLocaleString()}
          </p>
        </div>
      </div>

      <CommunitySnapshotDashboard
        deptThemeMatrix={deptThemeMatrix}
        themeIcMatrix={themeIcMatrix}
        mechanismDeptMatrix={mechanismDeptMatrix}
        capabilityMatrix={capabilityMatrix}
        trendData={trendData}
        funnelStages={funnelStages}
        groupedPipeline={groupedPipeline}
        engagementStages={engagementStages}
        terminalCounts={terminalCounts}
        rankEngagement={rankEngagement}
        outcome={outcome}
        networkNodes={networkNodes}
        networkEdges={networkEdges}
        recurringInvestigatorCount={recurringInvestigatorCount}
        graphCommonsGraphUrl={graphCommonsGraphUrl}
      />

      {narrative ? (
        <Card>
          <CardHeader
            title="AI summary"
            description="Generated from aggregate tag counts (not individual profiles)."
          />
          <CardBody>
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              {narrative.split(/\n\n+/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : openAi ? (
        <p className="text-sm text-slate-500">Could not generate summary right now.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CommunityBarChart
          title="Primary science tag (top 12)"
          data={topCounts(agg.primaryResearchArea, 12)}
          emptyMessage="No primary science tags yet. Run profile normalization after importing investigators."
        />
        <CommunityBarChart
          title="Secondary science tags (top 12)"
          data={topCounts(agg.secondaryResearchTokens, 12)}
          emptyMessage="No secondary science tokens yet (additional tags beyond the first)."
        />
        <CommunityBarChart
          title="Primary disease tag (top 12)"
          data={topCounts(agg.primaryDisease, 12)}
          emptyMessage="No primary disease tags yet."
        />
        <CommunityBarChart
          title="Secondary disease tags (top 12)"
          data={topCounts(agg.secondaryDiseaseTokens, 12)}
          emptyMessage="No secondary disease tokens yet."
        />
      </div>

      <CommunityBarChart
        title="Department / division (top 15)"
        data={topCounts(agg.byInstitution, 15)}
        emptyMessage="No department or division values on file."
      />
    </div>
  );
}
