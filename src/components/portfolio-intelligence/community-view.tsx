"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type {
  Investigator,
  PortfolioIntelligenceDataBundle,
  PortfolioSignalItem,
  SignalSource,
} from "@/lib/portfolio-intelligence/mock-data";
import type { AnnotationDimensionTrend } from "@/lib/portfolio-intelligence/annotation-dimension-trends";
import {
  buildDiseaseLandscapeDomains,
  diseaseDomainPreview,
  isDiseaseDomainId,
  type DiseaseDomainId,
} from "@/lib/portfolio-intelligence/disease-landscape-hierarchy";
import {
  isSignalsOverTimeSegmentVisible,
  signalsOverTimeChartColors,
  signalsOverTimeLabels,
  signalsOverTimeStackOrder,
  groupTitleFromSource,
  sourceFromItem,
  type SignalsOverTimeRow,
} from "@/lib/portfolio-intelligence/signal-source";
import { resolveSignalSourceUrl } from "@/lib/portfolio-intelligence/resolve-signal-source-url";
import {
  signalsForSummaryLabel,
  type PortfolioSummaryListKind,
  type PortfolioSummaryListSignals,
} from "@/lib/portfolio-intelligence/summary-list-signals";

export type CommunityThemeMomentum = {
  id: string;
  name: string;
  current: number;
  prior: number;
  deltaPct: number;
  investigators: string[];
  opportunity: "High" | "Medium";
};

export type CommunityFundingPlaybookEntry = {
  id: string;
  title: string;
  agency: string;
  investigators: number;
  suggestedAction: string;
};

export type PortfolioSummaryListEntry = {
  label: string;
  count: number;
};

export type PortfolioSummaryInvestigatorEntry = {
  id: string;
  name: string;
  signalCount: number;
};

export type PortfolioIntelligenceSummaryData = {
  totalSignals: number;
  totalPublications: number;
  totalNewGrants: number;
  totalAnnotatedSignals: number;
  topThemes: PortfolioSummaryListEntry[];
  topMethods: PortfolioSummaryListEntry[];
  topDiseases: PortfolioSummaryListEntry[];
  topJournals: PortfolioSummaryListEntry[];
  topFundingAgencies: PortfolioSummaryListEntry[];
  topInvestigators: PortfolioSummaryInvestigatorEntry[];
  translationalSeries: Array<{ stage: string; count: number }>;
  fundingSeries: Array<{ label: string; count: number }>;
  signalsOverTimeSeries: SignalsOverTimeRow[];
  themesOverTime: AnnotationDimensionTrend;
  methodsOverTime: AnnotationDimensionTrend;
  diseasesOverTime: AnnotationDimensionTrend;
  journalsOverTime: AnnotationDimensionTrend;
  fundingAgenciesOverTime: AnnotationDimensionTrend;
  listSignals: PortfolioSummaryListSignals;
};

export type { PortfolioSummaryListKind, PortfolioSummaryListSignals };

export const RESEARCH_THEME_RULES: Array<{ theme: string; keywords: string[] }> = [
  { theme: "Immune Cell Biology", keywords: ["immune cell", "t cell", "b cell", "myeloid", "lymphocyte", "macrophage"] },
  { theme: "Inflammation", keywords: ["inflammation", "inflammatory", "cytokine", "tnf", "il-6", "innate immunity"] },
  { theme: "Cancer Immunology", keywords: ["cancer immunology", "tumor microenvironment", "checkpoint", "oncology", "immunotherapy"] },
  { theme: "Infection & Host Defense", keywords: ["infection", "pathogen", "host defense", "viral", "bacterial", "antimicrobial"] },
  { theme: "Autoimmunity", keywords: ["autoimmunity", "autoimmune", "immune tolerance", "treg", "lupus", "rheumatoid"] },
  { theme: "Clinical Translation", keywords: ["clinical trial", "phase i", "phase ii", "translational", "patient", "cohort"] },
  { theme: "Cell Therapy & Engineering", keywords: ["cell therapy", "car-t", "engineered t cell", "gene editing", "crispr", "synthetic biology"] },
  { theme: "Single-Cell & Omics", keywords: ["single-cell", "single cell", "rna-seq", "transcriptomic", "multi-omics", "proteomic"] },
  { theme: "Metabolism & Immunometabolism", keywords: ["metabolism", "immunometabolism", "metabolic", "glucose", "mitochondria"] },
];

const THEME_DISTRIBUTION_COLORS = ["#1f6f8a", "#2d8ea4", "#4e7bb8", "#5e8f88", "#7a80b8", "#6f8cb7", "#8e9cb4"];

export function inferResearchThemesFromSignal(
  item: PortfolioSignalItem,
  investigatorThemes: string[]
): string[] {
  const text = `${item.title} ${item.summaryText ?? ""}`.toLowerCase();
  const matched = RESEARCH_THEME_RULES.filter((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword))
  ).map((rule) => rule.theme);
  if (matched.length > 0) return Array.from(new Set(matched));
  if (investigatorThemes.length > 0) return investigatorThemes.slice(0, 2);
  return ["Translational Research"];
}

export function themeDistributionFromCounts(
  entries: Array<{ label: string; count: number }>,
  limit = 7
): PortfolioIntelligenceDataBundle["themeDistribution"] {
  const top = entries.slice(0, limit);
  const total = top.reduce((acc, entry) => acc + entry.count, 0) || 1;
  return top.map((entry, idx) => ({
    id: entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: entry.label,
    percentage: Math.max(1, Math.round((entry.count / total) * 100)),
    signalCount: entry.count,
    color: THEME_DISTRIBUTION_COLORS[idx] ?? "#8e9cb4",
  }));
}

export function themeDistributionFromScopedSignals(
  items: PortfolioSignalItem[],
  investigatorsById: Map<string, Investigator>
): PortfolioIntelligenceDataBundle["themeDistribution"] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const invThemes = item.investigatorIds.flatMap((id) => investigatorsById.get(id)?.keyThemes ?? []);
    const inferredThemes = inferResearchThemesFromSignal(item, invThemes);
    for (const theme of inferredThemes) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
  return themeDistributionFromCounts(sorted);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function InvestigatorAvatar({
  name,
  photoUrl,
  sizeClassName,
  textClassName,
}: {
  name: string;
  photoUrl?: string | null;
  sizeClassName: string;
  textClassName: string;
}) {
  if (photoUrl) {
    return (
      <div
        className={`${sizeClassName} shrink-0 rounded-full border border-[var(--border)] bg-cover bg-center bg-no-repeat`}
        style={{ backgroundImage: `url("${photoUrl}")` }}
        role="img"
        aria-label={`${name} profile photo`}
      />
    );
  }
  return (
    <div
      className={`${sizeClassName} shrink-0 rounded-full bg-[var(--fo-paper-2)] font-semibold text-[var(--fo-title)] ${textClassName} flex items-center justify-center`}
      aria-label={`${name} initials avatar`}
    >
      {initials(name)}
    </div>
  );
}

function CommunityStrategyBriefCard({
  summary,
  items,
}: {
  summary: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-ink-muted)]">
              Community Strategy Brief
            </p>
            <p className="mt-1 max-w-5xl text-sm text-[var(--fo-ink-body)]">{summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="px-3 py-1.5 text-xs">Generate Community Brief</Button>
            <Button className="px-3 py-1.5 text-xs" variant="secondary">
              Export Landscape Summary
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] px-3 py-2"
            >
              <p className="text-xs text-[var(--fo-ink-muted)]">{item.label}</p>
              <p className="text-sm font-semibold text-[var(--fo-title)]">{item.value}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function CommunityStatsRow({
  stats,
}: {
  stats: Array<{ id: string; label: string; value: string; subtext: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.id} className="app-surface-card px-4 py-3">
          <p className="text-xs text-[var(--fo-ink-muted)]">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--fo-title)]">{stat.value}</p>
          <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">{stat.subtext}</p>
        </div>
      ))}
    </div>
  );
}

function AnnotationDimensionTrendCard({
  title,
  description,
  trend,
  emptyMessage,
}: {
  title: string;
  description: string;
  trend: AnnotationDimensionTrend;
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody>
        {trend.labels.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {trend.labels.map((label) => (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={label}
                    name={label}
                    stroke={trend.colors[label]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-[var(--fo-ink-muted)]">{emptyMessage}</p>
        )}
      </CardBody>
    </Card>
  );
}

function formatSummarySignalDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SummarySignalLink({ signal }: { signal: PortfolioSignalItem }) {
  const source = sourceFromItem(signal);
  const sourceUrl = resolveSignalSourceUrl(signal);
  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--fo-ink-muted)]">
          {groupTitleFromSource(source)}
        </span>
        <span className="text-[11px] text-[var(--fo-ink-muted)]">{formatSummarySignalDate(signal.occurredAt)}</span>
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug text-[var(--fo-title)]">{signal.title}</p>
      {sourceUrl ? (
        <p className="mt-1 text-xs font-medium text-[var(--fo-interaction)]">Open source ↗</p>
      ) : (
        <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">Source link unavailable</p>
      )}
    </>
  );

  if (!sourceUrl) {
    return <div className="rounded-lg border border-[var(--border)] bg-[var(--fo-paper-2)]/40 px-3 py-2">{body}</div>;
  }

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-[var(--border)] bg-[var(--fo-paper-2)]/40 px-3 py-2 transition-colors hover:border-cyan-300 hover:bg-cyan-50/40"
    >
      {body}
    </a>
  );
}

type SummaryListDrillDown = {
  kind: PortfolioSummaryListKind;
  label: string;
  listTitle: string;
};

function PortfolioIntelligenceSummaryCard({
  summary,
  periodLabel,
  visibleSources,
}: {
  summary: PortfolioIntelligenceSummaryData;
  periodLabel: string;
  visibleSources: SignalSource[];
}) {
  const [drillDown, setDrillDown] = useState<SummaryListDrillDown | null>(null);

  const lists: Array<{
    title: string;
    kind: PortfolioSummaryListKind;
    rows: PortfolioSummaryListEntry[];
    emptyMessage: string;
  }> = [
    { title: "Top themes", kind: "themes", rows: summary.topThemes, emptyMessage: "No annotation data yet." },
    { title: "Top methods", kind: "methods", rows: summary.topMethods, emptyMessage: "No annotation data yet." },
    { title: "Top diseases", kind: "diseases", rows: summary.topDiseases, emptyMessage: "No annotation data yet." },
    {
      title: "Top journals",
      kind: "journals",
      rows: summary.topJournals,
      emptyMessage: "No PubMed signals in scope.",
    },
    {
      title: "Top funding agencies",
      kind: "fundingAgencies",
      rows: summary.topFundingAgencies,
      emptyMessage: "No grant signals in scope.",
    },
  ];

  const drillDownSignals = useMemo(() => {
    if (!drillDown) return [];
    return signalsForSummaryLabel(summary.listSignals, drillDown.kind, drillDown.label);
  }, [drillDown, summary.listSignals]);

  const toggleDrillDown = (kind: PortfolioSummaryListKind, listTitle: string, label: string) => {
    setDrillDown((current) =>
      current?.kind === kind && current.label === label ? null : { kind, label, listTitle }
    );
  };

  return (
    <Card>
      <CardHeader
        title="Portfolio Intelligence Summary"
        description="Signals, annotations, key entities, and translational/funding distributions."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] px-3 py-2">
            <p className="text-xs text-[var(--fo-ink-muted)]">Total signals</p>
            <p className="text-xl font-semibold text-[var(--fo-title)]">
              {summary.totalSignals.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] px-3 py-2">
            <p className="text-xs text-[var(--fo-ink-muted)]">Total publications</p>
            <p className="text-xl font-semibold text-[var(--fo-title)]">
              {summary.totalPublications.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] px-3 py-2">
            <p className="text-xs text-[var(--fo-ink-muted)]">New grants (not continuing)</p>
            <p className="text-xl font-semibold text-[var(--fo-title)]">
              {summary.totalNewGrants.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] px-3 py-2">
            <p className="text-xs text-[var(--fo-ink-muted)]">Annotated signals</p>
            <p className="text-xl font-semibold text-[var(--fo-title)]">
              {summary.totalAnnotatedSignals.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {lists.map((list) => (
            <div key={list.title} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
              <p className="text-sm font-semibold text-[var(--fo-title)]">
                {list.title}
                {list.rows.length > 0 ? (
                  <span className="ml-1.5 font-normal text-[var(--fo-ink-muted)]">({list.rows.length})</span>
                ) : null}
              </p>
              <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                {list.rows.length > 0 ? (
                  list.rows.map((row) => {
                    const selected =
                      drillDown?.kind === list.kind && drillDown.label === row.label;
                    return (
                      <button
                        key={row.label}
                        type="button"
                        onClick={() => toggleDrillDown(list.kind, list.title, row.label)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-xs transition-colors ${
                          selected
                            ? "bg-cyan-50 ring-1 ring-cyan-200"
                            : "hover:bg-[var(--fo-paper-2)]"
                        }`}
                        aria-pressed={selected}
                        title={`View signals for ${row.label}`}
                      >
                        <span
                          className={`min-w-0 truncate ${selected ? "font-medium text-[var(--fo-interaction)]" : "text-[var(--fo-ink-body)]"}`}
                        >
                          {row.label}
                        </span>
                        <span className="shrink-0 font-semibold text-[var(--fo-title)]">{row.count}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-[var(--fo-ink-muted)]">{list.emptyMessage}</p>
                )}
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-sm font-semibold text-[var(--fo-title)]">
              Top investigators with signals
              {summary.topInvestigators.length > 0 ? (
                <span className="ml-1.5 font-normal text-[var(--fo-ink-muted)]">
                  ({summary.topInvestigators.length})
                </span>
              ) : null}
            </p>
            <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
              {summary.topInvestigators.length > 0 ? (
                summary.topInvestigators.map((row) => (
                  <div key={row.id} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2 text-[var(--fo-ink-body)]">{row.name}</span>
                    <span className="font-semibold text-[var(--fo-title)]">{row.signalCount}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--fo-ink-muted)]">No investigator signals in scope.</p>
              )}
            </div>
          </div>
        </div>

        {drillDown ? (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/30 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--fo-title)]">
                  {drillDown.label}
                </p>
                <p className="text-xs text-[var(--fo-ink-muted)]">
                  {drillDown.listTitle} · {drillDownSignals.length} signal
                  {drillDownSignals.length === 1 ? "" : "s"} in {periodLabel.toLowerCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrillDown(null)}
                className="text-xs font-medium text-[var(--fo-interaction)] hover:underline"
              >
                Close
              </button>
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {drillDownSignals.length > 0 ? (
                drillDownSignals.slice(0, 50).map((signal) => (
                  <SummarySignalLink key={signal.id} signal={signal} />
                ))
              ) : (
                <p className="text-xs text-[var(--fo-ink-muted)]">No matching signals in the current scope.</p>
              )}
              {drillDownSignals.length > 50 ? (
                <p className="text-xs text-[var(--fo-ink-muted)]">
                  Showing first 50 of {drillDownSignals.length} signals.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <Card>
          <CardHeader
            title="Signals over time"
            description={`Monthly totals by signal type for ${periodLabel.toLowerCase()}`}
          />
          <CardBody>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.signalsOverTimeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {signalsOverTimeStackOrder
                    .filter((segment) => isSignalsOverTimeSegmentVisible(segment, visibleSources))
                    .map((segment) => (
                      <Area
                        key={segment}
                        type="monotone"
                        dataKey={segment}
                        name={signalsOverTimeLabels[segment]}
                        stackId="signals"
                        stroke={signalsOverTimeChartColors[segment]}
                        fill={signalsOverTimeChartColors[segment]}
                        fillOpacity={0.65}
                        strokeWidth={1.5}
                      />
                    ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Translational stage" />
            <CardBody>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.translationalSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0e7490" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Funding graph" />
            <CardBody>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.fundingSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <AnnotationDimensionTrendCard
            title="Top themes over time"
            description="Yearly mention counts for leading themes over the past 10 years"
            trend={summary.themesOverTime}
            emptyMessage="No theme annotation data yet."
          />
          <AnnotationDimensionTrendCard
            title="Top methods over time"
            description="Yearly mention counts for leading methods over the past 10 years"
            trend={summary.methodsOverTime}
            emptyMessage="No methods annotation data yet."
          />
          <AnnotationDimensionTrendCard
            title="Top diseases over time"
            description="Yearly mention counts for leading diseases over the past 10 years"
            trend={summary.diseasesOverTime}
            emptyMessage="No disease annotation data yet."
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <AnnotationDimensionTrendCard
            title="Top journals over time"
            description="Yearly publication counts by journal over the past 10 years"
            trend={summary.journalsOverTime}
            emptyMessage="No PubMed signals in scope."
          />
          <AnnotationDimensionTrendCard
            title="Top funding agencies over time"
            description="Yearly grant counts by agency over the past 10 years"
            trend={summary.fundingAgenciesOverTime}
            emptyMessage="No grant signals in scope."
          />
        </div>
      </CardBody>
    </Card>
  );
}

type DiseaseLandscapeView =
  | { kind: "domains" }
  | { kind: "conditions"; domainId: DiseaseDomainId };

function DiseaseLandscapeMapCard({
  diseases,
}: {
  diseases: PortfolioSummaryListEntry[];
}) {
  const domains = useMemo(() => buildDiseaseLandscapeDomains(diseases), [diseases]);
  const [view, setView] = useState<DiseaseLandscapeView>({ kind: "domains" });

  useEffect(() => {
    setView({ kind: "domains" });
  }, [diseases]);

  const selectedDomain = useMemo(
    () => (view.kind === "conditions" ? domains.find((domain) => domain.id === view.domainId) ?? null : null),
    [domains, view]
  );

  const boxes = useMemo(() => {
    if (view.kind === "conditions" && selectedDomain) {
      const total = selectedDomain.count || 1;
      return selectedDomain.children.map((child, index) => ({
        id: child.id,
        name: child.label,
        subtitle: null as string | null,
        count: child.count,
        percentage: Math.max(1, Math.round((child.count / total) * 100)),
        color:
          selectedDomain.color ??
          THEME_DISTRIBUTION_COLORS[index % THEME_DISTRIBUTION_COLORS.length] ??
          "#8e9cb4",
      }));
    }
    return domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      subtitle: diseaseDomainPreview(domain.children),
      count: domain.count,
      percentage: domain.percentage,
      color: domain.color,
    }));
  }, [domains, selectedDomain, view.kind]);

  const totalMentions = useMemo(
    () => diseases.reduce((acc, row) => acc + row.count, 0),
    [diseases]
  );

  return (
    <Card>
      <CardHeader
        title="Disease Landscape Map"
        description="Hierarchical disease domains from AI annotations — click a domain to see constituent conditions"
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fo-ink-muted)]">
          <button
            type="button"
            onClick={() => setView({ kind: "domains" })}
            className={`font-medium transition-colors ${
              view.kind === "conditions" ? "text-[var(--fo-interaction)] hover:underline" : "text-[var(--fo-title)]"
            }`}
          >
            All domains
          </button>
          {view.kind === "conditions" && selectedDomain ? (
            <>
              <span aria-hidden>/</span>
              <span className="font-medium text-[var(--fo-title)]">{selectedDomain.name}</span>
              <span>
                · {selectedDomain.children.length} condition
                {selectedDomain.children.length === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span>
              · {domains.length} domain{domains.length === 1 ? "" : "s"} ·{" "}
              {totalMentions.toLocaleString()} mentions
            </span>
          )}
        </div>

        {boxes.length > 0 ? (
          <div
            className={`grid grid-cols-2 gap-2 lg:grid-cols-3 ${
              view.kind === "conditions" ? "max-h-[28rem] overflow-y-auto overscroll-contain pr-1" : ""
            }`}
          >
            {boxes.map((box) => {
              const isDomain = view.kind === "domains";
              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => {
                    if (isDomain && isDiseaseDomainId(box.id)) {
                      setView({ kind: "conditions", domainId: box.id });
                    }
                  }}
                  disabled={!isDomain}
                  className={`rounded-xl border border-white/30 p-3 text-left text-white shadow-sm transition-transform ${
                    isDomain ? "hover:scale-[1.02] hover:shadow-md" : "cursor-default"
                  }`}
                  style={{ background: box.color }}
                  title={isDomain ? `Explore ${box.name}` : box.name}
                >
                  <p className="line-clamp-2 text-sm font-semibold">{box.name}</p>
                  {box.subtitle ? (
                    <p className="mt-1 line-clamp-2 text-xs opacity-90">{box.subtitle}</p>
                  ) : null}
                  <p className="mt-1 text-xs opacity-90">{box.percentage}% of view</p>
                  <p className="text-xs opacity-90">{box.count.toLocaleString()} mentions</p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--fo-ink-muted)]">No disease annotation data yet.</p>
        )}

        {view.kind === "conditions" ? (
          <button
            type="button"
            onClick={() => setView({ kind: "domains" })}
            className="text-xs font-medium text-[var(--fo-interaction)] hover:underline"
          >
            ← Back to all domains
          </button>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ThemeLandscapeMapCard({
  themes,
}: {
  themes: PortfolioIntelligenceDataBundle["themeDistribution"];
}) {
  return (
    <Card>
      <CardHeader
        title="Theme Landscape Map"
        description="Research themes inferred from signals when disease annotations are unavailable"
      />
      <CardBody>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {themes.slice(0, 9).map((theme) => (
            <div
              key={theme.id}
              className="rounded-xl border border-white/30 p-3 text-white shadow-sm"
              style={{ background: theme.color }}
            >
              <p className="text-sm font-semibold">{theme.name}</p>
              <p className="mt-1 text-xs opacity-90">{theme.percentage}%</p>
              <p className="text-xs opacity-90">{theme.signalCount} signals</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function EmergingThemesCard({ themes }: { themes: CommunityThemeMomentum[] }) {
  return (
    <Card>
      <CardHeader title="Emerging Themes / Momentum" description="Current period vs prior period growth" />
      <CardBody className="space-y-2">
        {themes.slice(0, 6).map((theme) => (
          <div key={theme.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--fo-title)]">{theme.name}</p>
              <span className="text-xs font-semibold text-emerald-700">
                {theme.deltaPct >= 0 ? "+" : ""}
                {theme.deltaPct}%
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--fo-ink-muted)]">
              {theme.current} current · {theme.prior} prior · {theme.opportunity} opportunity
            </p>
            <p className="mt-1 text-xs text-[var(--fo-ink-body)]">
              Investigators: {theme.investigators.slice(0, 3).join(", ") || "N/A"}
            </p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function FundingPlaybookCard({ entries }: { entries: CommunityFundingPlaybookEntry[] }) {
  return (
    <Card>
      <CardHeader title="Funding Playbook" description="Opportunities matching multiple investigators" />
      <CardBody className="space-y-2">
        {entries.slice(0, 6).map((entry) => (
          <div key={entry.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--fo-title)]">{entry.title}</p>
            <p className="text-xs text-[var(--fo-ink-muted)]">
              {entry.agency} · {entry.investigators} investigators matched
            </p>
            <p className="mt-1 text-xs text-[var(--fo-ink-body)]">{entry.suggestedAction}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function CollaborationClusterMapCard() {
  return (
    <Card>
      <CardHeader title="Collaboration Cluster Map" description="Top investigator clusters" />
      <CardBody>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-3">
          <svg viewBox="0 0 220 90" className="h-36 w-full">
            <g>
              <line x1="25" y1="22" x2="45" y2="42" stroke="#bcc8d8" strokeWidth={1.5} />
              <line x1="45" y1="42" x2="25" y2="62" stroke="#bcc8d8" strokeWidth={1.5} />
              <line x1="25" y1="22" x2="25" y2="62" stroke="#bcc8d8" strokeWidth={1.5} />
              <circle cx="25" cy="22" r="5" fill="#0e7490" />
              <circle cx="45" cy="42" r="5" fill="#14b8a6" />
              <circle cx="25" cy="62" r="5" fill="#38bdf8" />
            </g>
            <g>
              <line x1="100" y1="22" x2="122" y2="40" stroke="#bcc8d8" strokeWidth={1.5} />
              <line x1="122" y1="40" x2="100" y2="58" stroke="#bcc8d8" strokeWidth={1.5} />
              <line x1="100" y1="22" x2="100" y2="58" stroke="#bcc8d8" strokeWidth={1.5} />
              <circle cx="100" cy="22" r="5" fill="#2563eb" />
              <circle cx="122" cy="40" r="5" fill="#60a5fa" />
              <circle cx="100" cy="58" r="5" fill="#818cf8" />
            </g>
            <g>
              <line x1="170" y1="22" x2="192" y2="40" stroke="#bcc8d8" strokeWidth={1.5} />
              <line x1="192" y1="40" x2="170" y2="58" stroke="#bcc8d8" strokeWidth={1.5} />
              <line x1="170" y1="22" x2="170" y2="58" stroke="#bcc8d8" strokeWidth={1.5} />
              <circle cx="170" cy="22" r="5" fill="#7c3aed" />
              <circle cx="192" cy="40" r="5" fill="#a78bfa" />
              <circle cx="170" cy="58" r="5" fill="#c4b5fd" />
            </g>
          </svg>
        </div>
      </CardBody>
    </Card>
  );
}

function InvestigatorsToPrioritizeCard({
  rows,
  onSelect,
}: {
  rows: Investigator[];
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Investigators to Prioritize"
        description="Top candidates for near-term strategy support"
      />
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[var(--fo-paper-2)] text-xs uppercase tracking-wide text-[var(--fo-ink-muted)]">
            <tr>
              <th className="px-3 py-2">Investigator</th>
              <th className="px-2 py-2">Top Themes</th>
              <th className="px-2 py-2">Opportunity</th>
              <th className="px-2 py-2">Collaboration</th>
              <th className="px-2 py-2">Match</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)]/70">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <InvestigatorAvatar
                      name={row.name}
                      photoUrl={row.photoUrl}
                      sizeClassName="h-7 w-7"
                      textClassName="text-[10px]"
                    />
                    <div>
                      <p className="font-semibold text-[var(--fo-title)]">{row.name}</p>
                      <p className="text-xs text-[var(--fo-ink-muted)]">{row.department}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.keyThemes.slice(0, 3).map((theme) => (
                      <span
                        key={theme}
                        className="rounded-md bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-[11px] text-[var(--fo-title)]"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-2 text-xs text-[var(--fo-ink-body)]">
                  {row.matchStrength >= 75 ? "High" : "Medium"}
                </td>
                <td className="px-2 py-2 text-xs text-[var(--fo-ink-body)]">{row.collaborationIndex}</td>
                <td className="px-2 py-2 text-xs text-[var(--fo-ink-body)]">{row.matchStrength}%</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    className="text-xs font-medium text-[var(--fo-interaction)] hover:underline"
                  >
                    Add to consult
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

export function CommunityViewPage({
  strategySummary,
  strategyHighlights,
  stats,
  portfolioSummary,
  periodLabel,
  visibleSources,
  themeDistribution,
  emergingThemes,
  fundingPlaybook,
  priorityInvestigators,
  onSelectInvestigator,
}: {
  strategySummary: string;
  strategyHighlights: Array<{ label: string; value: string }>;
  stats: Array<{ id: string; label: string; value: string; subtext: string }>;
  portfolioSummary: PortfolioIntelligenceSummaryData;
  periodLabel: string;
  visibleSources: SignalSource[];
  themeDistribution: PortfolioIntelligenceDataBundle["themeDistribution"];
  emergingThemes: CommunityThemeMomentum[];
  fundingPlaybook: CommunityFundingPlaybookEntry[];
  priorityInvestigators: Investigator[];
  onSelectInvestigator: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <CommunityStrategyBriefCard summary={strategySummary} items={strategyHighlights} />
      <CommunityStatsRow stats={stats} />
      <PortfolioIntelligenceSummaryCard
        summary={portfolioSummary}
        periodLabel={periodLabel}
        visibleSources={visibleSources}
      />
      <div className="grid gap-4 2xl:grid-cols-3">
        {portfolioSummary.topDiseases.length > 0 ? (
          <DiseaseLandscapeMapCard diseases={portfolioSummary.topDiseases} />
        ) : (
          <ThemeLandscapeMapCard themes={themeDistribution} />
        )}
        <EmergingThemesCard themes={emergingThemes} />
        <FundingPlaybookCard entries={fundingPlaybook} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[340px,1fr]">
        <CollaborationClusterMapCard />
        <InvestigatorsToPrioritizeCard rows={priorityInvestigators} onSelect={onSelectInvestigator} />
      </div>
    </div>
  );
}
