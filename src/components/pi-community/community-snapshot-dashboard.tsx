"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  EngagementTier,
  FunnelStage,
  HeatmapGrid,
  OutcomeSnapshot,
  RankEngagementRow,
  YearTrendPoint,
} from "@/lib/community/community-snapshot-builders";
import { CommunityHeatmap } from "@/components/pi-community/community-heatmap";
import {
  CommunityNetworkGraph,
  type NetworkEdge,
  type NetworkNode,
} from "@/components/pi-community/community-network-graph";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <p className="max-w-3xl text-sm text-slate-600">{children}</p>;
}

export function CommunitySnapshotDashboard({
  deptThemeMatrix,
  themeIcMatrix,
  mechanismDeptMatrix,
  capabilityMatrix,
  trendData,
  funnelStages,
  groupedPipeline,
  engagementStages,
  terminalCounts,
  rankEngagement,
  outcome,
  networkNodes,
  networkEdges,
  recurringInvestigatorCount,
  graphCommonsGraphUrl,
}: {
  deptThemeMatrix: HeatmapGrid;
  themeIcMatrix: HeatmapGrid;
  mechanismDeptMatrix: HeatmapGrid;
  capabilityMatrix: HeatmapGrid;
  trendData: YearTrendPoint[];
  funnelStages: FunnelStage[];
  groupedPipeline: { label: string; count: number }[];
  engagementStages: EngagementTier[];
  terminalCounts: { declined: number; dormant: number };
  rankEngagement: RankEngagementRow[];
  outcome: OutcomeSnapshot;
  networkNodes: NetworkNode[];
  networkEdges: NetworkEdge[];
  recurringInvestigatorCount: number;
  graphCommonsGraphUrl?: string | null;
}) {
  const hasTrend = trendData.some((d) => d.publications > 0 || d.nihGrantRows > 0);

  return (
    <div className="space-y-12">
      <Section title="1. Community structure">
        <Subhead>
          Collaboration networks reveal clusters, bridge-builders, and isolated investigators. A
          department-by-theme matrix highlights where organizational units sit relative to
          scientific themes — useful for cross-department opportunities.
        </Subhead>
        <CommunityNetworkGraph
          title="Co-authorship network (sample)"
          description="Edges from cached PubMed co-authorship pairs; recompute from the toolbar above after refreshing publications."
          nodes={networkNodes}
          edges={networkEdges}
          sourceNote="Links: shared publications (co-authorship proxy). Other edge types (shared grants, cores) can be added as data lands."
          emptyMessage="No collaboration edges yet — run “Recompute co-authorship graph” after PubMed cache is populated."
          graphCommonsGraphUrl={graphCommonsGraphUrl ?? null}
        />

        <CommunityHeatmap
          title="Department × primary science theme"
          description="Rows = home department (or division); columns = first science tag. Highlights cross-department thematic overlap."
          rowAxisLabel="Department"
          colAxisLabel="Theme"
          grid={deptThemeMatrix}
          emptyMessage="Need departments and science tags on investigators."
        />
      </Section>

      <Section title="2. Research activity & pipeline">
        <Subhead>
          Trends show momentum in cached publications and NIH grant rows. The funnel surfaces where
          strategist work stalls — many early-stage engagements but few submissions often point to
          fit or bandwidth; many submissions but few awards point to competitiveness or positioning.
        </Subhead>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Publications & NIH grant rows (by calendar / fiscal year)
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Publications use publication year; NIH rows use fiscal year from RePORTER cache.
            </p>
            {!hasTrend ? (
              <p className="mt-4 text-sm text-slate-500">
                No dated publications or grants in range — refresh PubMed / RePORTER on profiles.
              </p>
            ) : (
              <div className="mt-3 h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis
                      yAxisId="left"
                      allowDecimals={false}
                      className="text-xs"
                      label={{ value: "Publications", angle: -90, position: "insideLeft" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      allowDecimals={false}
                      className="text-xs"
                      label={{ value: "NIH rows", angle: 90, position: "insideRight" }}
                    />
                    <Tooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="publications"
                      name="Publications"
                      fill="#818cf8"
                      stroke="#4f46e5"
                      fillOpacity={0.35}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="nihGrantRows"
                      name="NIH grant rows"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Strategist pipeline (grouped)</h3>
            <p className="mt-1 text-xs text-slate-600">
              Approximate funnel — counts are engagements in each bucket (not cumulative flow).
            </p>
            <div className="mt-3 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupedPipeline}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                  <XAxis type="number" allowDecimals={false} className="text-xs" />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={200}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(v) => [String(v ?? ""), "Engagements"]} />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Declined: {terminalCounts.declined} · Dormant: {terminalCounts.dormant} (see status
              distribution below).
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Engagement status distribution</h3>
          <p className="mt-1 text-xs text-slate-600">Every engagement record — current status.</p>
          <div className="mt-3 h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelStages.map((f) => ({ ...f, label: f.label }))}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis type="number" allowDecimals={false} className="text-xs" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={180}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(v) => [String(v ?? ""), "Count"]} />
                <Bar dataKey="count" fill="#64748b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="3. Funding landscape">
        <Subhead>
          Heat views show dependence on NIH activity codes and institutes. Foundation, DoD, and
          industry awards are not in this cache yet — when added, they can appear as extra columns.
        </Subhead>
        <div className="grid gap-4 lg:grid-cols-2">
          <CommunityHeatmap
            title="Department × NIH mechanism (coarse)"
            description="Rows from investigator home department; values count cached RePORTER rows by R / U / P / training buckets."
            rowAxisLabel="Department"
            colAxisLabel="Mechanism"
            grid={mechanismDeptMatrix}
            emptyMessage="No NIH grant cache rows — refresh RePORTER on investigator profiles."
          />
          <CommunityHeatmap
            title="Primary science theme × NIH IC"
            description="Where scientific themes meet institute centers — highlights sponsor-interest concentration and whitespace."
            rowAxisLabel="Theme"
            colAxisLabel="IC"
            grid={themeIcMatrix}
            emptyMessage="Need science tags and cached NIH rows with IC names."
          />
        </div>
      </Section>

      <Section title="4. Coverage & engagement">
        <Subhead>
          Mutually exclusive stages per investigator show who has not been reached, who is in active
          cultivation, and who has reached submission or award. Investigators with multiple
          engagement rows:{" "}
          <span className="font-medium text-slate-800">{recurringInvestigatorCount}</span>.
        </Subhead>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {engagementStages.map((t) => (
            <div
              key={t.tier}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t.tier}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{t.count}</p>
              <p className="mt-2 text-xs text-slate-600">{t.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="5. Collaboration capabilities (assets)">
        <Subhead>
          Method and platform tags by department help spot complementary assets (models, methods,
          data, cores) for team-building — extend with structured core usage when available.
        </Subhead>
        <CommunityHeatmap
          title="Department × method / platform tags"
          description="Counts investigator–method pairs from normalized method_tags."
          rowAxisLabel="Department"
          colAxisLabel="Method"
          grid={capabilityMatrix}
          emptyMessage="No method_tags on profile features yet."
        />
      </Section>

      <Section title="6. Equity & access (rank coverage)">
        <Subhead>
          Share of investigators with at least one strategist engagement, broken out by rank on
          file. Tune rank values in the directory import for clearer slices.
        </Subhead>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Engagement rate by rank</h3>
          <p className="mt-1 text-xs text-slate-600">
            Bar length = % of investigators in that rank with ≥1 engagement.
          </p>
          {rankEngagement.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No investigator rows.</p>
          ) : (
            <div className="mt-3 h-[min(28rem,60vh)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankEngagement.map((r) => ({
                    ...r,
                    pct: r.total > 0 ? Math.round((r.engaged / r.total) * 1000) / 10 : 0,
                    label: `${r.rankLabel} (${r.total} total)`,
                  }))}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    className="text-xs"
                  />
                  <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v, name, p) => {
                      const row = p?.payload as RankEngagementRow & { pct: number };
                      return [`${row.pct}% (${row.engaged}/${row.total})`, "Engaged"];
                    }}
                  />
                  <Bar dataKey="pct" fill="#0d9488" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Section>

      <Section title="7. Outcome quality (from engagements)">
        <Subhead>
          Volume alone misleads — track success rate on terminal paths and iterate services. Finer
          analytics (time to submission, review cycles, editing support) need structured proposal
          milestones when that module ships.
        </Subhead>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{outcome.submitted}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Funded</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{outcome.funded}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Declined</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{outcome.declined}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Success rate
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {outcome.successRate == null
                ? "—"
                : `${Math.round(outcome.successRate * 1000) / 10}%`}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Funded ÷ (submitted + funded + declined)
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
