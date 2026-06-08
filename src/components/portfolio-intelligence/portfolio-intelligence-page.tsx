"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import type { MouseHandlerDataParam } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  Collaborator,
  ConsultationBriefSection,
  FundingOpportunityMatch,
  Investigator,
  InvestigatorFundingMatch,
  InvestigatorMetric,
  InvestigatorTheme,
  MatchStrength,
  PortfolioSignalItem,
  PortfolioIntelligenceDataBundle,
  PortfolioViewMode,
  SignalSource,
} from "@/lib/portfolio-intelligence/mock-data";
import {
  defaultActiveSources,
  sourceChipLabels,
} from "@/lib/portfolio-intelligence/mock-data";
import {
  grantAgencyLabel,
  pubmedJournalLabel,
  type CommunitySourceItemRow,
} from "@/lib/community/signal-dashboard-analytics";
import {
  CommunityViewPage,
  inferResearchThemesFromSignal,
  themeDistributionFromCounts,
  themeDistributionFromScopedSignals,
  type CommunityFundingPlaybookEntry,
  type CommunityThemeMomentum,
  type PortfolioIntelligenceSummaryData,
} from "@/components/portfolio-intelligence/community-view";
import {
  buildAnnotationDimensionTrend,
  buildPastYearKeys,
  buildSignalLabelTrend,
  yearLabelFromKey,
} from "@/lib/portfolio-intelligence/annotation-dimension-trends";
import {
  buildAnnotationDimensionSignalMap,
  buildItemLabelSignalMap,
  type PortfolioSummaryListSignals,
} from "@/lib/portfolio-intelligence/summary-list-signals";
import { resolveSignalSourceUrl } from "@/lib/portfolio-intelligence/resolve-signal-source-url";
import {
  emptySignalsOverTimeCounts,
  grantTimelineSegmentFromItem,
  groupTitleFromSource,
  signalsOverTimeStackOrder,
  sourceFromItem,
} from "@/lib/portfolio-intelligence/signal-source";

type PeriodRangeId = "ytd" | "1y" | "2y" | "5y" | "10y" | "max";

const PERIOD_RANGE_OPTIONS: Array<{ id: PeriodRangeId; label: string; months?: number }> = [
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1 year", months: 12 },
  { id: "2y", label: "2 years", months: 24 },
  { id: "5y", label: "5 years", months: 60 },
  { id: "10y", label: "10 years", months: 120 },
  { id: "max", label: "Max" },
];

function computePeriodMonthKeys(
  periodRange: PeriodRangeId,
  boundedLatestMonthKey: string,
  allMonthKeys: string[]
): { current: string[]; prior: string[] } {
  if (periodRange === "max") {
    const current = allMonthKeys.length > 0 ? allMonthKeys : [boundedLatestMonthKey];
    return { current, prior: [] };
  }

  let current: string[];
  if (periodRange === "ytd") {
    const [ly] = boundedLatestMonthKey.split("-");
    const ytdStart = `${ly}-01`;
    const [sy, sm] = ytdStart.split("-").map((v) => Number(v));
    const [ey, em] = boundedLatestMonthKey.split("-").map((v) => Number(v));
    const monthsSpan = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
    current = monthSequence(ytdStart, monthsSpan);
  } else {
    const months = PERIOD_RANGE_OPTIONS.find((option) => option.id === periodRange)?.months ?? 12;
    const rangeStartKey = shiftMonthKey(boundedLatestMonthKey, -(months - 1));
    current = monthSequence(rangeStartKey, months);
  }

  const span = current.length;
  const rangeStartKey = current[0] ?? boundedLatestMonthKey;
  const priorStartKey = shiftMonthKey(rangeStartKey, -span);
  return { current, prior: monthSequence(priorStartKey, span) };
}

function periodRangeLabel(periodRange: PeriodRangeId): string {
  return PERIOD_RANGE_OPTIONS.find((option) => option.id === periodRange)?.label ?? "selected period";
}

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthSequence(startKey: string, months: number): string[] {
  return Array.from({ length: months }, (_, i) => shiftMonthKey(startKey, i));
}

type TrajectorySegment = "publications" | "grants" | "news" | "other";

type TrajectoryDrillDown =
  | { kind: "month"; monthKey: string }
  | { kind: "source"; source: SignalSource; scope: "trajectory" | "all" };

function activitySeriesTotal(row: Investigator["activitySeries"][number]): number {
  return row.publications + row.grants + row.news + row.other;
}

const TRAJECTORY_BAR_COLORS: Record<TrajectorySegment, string> = {
  publications: "#0e7490",
  grants: "#2563eb",
  news: "#8b5cf6",
  other: "#94a3b8",
};

function trajectorySegmentFromItem(item: PortfolioSignalItem): TrajectorySegment {
  if (item.category === "paper" || item.source_type === "pubmed") return "publications";
  if (item.category === "funding" || item.source_type === "reporter") return "grants";
  if (item.category === "media" || item.source_type === "web") return "news";
  return "other";
}

function buildTrajectoryActivitySeries(
  items: PortfolioSignalItem[],
  monthKeys: string[]
): Investigator["activitySeries"] {
  const byMonth = new Map<string, { publications: number; grants: number; news: number; other: number }>();
  for (const key of monthKeys) byMonth.set(key, { publications: 0, grants: 0, news: 0, other: 0 });
  for (const item of items) {
    const bucket = byMonth.get(item.monthKey);
    if (!bucket) continue;
    bucket[trajectorySegmentFromItem(item)] += 1;
  }
  return monthKeys.map((key) => {
    const [y, m] = key.split("-");
    const month = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    const row = byMonth.get(key) ?? { publications: 0, grants: 0, news: 0, other: 0 };
    return { month, monthKey: key, ...row };
  });
}

function monthLabelFromKey(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function dateText(iso: string | null): string {
  if (!iso) return "Date unavailable";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isContinuingGrantSignal(item: PortfolioSignalItem): boolean {
  if (sourceFromItem(item) !== "grants") return false;
  return grantTimelineSegmentFromItem(item) === "continuing_grants";
}

function fundingLabelFromSignal(item: PortfolioSignalItem): string {
  const projectNum = (item.nih_project_num ?? "").toUpperCase();
  if (/R01/.test(projectNum)) return "R01";
  if (/R21/.test(projectNum)) return "R21";
  if (/P01/.test(projectNum)) return "P01 / Program";
  if (/\bU\d{2}\b/.test(projectNum)) return "U Mechanism";
  if (/F\d{2}|K\d{2}|T\d{2}/.test(projectNum)) return "Career/Training";
  return "Other";
}

function portfolioItemToAnalyticsRow(item: PortfolioSignalItem): CommunitySourceItemRow {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    source_type: item.source_type,
    status: null,
    published_at: item.occurredAt,
    found_at: null,
    raw_summary: item.rawSummary ?? null,
    nih_project_num: item.nih_project_num,
    source_domain: item.sourceDomain ?? null,
    source_url: item.sourceUrl ?? null,
  };
}

function countTopSignalLabels(
  items: PortfolioSignalItem[],
  labelForItem: (item: PortfolioSignalItem) => string | null,
  limit?: number
) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = labelForItem(item);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const sliced = limit === undefined ? ranked : ranked.slice(0, limit);
  return sliced.map(([label, count]) => ({ label, count }));
}

function PeriodRangeToggle({
  value,
  onChange,
}: {
  value: PeriodRangeId;
  onChange: (value: PeriodRangeId) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--fo-ink-muted)]">
        Time period
      </span>
      <div className="flex flex-1 flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-1">
        {PERIOD_RANGE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`min-w-[3.25rem] flex-1 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:flex-none sm:px-3 ${
              value === option.id
                ? "bg-[var(--fo-interaction)] text-white shadow-sm"
                : "text-[var(--fo-ink-muted)] hover:bg-[var(--card)] hover:text-[var(--fo-title)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SegmentedViewToggle({
  value,
  onChange,
}: {
  value: PortfolioViewMode;
  onChange: (value: PortfolioViewMode) => void;
}) {
  const options: Array<{ id: PortfolioViewMode; label: string }> = [
    { id: "community", label: "Community View" },
    { id: "investigator", label: "Investigator View" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === option.id
              ? "bg-[var(--fo-interaction)] text-white shadow-sm"
              : "text-[var(--fo-ink-muted)] hover:bg-[var(--card)] hover:text-[var(--fo-title)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SignalSourceChips({
  active,
  onToggle,
}: {
  active: SignalSource[];
  onToggle: (source: SignalSource) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(sourceChipLabels) as SignalSource[]).map((source) => {
        const isActive = active.includes(source);
        return (
          <button
            key={source}
            type="button"
            onClick={() => onToggle(source)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "border-[var(--fo-interaction)] bg-[var(--fo-select-tint)] text-[var(--fo-title)]"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--fo-ink-muted)] hover:bg-[var(--fo-paper-2)]"
            }`}
          >
            {sourceChipLabels[source]}
          </button>
        );
      })}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  comparison,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  comparison: string;
  tone: "positive" | "neutral";
}) {
  return (
    <div className="app-surface-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-ink-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--fo-title)]">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
            tone === "positive"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-[var(--fo-paper-2)] text-[var(--fo-ink-muted)]"
          }`}
        >
          {delta}
        </span>
        <span className="text-xs text-[var(--fo-ink-muted)]">{comparison}</span>
      </div>
    </div>
  );
}

export function ResearchThemesCard({
  themeDistribution,
}: {
  themeDistribution: PortfolioIntelligenceDataBundle["themeDistribution"];
}) {
  return (
    <Card>
      <CardHeader title="Research Themes (by signal volume)" action={<button className="text-xs font-medium text-[var(--fo-interaction)]">View all</button>} />
      <CardBody>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {themeDistribution.map((theme) => (
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

export function SignalActivityChartCard({
  signalActivitySeries,
  description,
}: {
  signalActivitySeries: PortfolioIntelligenceDataBundle["signalActivitySeries"];
  description: string;
}) {
  return (
    <Card>
      <CardHeader title="Signal Activity Over Time" description={description} />
      <CardBody>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={signalActivitySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="thisPeriod" name="This period" stroke="#0e6b78" strokeWidth={2.4} dot={false} />
              <Line type="monotone" dataKey="priorPeriod" name="Prior period" stroke="#94a3b8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

export function FundingMechanismCard({
  fundingMechanismMix,
}: {
  fundingMechanismMix: PortfolioIntelligenceDataBundle["fundingMechanismMix"];
}) {
  return (
    <Card>
      <CardHeader title="Funding Mechanism Mix" />
      <CardBody>
        <div className="grid grid-cols-[160px,1fr] items-center gap-2">
          <div className="h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fundingMechanismMix} dataKey="percentage" nameKey="label" innerRadius={46} outerRadius={72} strokeWidth={0}>
                  {fundingMechanismMix.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-xs">
            {fundingMechanismMix.map((slice) => (
              <li key={slice.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[var(--fo-ink-body)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  {slice.label}
                </span>
                <span className="font-semibold text-[var(--fo-title)]">{slice.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

export function CollaborationNetworkCard() {
  const nodes = [
    { id: "a", x: 30, y: 38, tone: "strong" },
    { id: "b", x: 64, y: 24, tone: "moderate" },
    { id: "c", x: 92, y: 44, tone: "emerging" },
    { id: "d", x: 74, y: 74, tone: "moderate" },
    { id: "e", x: 40, y: 76, tone: "strong" },
    { id: "f", x: 18, y: 62, tone: "emerging" },
  ] as const;
  const links = [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["d", "e"],
    ["e", "f"],
    ["f", "a"],
    ["a", "d"],
    ["b", "e"],
  ] as const;
  const toneColor: Record<string, string> = {
    strong: "#0e7490",
    moderate: "#6366f1",
    emerging: "#94a3b8",
  };
  return (
    <Card>
      <CardHeader title="Collaboration Network" />
      <CardBody>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-3">
          <svg viewBox="0 0 110 90" className="h-40 w-full">
            {links.map(([from, to], idx) => {
              const a = nodes.find((n) => n.id === from);
              const b = nodes.find((n) => n.id === to);
              if (!a || !b) return null;
              return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#b5c1d0" strokeWidth={1.5} />;
            })}
            {nodes.map((node) => (
              <circle key={node.id} cx={node.x} cy={node.y} r={4.5} fill={toneColor[node.tone]} />
            ))}
          </svg>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--fo-ink-muted)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-700" />Strong</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />Moderate</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />Emerging</span>
            </div>
            <button className="font-medium text-[var(--fo-interaction)] hover:underline">View full network</button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function ThemeTagRow({
  topThemeTags,
}: {
  topThemeTags: string[];
}) {
  return (
    <Card>
      <CardHeader title="Top Research Themes" />
      <CardBody>
        <div className="flex flex-wrap gap-2">
          {topThemeTags.map((tag) => (
            <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--fo-paper-2)] px-3 py-1 text-xs text-[var(--fo-title)]">
              {tag}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function matchToneClasses(matchBand: MatchStrength) {
  if (matchBand === "high") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (matchBand === "medium") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function InvestigatorTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Investigator[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.name} ${row.department} ${row.keyThemes.join(" ")}`.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <Card className="h-full">
      <CardHeader
        title={`Investigators (${rows.length.toLocaleString()})`}
        action={
          <div className="w-64">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search investigators..." />
          </div>
        }
      />
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[var(--fo-paper-2)] text-xs uppercase tracking-wide text-[var(--fo-ink-muted)]">
            <tr>
              <th className="px-4 py-3"><input type="checkbox" aria-label="Select all investigators" /></th>
              <th className="px-2 py-3">Investigator</th>
              <th className="px-2 py-3">Key Themes</th>
              <th className="px-2 py-3">Recent Signals</th>
              <th className="px-2 py-3">Collaboration Index</th>
              <th className="px-2 py-3">Match Strength</th>
              <th className="px-2 py-3">Last Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const active = selectedId === row.id;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row.id)}
                  className={`cursor-pointer border-b border-[var(--border)]/60 transition-colors ${active ? "bg-cyan-50/50" : "hover:bg-[var(--fo-row-hover)]"}`}
                >
                  <td className="px-4 py-3 align-top"><input type="checkbox" checked={active} readOnly aria-label={`Select ${row.name}`} /></td>
                  <td className="px-2 py-3 align-top">
                    <div className="flex items-start gap-2">
                      {row.photoUrl ? (
                        <div
                          className="h-7 w-7 rounded-full border border-[var(--border)] bg-cover bg-center bg-no-repeat"
                          style={{ backgroundImage: `url("${row.photoUrl}")` }}
                          role="img"
                          aria-label={`${row.name} profile photo`}
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--fo-paper-2)] text-[10px] font-semibold text-[var(--fo-title)]">
                          {initials(row.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[var(--fo-title)]">{row.name}</p>
                        <p className="text-xs text-[var(--fo-ink-muted)]">{row.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {row.keyThemes.slice(0, 4).map((theme) => (
                        <span key={theme} className="rounded-md bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-xs text-[var(--fo-ink-body)]">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top font-medium text-[var(--fo-title)]">{row.recentSignals}</td>
                  <td className="px-2 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-[var(--fo-title)]">{row.collaborationIndex}</span>
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-cyan-600" style={{ width: `${row.collaborationIndex}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${matchToneClasses(row.matchBand)}`}>
                      {row.matchBand === "high" ? "High" : row.matchBand === "medium" ? "Medium" : "Low"} ({row.matchStrength}%)
                    </span>
                  </td>
                  <td className="px-2 py-3 align-top text-[var(--fo-ink-muted)]">{row.lastUpdated}</td>
                  <td className="px-4 py-3 text-right align-top text-[var(--fo-ink-muted)]">...</td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--fo-ink-muted)]">No investigators match your search.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function PortfolioActivityChart({ investigator }: { investigator: Investigator }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={investigator.activitySeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="publications" stackId="a" fill="#1f6f8a" />
          <Bar dataKey="grants" stackId="a" fill="#2d8ea4" />
          <Bar dataKey="news" stackId="a" fill="#7c3aed" />
          <Bar dataKey="other" stackId="a" fill="#94a3b8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OpportunityMatchList({ matches }: { matches: FundingOpportunityMatch[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-[var(--fo-ink-muted)]">No matched opportunities yet.</p>;
  }
  return (
    <div className="space-y-3">
      {matches.map((match) => (
        <div key={match.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--fo-title)]">{match.title}</p>
              <p className="mt-0.5 text-xs text-[var(--fo-ink-muted)]">
                {match.agency} · Opportunity ID: {match.opportunityId}
              </p>
              {match.area ? <p className="mt-0.5 text-xs text-[var(--fo-ink-muted)]">Area: {match.area}</p> : null}
              <p className="mt-0.5 text-xs text-[var(--fo-ink-muted)]">LOI: {match.loi}</p>
            </div>
            <Badge tone={match.badge === "High Match" ? "success" : "warning"}>{match.badge}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InvestigatorDetailPanel({
  investigator,
  matches,
  consultationSummary,
}: {
  investigator: Investigator;
  matches: FundingOpportunityMatch[];
  consultationSummary: string;
}) {
  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      <Card>
        <CardBody className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-[var(--fo-title)]">{investigator.name}</p>
            <p className="text-sm text-[var(--fo-ink-muted)]">{investigator.title}</p>
            <p className="text-xs text-[var(--fo-ink-muted)]">{investigator.affiliation}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {investigator.keyThemes.map((tag) => (
              <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--fo-paper-2)] px-2.5 py-1 text-xs text-[var(--fo-title)]">
                {tag}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-xs text-[var(--fo-ink-muted)]">Publications</p><p className="text-sm font-semibold">{investigator.portfolioStats.publications}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-xs text-[var(--fo-ink-muted)]">Grants</p><p className="text-sm font-semibold">{investigator.portfolioStats.grants}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-xs text-[var(--fo-ink-muted)]">News</p><p className="text-sm font-semibold">{investigator.portfolioStats.news}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-xs text-[var(--fo-ink-muted)]">Honors</p><p className="text-sm font-semibold">{investigator.portfolioStats.honors}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-xs text-[var(--fo-ink-muted)]">Trials</p><p className="text-sm font-semibold">{investigator.portfolioStats.trials}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-2"><p className="text-xs text-[var(--fo-ink-muted)]">Social</p><p className="text-sm font-semibold">{investigator.portfolioStats.social}</p></div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Portfolio Activity (last 12 months)" />
        <CardBody><PortfolioActivityChart investigator={investigator} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Prospera AI Insight" />
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--fo-ink-body)]">
            Recent work and signal patterns indicate strong fit for investigator-initiated funding opportunities in the highlighted themes.
          </p>
          <Button variant="secondary" className="w-full">View AI Analysis</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Potential opportunities for this profile" action={<button className="text-xs font-medium text-[var(--fo-interaction)]">View all (13)</button>} />
        <CardBody><OpportunityMatchList matches={matches} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Consultation Prep Summary" />
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--fo-ink-body)]">{consultationSummary}</p>
          <Button className="w-full">Add to Consultation Brief</Button>
        </CardBody>
      </Card>
    </div>
  );
}

type InvestigatorBrowserSort =
  | "best-fit"
  | "recent-activity"
  | "collaboration-index"
  | "most-signals"
  | "alphabetical";

type InvestigatorBrowserFilter =
  | "high-match"
  | "recently-active"
  | "new-grant"
  | "clinical-trials"
  | "early-stage"
  | "senior-pi";

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

function signalInsight(item: PortfolioSignalItem): string {
  const source = sourceFromItem(item);
  if (source === "publications") return "Supports a strong theme in mechanistic and translational research.";
  if (source === "grants") return "Active funding signal aligned with current research direction.";
  if (source === "clinical_trials") return "Indicates translational and patient-facing momentum.";
  if (source === "honors") return "External recognition can strengthen competitiveness in reviews.";
  if (source === "news") return "Raises visibility and potential partner discovery.";
  return "Useful for understanding broader engagement and collaboration context.";
}

function momentumLabelFromActivitySeries(
  activitySeries: Investigator["activitySeries"]
): "Strong" | "Moderate" | "Emerging" {
  const split = Math.floor(activitySeries.length / 2);
  const last = activitySeries.slice(split);
  const prior = activitySeries.slice(0, split);
  const sum = (rows: Investigator["activitySeries"]) =>
    rows.reduce((acc, row) => acc + row.publications + row.grants + row.news + row.other, 0);
  const recentTotal = sum(last);
  const priorTotal = Math.max(1, sum(prior));
  const pct = ((recentTotal - priorTotal) / priorTotal) * 100;
  if (pct >= 20) return "Strong";
  if (pct >= 5) return "Moderate";
  return "Emerging";
}

function inferMechanism(match: FundingOpportunityMatch): string {
  const raw = `${match.title} ${match.opportunityId}`.toUpperCase();
  if (raw.includes("R01")) return "R01";
  if (raw.includes("U01")) return "U01";
  if (raw.includes("R21")) return "R21";
  if (raw.includes("P01")) return "P01";
  return match.mechanism ?? "Foundation award";
}

function fallbackThemesFromSignals(
  investigator: Investigator,
  items: PortfolioSignalItem[]
): InvestigatorTheme[] {
  const sourceCounts = new Map<SignalSource, number>();
  for (const item of items) {
    const source = sourceFromItem(item);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const sortedSources = (Array.from(sourceCounts.entries()) as Array<[SignalSource, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const sourceThemeNames: Record<SignalSource, string> = {
    publications: "Publication Momentum",
    grants: "Funding Activity",
    news: "External Visibility",
    honors: "Recognition and Awards",
    clinical_trials: "Clinical Translation",
    patents: "Innovation and IP",
    social: "Community Engagement",
  };
  const generated = sortedSources.map(([source, count], index) => ({
    id: `${investigator.id}-${source}`,
    name: sourceThemeNames[source],
    signalCount: count,
    trend: index === 0 ? "rising" as const : index < 3 ? "steady" as const : "emerging" as const,
    weight: Math.max(1, 5 - index),
  }));
  if (generated.length > 0) return generated;
  const baseThemes = [investigator.department, "Portfolio Development", "Funding Strategy"]
    .filter(Boolean)
    .slice(0, 3);
  return baseThemes.map((theme, index) => ({
    id: `${investigator.id}-baseline-${index}`,
    name: theme,
    signalCount: Math.max(1, investigator.recentSignals - index),
    trend: index === 0 ? "steady" : "emerging",
    weight: Math.max(1, 3 - index),
  }));
}

function fallbackFundingMatches(investigator: Investigator): InvestigatorFundingMatch[] {
  if (investigator.name.toLowerCase().includes("alexander marson")) {
    return [
      {
        id: "nih-r01-immune-reg",
        title: "NIH R01 - Immune Regulation and T Cell Function",
        agency: "NIH / NIAID",
        mechanism: "R01",
        dueDate: "Jun 5, 2026",
        matchScore: 82,
        whyMatch: "Aligns with T cell regulation, immune function, and mechanistic immunology.",
      },
      {
        id: "nih-u01-cell-therapy",
        title: "NIH U01 - Engineering Immune Cell Therapies",
        agency: "NIH",
        mechanism: "U01",
        dueDate: "Jul 12, 2026",
        matchScore: 78,
        whyMatch: "Fits engineered T cell systems and translational cell therapy themes.",
      },
      {
        id: "jdrf-immune-mech",
        title: "JDRF - Immune Mechanisms in Type 1 Diabetes",
        agency: "Foundation",
        mechanism: "Foundation award",
        dueDate: "LOI: May 28, 2026",
        matchScore: 74,
        whyMatch: "Relevant to Treg identity, immune tolerance, and autoimmunity.",
      },
      {
        id: "czi-single-cell",
        title: "Chan Zuckerberg Initiative - Single Cell Biology",
        agency: "Foundation",
        mechanism: "Collaborative award",
        dueDate: "Aug 1, 2026",
        matchScore: 69,
        whyMatch: "Fits perturbation screens, immune cell states, and single-cell analysis.",
      },
    ];
  }
  return [
    {
      id: `${investigator.id}-default-1`,
      title: "NIH R01 - Translational Mechanisms in Human Disease",
      agency: "NIH",
      mechanism: "R01",
      dueDate: "Jul 20, 2026",
      matchScore: Math.max(60, Math.min(90, investigator.matchStrength)),
      whyMatch: `Aligned with ${investigator.keyThemes.slice(0, 2).join(" and ")} research priorities.`,
    },
    {
      id: `${investigator.id}-default-2`,
      title: "Foundation Collaborative Award - Emerging Investigator Partnerships",
      agency: "Foundation",
      mechanism: "Collaborative award",
      dueDate: "Sep 2, 2026",
      matchScore: Math.max(54, Math.min(82, investigator.matchStrength - 8)),
      whyMatch: "Supports multi-investigator coordination and near-term translational framing.",
    },
  ];
}

function normalizeFundingMatches(
  investigator: Investigator,
  matches: FundingOpportunityMatch[]
): InvestigatorFundingMatch[] {
  if (matches.length === 0) return fallbackFundingMatches(investigator);
  return matches.map((match, index) => ({
    id: match.id,
    title: match.title,
    agency: match.agency,
    mechanism: inferMechanism(match),
    dueDate: match.dueDate ?? match.loi,
    matchScore:
      match.matchScore ??
      Math.max(55, Math.min(95, (match.badge === "High Match" ? 80 : 68) + Math.max(0, 8 - index * 3))),
    whyMatch:
      match.whyMatch ??
      (match.area
        ? `Relevant to ${match.area.toLowerCase()} and current investigator portfolio signals.`
        : `Aligns with ${investigator.keyThemes.slice(0, 2).join(" and ")} priorities.`),
  }));
}

function buildCollaborators(investigator: Investigator): Collaborator[] {
  return [
    {
      id: `${investigator.id}-collab-1`,
      name: "Nina Patel, PhD",
      affiliation: "UCSF",
      relationship: "co-author",
      sharedSignals: 18,
    },
    {
      id: `${investigator.id}-collab-2`,
      name: "David Kim, MD",
      affiliation: "UCSF Medical Center",
      relationship: "clinical-partner",
      sharedSignals: 9,
    },
    {
      id: `${investigator.id}-collab-3`,
      name: "Rachel Nguyen, PhD",
      affiliation: "Gladstone Institutes",
      relationship: "co-investigator",
      sharedSignals: 7,
    },
    {
      id: `${investigator.id}-collab-4`,
      name: "Maya Thompson, MD, PhD",
      affiliation: "Stanford",
      relationship: "potential",
      sharedSignals: 3,
    },
  ];
}

function sourceBadgeTone(source: SignalSource): "success" | "warning" | "neutral" {
  if (source === "grants" || source === "clinical_trials") return "success";
  if (source === "honors" || source === "news") return "warning";
  return "neutral";
}

function InvestigatorBrowserCard({
  investigator,
  selected,
  onSelect,
}: {
  investigator: Investigator;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        selected
          ? "border-cyan-300 bg-cyan-50/70 shadow-sm ring-1 ring-cyan-200"
          : "border-[var(--border)] bg-[var(--card)] hover:border-cyan-200 hover:bg-cyan-50/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <InvestigatorAvatar
          name={investigator.name}
          photoUrl={investigator.photoUrl}
          sizeClassName="h-9 w-9"
          textClassName="text-xs"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--fo-title)]">{investigator.name}</p>
          <p className="truncate text-xs text-[var(--fo-ink-muted)]">{investigator.department}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          {investigator.matchStrength}%
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {investigator.keyThemes.slice(0, 3).map((theme) => (
          <span key={theme} className="rounded-md bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-[11px] text-[var(--fo-ink-body)]">
            {theme}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--fo-ink-muted)]">
        <span>{investigator.recentSignals} recent signals</span>
        <span>{investigator.lastUpdated}</span>
      </div>
    </button>
  );
}

function InvestigatorBrowser({
  investigators,
  selectedId,
  onSelect,
  globalQuery,
}: {
  investigators: Investigator[];
  selectedId: string;
  onSelect: (id: string) => void;
  globalQuery: string;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<InvestigatorBrowserSort>("best-fit");
  const [filters, setFilters] = useState<InvestigatorBrowserFilter[]>([]);
  const toggleFilter = (filter: InvestigatorBrowserFilter) => {
    setFilters((prev) =>
      prev.includes(filter) ? prev.filter((item) => item !== filter) : [...prev, filter]
    );
  };

  const filtered = useMemo(() => {
    const query = `${globalQuery} ${search}`.trim().toLowerCase();
    let rows = investigators.filter((inv) => {
      if (!query) return true;
      return `${inv.name} ${inv.department} ${inv.affiliation} ${inv.keyThemes.join(" ")}`
        .toLowerCase()
        .includes(query);
    });
    if (filters.length > 0) {
      rows = rows.filter((inv) =>
        filters.every((filter) => {
          if (filter === "high-match") return inv.matchStrength >= 75;
          if (filter === "recently-active") return inv.recentSignals >= 10;
          if (filter === "new-grant") return inv.portfolioStats.grants > 0;
          if (filter === "clinical-trials") return inv.portfolioStats.trials > 0;
          if (filter === "early-stage") return inv.title.toLowerCase().includes("assistant");
          if (filter === "senior-pi") return inv.title.toLowerCase().includes("professor");
          return true;
        })
      );
    }
    const sorter = [...rows];
    if (sort === "alphabetical") sorter.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "best-fit") sorter.sort((a, b) => b.matchStrength - a.matchStrength);
    if (sort === "recent-activity") sorter.sort((a, b) => b.recentSignals - a.recentSignals);
    if (sort === "collaboration-index") sorter.sort((a, b) => b.collaborationIndex - a.collaborationIndex);
    if (sort === "most-signals") {
      sorter.sort(
        (a, b) =>
          b.portfolioStats.publications + b.portfolioStats.grants - (a.portfolioStats.publications + a.portfolioStats.grants)
      );
    }
    return sorter;
  }, [filters, globalQuery, investigators, search, sort]);

  const filterLabel: Record<InvestigatorBrowserFilter, string> = {
    "high-match": "High match",
    "recently-active": "Recently active",
    "new-grant": "New grant",
    "clinical-trials": "Clinical trials",
    "early-stage": "Early-stage",
    "senior-pi": "Senior PI",
  };

  return (
    <Card className="h-full">
      <CardHeader title="Investigators" description={`${filtered.length} visible`} />
      <CardBody className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search investigators..."
        />
        <Select value={sort} onChange={(e) => setSort(e.target.value as InvestigatorBrowserSort)}>
          <option value="best-fit">Best funding fit</option>
          <option value="recent-activity">Most recent activity</option>
          <option value="collaboration-index">Highest collaboration index</option>
          <option value="most-signals">Most signals</option>
          <option value="alphabetical">Alphabetical</option>
        </Select>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(filterLabel) as InvestigatorBrowserFilter[]).map((filter) => {
            const active = filters.includes(filter);
            return (
              <button
                key={filter}
                type="button"
                onClick={() => toggleFilter(filter)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  active
                    ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--fo-ink-muted)]"
                }`}
              >
                {filterLabel[filter]}
              </button>
            );
          })}
        </div>
        <div className="max-h-[calc(100vh-22rem)] space-y-2 overflow-y-auto pr-1">
          {filtered.map((inv) => (
            <InvestigatorBrowserCard
              key={inv.id}
              investigator={inv}
              selected={inv.id === selectedId}
              onSelect={() => onSelect(inv.id)}
            />
          ))}
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--fo-ink-muted)]">
              No investigators match your current search and filters.
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

const PORTFOLIO_STAT_SOURCES = [
  { label: "Publications", source: "publications" },
  { label: "Grants", source: "grants" },
  { label: "News", source: "news" },
  { label: "Honors", source: "honors" },
  { label: "Trials", source: "clinical_trials" },
  { label: "Social", source: "social" },
] as const satisfies ReadonlyArray<{ label: string; source: SignalSource }>;

function portfolioStatDisplay(
  stats: Investigator["portfolioStats"],
  source: (typeof PORTFOLIO_STAT_SOURCES)[number]["source"]
): string | number {
  if (source === "social") return stats.social;
  if (source === "clinical_trials") return stats.trials;
  return stats[source];
}

function InvestigatorHeroCard({
  investigator,
  identity,
  trajectoryItems,
  periodLabel,
  onPortfolioStatClick,
}: {
  investigator: Investigator;
  identity: string;
  trajectoryItems?: PortfolioSignalItem[];
  periodLabel?: string;
  onPortfolioStatClick?: (source: SignalSource) => void;
}) {
  const scopedStats = trajectoryItems
    ? PORTFOLIO_STAT_SOURCES.map(({ label, source }) => ({
        label,
        source,
        count: trajectoryItems.filter((item) => sourceFromItem(item) === source).length,
      }))
    : null;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <InvestigatorAvatar
              name={investigator.name}
              photoUrl={investigator.photoUrl}
              sizeClassName="h-12 w-12"
              textClassName="text-sm"
            />
            <div>
              <h2 className="text-xl font-semibold text-[var(--fo-title)]">{investigator.name}</h2>
              <p className="text-sm text-[var(--fo-ink-body)]">{investigator.title}</p>
              <p className="text-sm text-[var(--fo-ink-muted)]">{investigator.affiliation}</p>
            </div>
          </div>
          <div className="text-right text-xs text-[var(--fo-ink-muted)]">
            <p>Last updated</p>
            <p className="font-medium text-[var(--fo-title)]">{investigator.lastUpdated}</p>
          </div>
        </div>
        <p className="text-sm text-[var(--fo-ink-body)]">{identity}</p>
        <div className="flex flex-wrap gap-2">
          {investigator.keyThemes.slice(0, 6).map((theme) => (
            <span key={theme} className="rounded-full border border-[var(--border)] bg-[var(--fo-paper-2)] px-2.5 py-1 text-xs text-[var(--fo-title)]">
              {theme}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
          {scopedStats
            ? scopedStats.map((stat) => (
                <button
                  key={stat.source}
                  type="button"
                  onClick={() => onPortfolioStatClick?.(stat.source)}
                  disabled={!onPortfolioStatClick}
                  className={`rounded-lg border border-[var(--border)] p-2 text-left transition-colors ${
                    onPortfolioStatClick
                      ? "cursor-pointer hover:border-cyan-300 hover:bg-cyan-50/40"
                      : ""
                  }`}
                >
                  <p className="text-xs text-[var(--fo-ink-muted)]">{stat.label}</p>
                  <p className="font-semibold">{stat.count}</p>
                  <p className="text-[10px] text-[var(--fo-ink-muted)]">{periodLabel ?? "Selected period"}</p>
                </button>
              ))
            : PORTFOLIO_STAT_SOURCES.map((stat) => (
                <div key={stat.source} className="rounded-lg border border-[var(--border)] p-2">
                  <p className="text-xs text-[var(--fo-ink-muted)]">{stat.label}</p>
                  <p className="font-semibold">
                    {portfolioStatDisplay(investigator.portfolioStats, stat.source)}
                  </p>
                </div>
              ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>Generate Briefing</Button>
          <Button variant="secondary">Find Opportunities</Button>
          <Button variant="ghost">View Full Profile</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function InvestigatorMetricCards({ metrics }: { metrics: InvestigatorMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.id} className="app-surface-card px-4 py-3">
          <p className="text-xs text-[var(--fo-ink-muted)]">{metric.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--fo-title)]">{metric.value}</p>
          <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">{metric.subtext}</p>
        </div>
      ))}
    </div>
  );
}

function trajectoryDrillDownTitle(drillDown: TrajectoryDrillDown, periodLabel: string): string {
  if (drillDown.kind === "month") {
    return `${monthLabelFromKey(drillDown.monthKey)} · All signals`;
  }
  const scopeLabel = drillDown.scope === "trajectory" ? periodLabel : "Selected period";
  return `${scopeLabel} · ${groupTitleFromSource(drillDown.source)}`;
}

function resolveTrajectoryMonthKey(
  activitySeries: Investigator["activitySeries"],
  state: MouseHandlerDataParam
): string | null {
  const rawIndex = state.activeTooltipIndex ?? state.activeIndex;
  const index = typeof rawIndex === "number" ? rawIndex : undefined;
  if (typeof index === "number" && index >= 0 && activitySeries[index]) {
    return activitySeries[index]!.monthKey;
  }
  if (state.activeLabel != null) {
    const label = String(state.activeLabel);
    const row = activitySeries.find((point) => point.month === label);
    if (row) return row.monthKey;
  }
  return null;
}

function SignalSourceRow({ signal }: { signal: PortfolioSignalItem }) {
  const source = sourceFromItem(signal);
  const sourceUrl = resolveSignalSourceUrl(signal);
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Badge tone={sourceBadgeTone(source)}>{groupTitleFromSource(source)}</Badge>
        <div className="flex items-center gap-2 text-xs text-[var(--fo-ink-muted)]">
          <span>{dateText(signal.occurredAt)}</span>
          {sourceUrl ? (
            <span className="font-medium text-[var(--fo-interaction)]" aria-hidden="true">
              ↗
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--fo-title)]">{signal.title}</p>
      <p className="mt-1 text-xs text-[var(--fo-ink-body)]">{signalInsight(signal)}</p>
      {sourceUrl ? (
        <p className="mt-2 text-xs font-medium text-[var(--fo-interaction)]">Open source in new tab</p>
      ) : (
        <p className="mt-2 text-xs text-[var(--fo-ink-muted)]">Source link unavailable</p>
      )}
    </>
  );

  if (!sourceUrl) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">{content}</div>
    );
  }

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-cyan-300 hover:bg-cyan-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-interaction)]"
    >
      {content}
    </a>
  );
}

function ResearchTrajectoryCard({
  activitySeries,
  items,
  caption,
  periodLabel,
  drillDown,
  onDrillDownChange,
}: {
  activitySeries: Investigator["activitySeries"];
  items: PortfolioSignalItem[];
  caption: string;
  periodLabel: string;
  drillDown: TrajectoryDrillDown | null;
  onDrillDownChange: (next: TrajectoryDrillDown | null) => void;
}) {
  const selectMonth = (monthKey: string | null | undefined) => {
    if (!monthKey) return;
    const row = activitySeries.find((point) => point.monthKey === monthKey);
    if (!row || activitySeriesTotal(row) <= 0) return;
    onDrillDownChange({ kind: "month", monthKey });
  };

  const handleChartClick = (state: MouseHandlerDataParam) => {
    selectMonth(resolveTrajectoryMonthKey(activitySeries, state));
  };

  const handleBarClick = (barData: { payload?: Investigator["activitySeries"][number] }) => {
    selectMonth(barData.payload?.monthKey);
  };

  const drillDownItems = useMemo(() => {
    if (!drillDown) return [];
    const filtered =
      drillDown.kind === "month"
        ? items.filter((item) => item.monthKey === drillDown.monthKey)
        : drillDown.scope === "trajectory"
          ? items.filter((item) => sourceFromItem(item) === drillDown.source)
          : items.filter((item) => sourceFromItem(item) === drillDown.source);
    return [...filtered].sort((a, b) => {
      const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return tb - ta;
    });
  }, [drillDown, items]);

  const expectedCount =
    drillDown?.kind === "month"
      ? (activitySeries.find((row) => row.monthKey === drillDown.monthKey)
          ? activitySeriesTotal(
              activitySeries.find((row) => row.monthKey === drillDown.monthKey)!
            )
          : 0)
      : drillDownItems.length;

  return (
    <Card>
      <CardHeader
        title="Research Trajectory"
        description={`Click a month column to list signals (${periodLabel.toLowerCase()}, current source filters)`}
      />
      <CardBody className="space-y-3">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={activitySeries}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              onClick={handleChartClick}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              {(Object.keys(TRAJECTORY_BAR_COLORS) as TrajectorySegment[]).map((segment) => (
                <Bar
                  key={segment}
                  dataKey={segment}
                  stackId="a"
                  fill={TRAJECTORY_BAR_COLORS[segment]}
                  cursor="pointer"
                  onClick={handleBarClick}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-[var(--fo-ink-body)]">{caption}</p>
        {drillDown ? (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/30 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--fo-title)]">
                {trajectoryDrillDownTitle(drillDown, periodLabel)} ({drillDownItems.length})
              </p>
              <button
                type="button"
                onClick={() => onDrillDownChange(null)}
                className="text-xs font-medium text-[var(--fo-interaction)] hover:underline"
              >
                Clear
              </button>
            </div>
            {drillDownItems.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {drillDownItems.map((signal) => (
                  <SignalSourceRow key={signal.id} signal={signal} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--fo-ink-muted)]">
                {expectedCount > 0
                  ? "No matching signals in the current filter scope. Try enabling more source types or widening filters."
                  : "No signals for this month."}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--fo-ink-muted)]">
            Tip: click any month column or a portfolio stat above to drill in.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function ThemeMapCard({ themes }: { themes: InvestigatorTheme[] }) {
  const max = Math.max(1, ...themes.map((theme) => theme.signalCount));
  return (
    <Card>
      <CardHeader title="Research Theme Map" description="Dominant and emerging thematic clusters" />
      <CardBody className="space-y-3">
        {themes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-sm text-[var(--fo-ink-muted)]">
            Theme signals are still loading for this investigator. Try widening the time range or enabling more source filters.
          </div>
        ) : (
          themes.map((theme) => (
            <div key={theme.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--fo-title)]">{theme.name}</span>
                <span className="text-xs text-[var(--fo-ink-muted)]">
                  {theme.signalCount} signals · {theme.trend}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-indigo-500"
                  style={{ width: `${Math.max(10, Math.round((theme.signalCount / max) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function SignalTimelineCard({
  items,
  periodLabel,
}: {
  items: PortfolioSignalItem[];
  periodLabel: string;
}) {
  const [tab, setTab] = useState<"all" | SignalSource>("all");
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return tb - ta;
    });
    const scoped = tab === "all" ? sorted : sorted.filter((item) => sourceFromItem(item) === tab);
    return expanded ? scoped : scoped.slice(0, 8);
  }, [expanded, items, tab]);

  const tabs: Array<{ id: "all" | SignalSource; label: string }> = [
    { id: "all", label: "All" },
    { id: "publications", label: "Publications" },
    { id: "grants", label: "Grants" },
    { id: "news", label: "News" },
    { id: "honors", label: "Honors" },
    { id: "clinical_trials", label: "Trials" },
    { id: "social", label: "Social" },
  ];

  return (
    <Card>
      <CardHeader
        title="Signal Timeline"
        description={`Signals in ${periodLabel.toLowerCase()}, grouped by type.`}
        action={
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-medium text-[var(--fo-interaction)]"
          >
            {expanded ? "Show fewer" : "Show all signals"}
          </button>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                tab === item.id
                  ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--fo-ink-muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {visible.map((signal) => (
            <SignalSourceRow key={signal.id} signal={signal} />
          ))}
          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--fo-ink-muted)]">
              No signals found for the selected filters.
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function GrantReadinessCard({
  momentum,
  investigator,
  summary,
}: {
  momentum: "Strong" | "Moderate" | "Emerging";
  investigator: Investigator;
  summary: string;
}) {
  const readiness = [
    { label: "Recent publication activity", value: momentum },
    { label: "Active funding base", value: investigator.portfolioStats.grants >= 4 ? "Moderate" : "Limited" },
    { label: "Collaboration network", value: investigator.collaborationIndex >= 75 ? "Strong" : "Moderate" },
    { label: "Translational angle", value: investigator.portfolioStats.trials > 0 ? "Emerging" : "Limited" },
    { label: "Clinical trial connection", value: investigator.portfolioStats.trials > 0 ? "Present" : "Limited" },
    { label: "Federal fit", value: investigator.matchStrength >= 75 ? "Strong" : "Possible" },
  ];
  return (
    <Card>
      <CardHeader title="Grant Readiness Snapshot" />
      <CardBody className="space-y-2">
        {readiness.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <span className="text-[var(--fo-ink-body)]">{row.label}</span>
            <span className="font-semibold text-[var(--fo-title)]">{row.value}</span>
          </div>
        ))}
        <p className="pt-1 text-sm text-[var(--fo-ink-body)]">{summary}</p>
      </CardBody>
    </Card>
  );
}

function CollaborationContextCard({ collaborators }: { collaborators: Collaborator[] }) {
  return (
    <Card>
      <CardHeader title="Collaboration / Network Context" />
      <CardBody className="space-y-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-3">
          <svg viewBox="0 0 110 90" className="h-32 w-full">
            <line x1="24" y1="45" x2="50" y2="22" stroke="#bfd2e8" strokeWidth={1.5} />
            <line x1="50" y1="22" x2="82" y2="28" stroke="#bfd2e8" strokeWidth={1.5} />
            <line x1="24" y1="45" x2="56" y2="66" stroke="#bfd2e8" strokeWidth={1.5} />
            <line x1="56" y1="66" x2="84" y2="60" stroke="#bfd2e8" strokeWidth={1.5} />
            <circle cx="24" cy="45" r="5" fill="#0e7490" />
            <circle cx="50" cy="22" r="4.5" fill="#2563eb" />
            <circle cx="82" cy="28" r="4.5" fill="#8b5cf6" />
            <circle cx="56" cy="66" r="4.5" fill="#14b8a6" />
            <circle cx="84" cy="60" r="4.5" fill="#94a3b8" />
          </svg>
        </div>
        <div className="space-y-2">
          {collaborators.slice(0, 4).map((collab) => (
            <div key={collab.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
              <p className="text-sm font-medium text-[var(--fo-title)]">{collab.name}</p>
              <p className="text-xs text-[var(--fo-ink-muted)]">
                {collab.affiliation} · {collab.relationship.replace("-", " ")} · {collab.sharedSignals} shared signals
              </p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function OpportunityMatchCard({ match }: { match: InvestigatorFundingMatch }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--fo-title)]">{match.title}</p>
          <p className="text-xs text-[var(--fo-ink-muted)]">
            {match.agency} · {match.mechanism}
          </p>
          <p className="text-xs text-[var(--fo-ink-muted)]">Due: {match.dueDate}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          {match.matchScore}%
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--fo-ink-body)]">Why: {match.whyMatch}</p>
    </div>
  );
}

function SuggestedQuestionsCard({ questions }: { questions: string[] }) {
  return (
    <Card>
      <CardHeader title="Suggested Consultation Questions" />
      <CardBody className="space-y-2">
        {questions.map((question) => (
          <p key={question} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fo-ink-body)]">
            {question}
          </p>
        ))}
      </CardBody>
    </Card>
  );
}

function BriefBuilderCard({
  addedSections,
  onToggleSection,
}: {
  addedSections: ConsultationBriefSection[];
  onToggleSection: (section: ConsultationBriefSection) => void;
}) {
  const options: Array<{ id: ConsultationBriefSection; label: string }> = [
    { id: "research-summary", label: "Research summary" },
    { id: "recent-signals", label: "Recent signals" },
    { id: "top-themes", label: "Top themes" },
    { id: "funding-matches", label: "Funding matches" },
    { id: "suggested-questions", label: "Suggested questions" },
    { id: "potential-collaborators", label: "Potential collaborators" },
  ];
  return (
    <Card>
      <CardHeader title="Brief Builder" />
      <CardBody className="space-y-2">
        {options.map((option) => {
          const checked = addedSections.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggleSection(option.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                checked
                  ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--fo-ink-body)]"
              }`}
            >
              <span>{option.label}</span>
              <span>{checked ? "Added" : "Add"}</span>
            </button>
          );
        })}
        <Button variant="secondary" className="w-full">Export Brief</Button>
      </CardBody>
    </Card>
  );
}

function ConsultationPrepPanel({
  summary,
  matches,
  questions,
  addedSections,
  onToggleSection,
}: {
  summary: string;
  matches: InvestigatorFundingMatch[];
  questions: string[];
  addedSections: ConsultationBriefSection[];
  onToggleSection: (section: ConsultationBriefSection) => void;
}) {
  const [copied, setCopied] = useState(false);
  const readinessLabel = matches[0]?.matchScore >= 75 ? "Ready for consult" : "Needs opportunity review";
  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      <Card>
        <CardHeader title="Consultation Prep" />
        <CardBody className="space-y-3">
          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {readinessLabel}
          </span>
          <p className="text-sm text-[var(--fo-ink-body)]">{summary}</p>
          <div className="grid gap-2">
            <Button onClick={() => onToggleSection("research-summary")}>Add to Consultation Brief</Button>
            <Button variant="secondary">Generate 1-page Brief</Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (typeof navigator === "undefined" || !navigator.clipboard) return;
                await navigator.clipboard.writeText(summary);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Summary copied" : "Copy Summary"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Top Opportunity Matches" />
        <CardBody className="space-y-2">
          {matches.slice(0, 5).map((match) => (
            <OpportunityMatchCard key={match.id} match={match} />
          ))}
        </CardBody>
      </Card>

      <SuggestedQuestionsCard questions={questions} />
      <BriefBuilderCard addedSections={addedSections} onToggleSection={onToggleSection} />
    </div>
  );
}

function InvestigatorViewPage({
  investigators,
  selectedInvestigator,
  onSelectInvestigator,
  signals,
  trajectoryItems,
  trajectoryActivitySeries,
  periodLabel,
  metrics,
  fundingMatches,
  consultationSummary,
  consultationQuestions,
  addedSections,
  onToggleSection,
  globalQuery,
}: {
  investigators: Investigator[];
  selectedInvestigator: Investigator | undefined;
  onSelectInvestigator: (id: string) => void;
  signals: PortfolioSignalItem[];
  trajectoryItems: PortfolioSignalItem[];
  trajectoryActivitySeries: Investigator["activitySeries"];
  periodLabel: string;
  metrics: InvestigatorMetric[];
  fundingMatches: InvestigatorFundingMatch[];
  consultationSummary: string;
  consultationQuestions: string[];
  addedSections: ConsultationBriefSection[];
  onToggleSection: (section: ConsultationBriefSection) => void;
  globalQuery: string;
}) {
  const [trajectoryDrillDown, setTrajectoryDrillDown] = useState<TrajectoryDrillDown | null>(null);

  useEffect(() => {
    setTrajectoryDrillDown(null);
  }, [selectedInvestigator?.id, trajectoryItems]);
  if (!selectedInvestigator) {
    return (
      <Card>
        <CardBody className="text-sm text-[var(--fo-ink-muted)]">
          Select an investigator to open the briefing workspace.
        </CardBody>
      </Card>
    );
  }

  const identity = selectedInvestigator.name.toLowerCase().includes("alexander marson")
    ? "Gene regulation, T cell engineering, CRISPR-based perturbation screens, and immune cell therapy."
    : `${selectedInvestigator.keyThemes.slice(0, 3).join(", ")}, and translational research development across active funding domains.`;
  const momentum = momentumLabelFromActivitySeries(trajectoryActivitySeries);
  const collaborators = buildCollaborators(selectedInvestigator);
  const themeCards: InvestigatorTheme[] = (() => {
    const fromProfile = selectedInvestigator.keyThemes.slice(0, 6).map((theme, index) => ({
      id: `${selectedInvestigator.id}-${theme.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: theme,
      signalCount: Math.max(3, Math.round(selectedInvestigator.recentSignals / (index + 2))),
      trend: index < 2 ? ("rising" as const) : index < 4 ? ("steady" as const) : ("emerging" as const),
      weight: Math.max(1, 6 - index),
    }));
    if (fromProfile.length > 0) return fromProfile;
    return fallbackThemesFromSignals(selectedInvestigator, signals);
  })();
  const trajectoryCaption = selectedInvestigator.name.toLowerCase().includes("alexander marson")
    ? "Recent activity is concentrated in publications, with sustained work in CRISPR perturbation and T cell regulation."
    : `Recent activity shows ${momentum.toLowerCase()} momentum with emphasis on ${selectedInvestigator.keyThemes.slice(0, 2).join(" and ")}.`;
  const readinessSummary = selectedInvestigator.name.toLowerCase().includes("alexander marson")
    ? "This investigator has strong recent publication momentum and a clear mechanistic research identity. Best-fit opportunities are likely to emphasize immune regulation, cell engineering, perturbation biology, and translational immunology."
    : `This investigator shows ${momentum.toLowerCase()} momentum with active themes in ${selectedInvestigator.keyThemes.slice(0, 2).join(" and ")}. Consultation should focus on near-term opportunity fit and collaborator strategy.`;

  return (
    <div className="grid gap-4 xl:grid-cols-[300px,minmax(0,1fr),360px]">
      <div>
        <InvestigatorBrowser
          investigators={investigators}
          selectedId={selectedInvestigator.id}
          onSelect={onSelectInvestigator}
          globalQuery={globalQuery}
        />
      </div>

      <div className="space-y-4">
        <InvestigatorHeroCard
          investigator={selectedInvestigator}
          identity={identity}
          trajectoryItems={trajectoryItems}
          periodLabel={periodLabel}
          onPortfolioStatClick={(source) =>
            setTrajectoryDrillDown({ kind: "source", source, scope: "trajectory" })
          }
        />
        <InvestigatorMetricCards metrics={metrics} />
        <div className="grid gap-4 2xl:grid-cols-2">
          <ResearchTrajectoryCard
            activitySeries={trajectoryActivitySeries}
            items={trajectoryItems}
            caption={trajectoryCaption}
            periodLabel={periodLabel}
            drillDown={trajectoryDrillDown}
            onDrillDownChange={setTrajectoryDrillDown}
          />
          <ThemeMapCard themes={themeCards} />
          <div className="2xl:col-span-2">
            <SignalTimelineCard items={signals} periodLabel={periodLabel} />
          </div>
          <GrantReadinessCard
            momentum={momentum}
            investigator={selectedInvestigator}
            summary={readinessSummary}
          />
          <CollaborationContextCard collaborators={collaborators} />
        </div>
      </div>

      <ConsultationPrepPanel
        summary={consultationSummary}
        matches={fundingMatches}
        questions={consultationQuestions}
        addedSections={addedSections}
        onToggleSection={onToggleSection}
      />
    </div>
  );
}


export function PortfolioIntelligencePage({
  data,
}: {
  data: PortfolioIntelligenceDataBundle;
}) {
  const [viewMode, setViewMode] = useState<PortfolioViewMode>("community");
  const [communityId, setCommunityId] = useState(data.watchedCommunities[0]?.id ?? "");
  const [periodRange, setPeriodRange] = useState<PeriodRangeId>("1y");
  const [activeSources, setActiveSources] = useState<SignalSource[]>(defaultActiveSources);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [selectedInvestigatorId, setSelectedInvestigatorId] = useState(
    data.investigators.find((inv) => inv.name.toLowerCase().includes("alexander marson"))?.id ??
      data.investigators[0]?.id ??
      ""
  );
  const [briefSections, setBriefSections] = useState<ConsultationBriefSection[]>([]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, []);
  const latestMonthKey = useMemo(() => {
    const max = data.communityItems
      .map((item) => item.monthKey)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (max) return max;
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }, [data.communityItems]);
  const boundedLatestMonthKey = latestMonthKey > currentMonthKey ? currentMonthKey : latestMonthKey;
  const allMonthKeys = useMemo(
    () => Array.from(new Set(data.communityItems.map((item) => item.monthKey).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [data.communityItems]
  );
  const { current: currentRangeMonths, prior: priorRangeMonths } = useMemo(
    () => computePeriodMonthKeys(periodRange, boundedLatestMonthKey, allMonthKeys),
    [allMonthKeys, boundedLatestMonthKey, periodRange]
  );
  const periodLabel = periodRangeLabel(periodRange);
  const currentMonthSet = useMemo(() => new Set(currentRangeMonths), [currentRangeMonths]);
  const priorMonthSet = useMemo(() => new Set(priorRangeMonths), [priorRangeMonths]);
  const previousMonthKey = shiftMonthKey(boundedLatestMonthKey, -1);

  const visibleInvestigators = useMemo(() => {
    if (!communityId || communityId === "all") return data.investigators;
    const filtered = data.investigators.filter((inv) => inv.communityId === communityId);
    return filtered.length > 0 ? filtered : data.investigators;
  }, [data.investigators, communityId]);
  const visibleIds = useMemo(() => new Set(visibleInvestigators.map((i) => i.id)), [visibleInvestigators]);

  const filteredCommunityItems = useMemo(() => {
    return data.communityItems.filter((item) => {
      const hasVisibleInvestigator =
        item.investigatorIds.length === 0 ||
        item.investigatorIds.some((id) => visibleIds.has(id));
      if (!hasVisibleInvestigator) return false;
      return currentMonthSet.has(item.monthKey);
    });
  }, [data.communityItems, visibleIds, currentMonthSet]);

  const priorCommunityItems = useMemo(() => {
    return data.communityItems.filter((item) => {
      const hasVisibleInvestigator =
        item.investigatorIds.length === 0 ||
        item.investigatorIds.some((id) => visibleIds.has(id));
      if (!hasVisibleInvestigator) return false;
      return priorMonthSet.has(item.monthKey);
    });
  }, [data.communityItems, visibleIds, priorMonthSet]);

  const scopedItemsAllTime = useMemo(
    () =>
      data.communityItems.filter((item) => {
        const hasVisibleInvestigator =
          item.investigatorIds.length === 0 ||
          item.investigatorIds.some((id) => visibleIds.has(id));
        if (!hasVisibleInvestigator) return false;
        return activeSources.includes(sourceFromItem(item));
      }),
    [data.communityItems, visibleIds, activeSources]
  );

  const sourceFilteredItems = useMemo(
    () => filteredCommunityItems.filter((item) => activeSources.includes(sourceFromItem(item))),
    [filteredCommunityItems, activeSources]
  );
  const sourceFilteredPriorItems = useMemo(
    () => priorCommunityItems.filter((item) => activeSources.includes(sourceFromItem(item))),
    [priorCommunityItems, activeSources]
  );

  const recentSignalsByInvestigator = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of scopedItemsAllTime) {
      if (!currentMonthSet.has(item.monthKey)) continue;
      for (const id of item.investigatorIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [scopedItemsAllTime, currentMonthSet]);

  const kpis = useMemo(() => {
    const monitored = visibleInvestigators.length;
    const thisMonthSignals = scopedItemsAllTime.filter((i) => i.monthKey === boundedLatestMonthKey).length;
    const previousMonthSignals = scopedItemsAllTime.filter((i) => i.monthKey === previousMonthKey).length;
    const activeInPeriod = visibleInvestigators.filter((inv) => (recentSignalsByInvestigator.get(inv.id) ?? 0) > 0).length;
    const currentFunding = sourceFilteredItems.filter(
      (i) => i.category === "funding" || i.source_type === "reporter"
    ).length;
    const priorFunding = sourceFilteredPriorItems.filter(
      (i) => i.category === "funding" || i.source_type === "reporter"
    ).length;
    const pct = (curr: number, prev: number) => {
      if (prev <= 0) return curr > 0 ? "New" : "0%";
      const val = Math.round(((curr - prev) / prev) * 100);
      return `${val >= 0 ? "+" : ""}${val}%`;
    };
    const totalSignalsInPeriod = sourceFilteredItems.length;
    const priorTotalSignalsInPeriod = sourceFilteredPriorItems.length;
    const rangeLabel = periodLabel;
    return [
      {
        id: "monitored-investigators",
        label: "Monitored Investigators",
        value: monitored.toLocaleString(),
        delta: `${activeInPeriod.toLocaleString()} active`,
        comparison: `with signals in ${rangeLabel.toLowerCase()}`,
        tone: "positive" as const,
      },
      {
        id: "signals-in-period",
        label: "Signals in selected period",
        value: totalSignalsInPeriod.toLocaleString(),
        delta: pct(totalSignalsInPeriod, priorTotalSignalsInPeriod),
        comparison: `vs prior ${rangeLabel.toLowerCase()}`,
        tone: "positive" as const,
      },
      {
        id: "new-signals",
        label: "New Signals This Month",
        value: thisMonthSignals.toLocaleString(),
        delta: pct(thisMonthSignals, previousMonthSignals),
        comparison: "vs previous month",
        tone: "positive" as const,
      },
      {
        id: "active-funding-matches",
        label: "Active Funding Matches",
        value: currentFunding.toLocaleString(),
        delta: pct(currentFunding, priorFunding),
        comparison: "funding signals in selected period",
        tone: "positive" as const,
      },
    ];
  }, [
    boundedLatestMonthKey,
    previousMonthKey,
    recentSignalsByInvestigator,
    periodLabel,
    scopedItemsAllTime,
    sourceFilteredItems,
    sourceFilteredPriorItems,
    visibleInvestigators,
  ]);

  const investigatorsForTable = useMemo(
    () =>
      visibleInvestigators.map((inv) => ({
        ...inv,
        recentSignals: recentSignalsByInvestigator.get(inv.id) ?? 0,
      })),
    [recentSignalsByInvestigator, visibleInvestigators]
  );

  useEffect(() => {
    if (!investigatorsForTable.some((inv) => inv.id === selectedInvestigatorId)) {
      setSelectedInvestigatorId(investigatorsForTable[0]?.id ?? "");
    }
  }, [investigatorsForTable, selectedInvestigatorId]);

  const selectedInvestigator = useMemo(
    () =>
      investigatorsForTable.find((inv) => inv.id === selectedInvestigatorId) ??
      investigatorsForTable[0],
    [selectedInvestigatorId, investigatorsForTable]
  );
  const selectedMatches = useMemo(
    () =>
      selectedInvestigator
        ? (data.opportunityMatchesByInvestigator[selectedInvestigator.id] ?? [])
        : [],
    [selectedInvestigator, data.opportunityMatchesByInvestigator]
  );
  const selectedConsultationSummary =
    selectedInvestigator &&
    data.consultationPrepByInvestigator[selectedInvestigator.id]?.summary
      ? data.consultationPrepByInvestigator[selectedInvestigator.id]!.summary
      : "High activity and collaboration momentum. Prioritize translational opportunities with clear investigator-role fit.";
  const selectedInvestigatorSignals = useMemo(() => {
    if (!selectedInvestigator) return [];
    return sourceFilteredItems
      .filter((item) => item.investigatorIds.includes(selectedInvestigator.id))
      .sort((a, b) => {
        const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
        const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
        return tb - ta;
      });
  }, [selectedInvestigator, sourceFilteredItems]);
  const selectedInvestigatorTrajectoryItems = selectedInvestigatorSignals;
  const selectedTrajectoryActivitySeries = useMemo(
    () => buildTrajectoryActivitySeries(selectedInvestigatorTrajectoryItems, currentRangeMonths),
    [selectedInvestigatorTrajectoryItems, currentRangeMonths]
  );
  const selectedFundingMatches = useMemo(
    () => (selectedInvestigator ? normalizeFundingMatches(selectedInvestigator, selectedMatches) : []),
    [selectedInvestigator, selectedMatches]
  );
  const selectedMomentum = selectedInvestigator
    ? momentumLabelFromActivitySeries(selectedTrajectoryActivitySeries)
    : "Emerging";
  const investigatorMetrics = useMemo<InvestigatorMetric[]>(() => {
    if (!selectedInvestigator) return [];
    const recentGrants = selectedInvestigatorSignals.filter(
      (item) => sourceFromItem(item) === "grants"
    ).length;
    return [
      {
        id: "recent-signals",
        label: "Recent Signals",
        value: selectedInvestigatorSignals.length.toLocaleString(),
        subtext: periodLabel,
      },
      {
        id: "recent-grants",
        label: "Active / Recent Grants",
        value: recentGrants.toLocaleString(),
        subtext: "Federal and foundation",
      },
      {
        id: "funding-match-score",
        label: "Funding Match Score",
        value: `${selectedInvestigator.matchStrength}%`,
        subtext: "Based on active opportunities",
      },
      {
        id: "research-momentum",
        label: "Research Momentum",
        value: selectedMomentum,
        subtext: "Publication and grant activity",
      },
    ];
  }, [selectedInvestigator, selectedInvestigatorSignals, selectedMomentum, periodLabel]);
  const consultationQuestions = [
    "Are you looking for individual PI, MPI, or center-scale opportunities?",
    "Which disease contexts are most important for near-term funding?",
    "Are there unpublished preliminary data that could support a targeted RFA?",
    "Would you be open to foundation opportunities?",
    "Are there clinical or translational collaborators to bring in?",
  ];
  const selectedCommunity = data.watchedCommunities.find((community) => community.id === communityId);

  const communityScopedItems =
    sourceFilteredItems.length > 0 ? sourceFilteredItems : scopedItemsAllTime;
  const communityScopedPriorItems =
    sourceFilteredPriorItems.length > 0 ? sourceFilteredPriorItems : priorCommunityItems;

  const investigatorsById = useMemo(
    () => new Map(visibleInvestigators.map((inv) => [inv.id, inv] as const)),
    [visibleInvestigators]
  );

  const portfolioIntelligenceSummary = useMemo<PortfolioIntelligenceSummaryData>(() => {
    const itemIds = new Set(communityScopedItems.map((item) => item.id));
    const annotationByItem = new Map<
      string,
      NonNullable<PortfolioIntelligenceDataBundle["documentAnnotations"]>[number]
    >();
    for (const annotation of data.documentAnnotations ?? []) {
      if (!itemIds.has(annotation.sourceItemId)) continue;
      const existing = annotationByItem.get(annotation.sourceItemId);
      if (!existing) {
        annotationByItem.set(annotation.sourceItemId, annotation);
        continue;
      }
      if (annotation.model === "gpt-4o-mini" && existing.model !== "gpt-4o-mini") {
        annotationByItem.set(annotation.sourceItemId, annotation);
      }
    }
    const scopedAnnotations = Array.from(annotationByItem.values());

    const countTop = (values: string[], limit?: number) => {
      const counts = new Map<string, number>();
      for (const value of values) {
        const key = value.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const sliced = limit === undefined ? ranked : ranked.slice(0, limit);
      return sliced.map(([label, count]) => ({ label, count }));
    };

    const investigatorsBySignals = new Map<string, number>();
    for (const item of communityScopedItems) {
      for (const investigatorId of item.investigatorIds) {
        investigatorsBySignals.set(
          investigatorId,
          (investigatorsBySignals.get(investigatorId) ?? 0) + 1
        );
      }
    }
    const topInvestigators = Array.from(investigatorsBySignals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, signalCount]) => ({
        id,
        name: investigatorsById.get(id)?.name ?? "Unknown investigator",
        signalCount,
      }));

    const translationalSeries = countTop(
      scopedAnnotations.map((a) => a.translationalStage || "unknown"),
      10
    ).map((row) => ({ stage: row.label, count: row.count }));

    const fundingSeries = countTop(
      communityScopedItems
        .filter((item) => sourceFromItem(item) === "grants")
        .map((item) => fundingLabelFromSignal(item)),
      8
    ).map((row) => ({ label: row.label, count: row.count }));

    const monthlyBySource = new Map<string, ReturnType<typeof emptySignalsOverTimeCounts>>();
    for (const item of scopedItemsAllTime) {
      const source = sourceFromItem(item);
      const bucket = monthlyBySource.get(item.monthKey) ?? emptySignalsOverTimeCounts();
      if (source === "grants") {
        bucket[grantTimelineSegmentFromItem(item)] += 1;
      } else {
        bucket[source] += 1;
      }
      monthlyBySource.set(item.monthKey, bucket);
    }
    const sortedKeys = Array.from(monthlyBySource.keys()).sort((a, b) => a.localeCompare(b));
    const latestSignalMonthKey = sortedKeys.at(-1) ?? latestMonthKey;
    const { current: signalTrendKeys } = computePeriodMonthKeys(
      periodRange,
      latestSignalMonthKey,
      sortedKeys
    );
    const signalsOverTimeSeries = signalTrendKeys.map((monthKey) => {
      const bucket = monthlyBySource.get(monthKey) ?? emptySignalsOverTimeCounts();
      const total = signalsOverTimeStackOrder.reduce((sum, segment) => sum + bucket[segment], 0);
      return {
        monthKey,
        monthLabel: monthLabelFromKey(monthKey),
        total,
        ...bucket,
      };
    });

    const itemMonthKeyById = new Map(communityScopedItems.map((item) => [item.id, item.monthKey] as const));
    const yearTrendKeys = buildPastYearKeys(latestSignalMonthKey);
    const annotationTrendBase = {
      annotations: scopedAnnotations,
      itemMonthKeyById,
      periodKeys: yearTrendKeys,
      periodLabelFromKey: yearLabelFromKey,
      topLimit: 5,
    };
    const themesOverTime = buildAnnotationDimensionTrend({
      ...annotationTrendBase,
      valuesFromAnnotation: (annotation) => annotation.themes,
    });
    const methodsOverTime = buildAnnotationDimensionTrend({
      ...annotationTrendBase,
      valuesFromAnnotation: (annotation) => annotation.methods,
    });
    const diseasesOverTime = buildAnnotationDimensionTrend({
      ...annotationTrendBase,
      valuesFromAnnotation: (annotation) => annotation.diseases,
    });

    const journalsOverTime = buildSignalLabelTrend({
      items: communityScopedItems.filter((item) => item.source_type === "pubmed"),
      periodKeys: yearTrendKeys,
      periodLabelFromKey: yearLabelFromKey,
      labelForItem: (item) => pubmedJournalLabel(portfolioItemToAnalyticsRow(item)),
      topLimit: 5,
    });
    const fundingAgenciesOverTime = buildSignalLabelTrend({
      items: communityScopedItems,
      periodKeys: yearTrendKeys,
      periodLabelFromKey: yearLabelFromKey,
      labelForItem: (item) => grantAgencyLabel(portfolioItemToAnalyticsRow(item)),
      topLimit: 5,
    });

    const itemsById = new Map(communityScopedItems.map((item) => [item.id, item] as const));
    const listSignals: PortfolioSummaryListSignals = {
      themes: buildAnnotationDimensionSignalMap(scopedAnnotations, itemsById, "themes"),
      methods: buildAnnotationDimensionSignalMap(scopedAnnotations, itemsById, "methods"),
      diseases: buildAnnotationDimensionSignalMap(scopedAnnotations, itemsById, "diseases"),
      journals: buildItemLabelSignalMap(
        communityScopedItems.filter((item) => item.source_type === "pubmed"),
        (item) => pubmedJournalLabel(portfolioItemToAnalyticsRow(item))
      ),
      fundingAgencies: buildItemLabelSignalMap(communityScopedItems, (item) =>
        grantAgencyLabel(portfolioItemToAnalyticsRow(item))
      ),
    };

    return {
      totalSignals: communityScopedItems.length,
      totalPublications: communityScopedItems.filter((i) => sourceFromItem(i) === "publications").length,
      totalNewGrants: communityScopedItems.filter(
        (i) => sourceFromItem(i) === "grants" && !isContinuingGrantSignal(i)
      ).length,
      totalAnnotatedSignals: scopedAnnotations.length,
      topThemes: countTop(scopedAnnotations.flatMap((a) => a.themes)),
      topMethods: countTop(scopedAnnotations.flatMap((a) => a.methods)),
      topDiseases: countTop(scopedAnnotations.flatMap((a) => a.diseases)),
      topJournals: countTopSignalLabels(
        communityScopedItems.filter((i) => i.source_type === "pubmed"),
        (item) => pubmedJournalLabel(portfolioItemToAnalyticsRow(item))
      ),
      topFundingAgencies: countTopSignalLabels(communityScopedItems, (item) =>
        grantAgencyLabel(portfolioItemToAnalyticsRow(item))
      ),
      topInvestigators,
      translationalSeries,
      fundingSeries,
      signalsOverTimeSeries,
      themesOverTime,
      methodsOverTime,
      diseasesOverTime,
      journalsOverTime,
      fundingAgenciesOverTime,
      listSignals,
    };
  }, [
    communityScopedItems,
    data.documentAnnotations,
    investigatorsById,
    latestMonthKey,
    periodRange,
    scopedItemsAllTime,
  ]);

  const themeDistribution = useMemo(() => {
    if (portfolioIntelligenceSummary.topThemes.length > 0) {
      return themeDistributionFromCounts(portfolioIntelligenceSummary.topThemes);
    }
    return themeDistributionFromScopedSignals(communityScopedItems, investigatorsById);
  }, [portfolioIntelligenceSummary.topThemes, communityScopedItems, investigatorsById]);

  const topThemeTags = useMemo(() => themeDistribution.map((t) => t.name), [themeDistribution]);

  const communityThemeMomentum = useMemo<CommunityThemeMomentum[]>(() => {
    const countThemes = (items: PortfolioSignalItem[]) => {
      const counts = new Map<string, number>();
      for (const item of items) {
        const invThemes = item.investigatorIds.flatMap((id) => investigatorsById.get(id)?.keyThemes ?? []);
        const inferredThemes = inferResearchThemesFromSignal(item, invThemes);
        for (const theme of inferredThemes) {
          counts.set(theme, (counts.get(theme) ?? 0) + 1);
        }
      }
      return counts;
    };
    const current = countThemes(communityScopedItems);
    const prior = countThemes(communityScopedPriorItems);
    return Array.from(current.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, currentValue]) => {
        const priorValue = prior.get(name) ?? 0;
        const deltaPct =
          priorValue <= 0
            ? currentValue > 0
              ? 100
              : 0
            : Math.round(((currentValue - priorValue) / priorValue) * 100);
        const investigators = visibleInvestigators
          .filter((inv) => inv.keyThemes.includes(name))
          .sort((a, b) => b.recentSignals - a.recentSignals)
          .slice(0, 3)
          .map((inv) => inv.name.split(",")[0] ?? inv.name);
        return {
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name,
          current: currentValue,
          prior: priorValue,
          deltaPct,
          investigators,
          opportunity: deltaPct >= 15 ? "High" : "Medium",
        };
      });
  }, [communityScopedItems, communityScopedPriorItems, visibleInvestigators, investigatorsById]);

  const fundingPlaybook = useMemo<CommunityFundingPlaybookEntry[]>(() => {
    const byTitle = new Map<string, { title: string; agency: string; investigators: Set<string> }>();
    for (const inv of visibleInvestigators) {
      for (const match of data.opportunityMatchesByInvestigator[inv.id] ?? []) {
        const key = match.title.trim().toLowerCase();
        const row = byTitle.get(key) ?? {
          title: match.title,
          agency: match.agency,
          investigators: new Set<string>(),
        };
        row.investigators.add(inv.id);
        byTitle.set(key, row);
      }
    }
    return Array.from(byTitle.entries())
      .map(([key, row]) => ({
        id: key,
        title: row.title,
        agency: row.agency,
        investigators: row.investigators.size,
        suggestedAction:
          row.investigators.size >= 3
            ? "Coordinate multi-investigator outreach and shared aims."
            : "Validate single-PI fit and identify one collaborator.",
      }))
      .sort((a, b) => b.investigators - a.investigators)
      .slice(0, 8);
  }, [data.opportunityMatchesByInvestigator, visibleInvestigators]);

  const fallbackFundingPlaybook = useMemo<CommunityFundingPlaybookEntry[]>(() => {
    const grants = communityScopedItems.filter((item) => sourceFromItem(item) === "grants");
    const byGrant = new Map<string, { title: string; investigators: Set<string> }>();
    for (const item of grants) {
      const key = (item.nih_project_num ?? item.title).toLowerCase();
      const row = byGrant.get(key) ?? { title: item.title, investigators: new Set() };
      for (const invId of item.investigatorIds) row.investigators.add(invId);
      byGrant.set(key, row);
    }
    return Array.from(byGrant.entries())
      .map(([key, row]) => ({
        id: key,
        title: row.title,
        agency: "Signal / grants",
        investigators: Math.max(1, row.investigators.size),
        suggestedAction:
          row.investigators.size >= 2
            ? "Coordinate multi-investigator positioning and shared aims."
            : "Evaluate PI-led fit and adjacent collaborator needs.",
      }))
      .sort((a, b) => b.investigators - a.investigators)
      .slice(0, 8);
  }, [communityScopedItems]);

  const playbookRows = fundingPlaybook.length > 0 ? fundingPlaybook : fallbackFundingPlaybook;

  const priorityInvestigators = useMemo(
    () =>
      [...investigatorsForTable].sort((a, b) => {
        const scoreA = a.matchStrength * 0.55 + a.recentSignals * 2 + a.collaborationIndex * 0.45;
        const scoreB = b.matchStrength * 0.55 + b.recentSignals * 2 + b.collaborationIndex * 0.45;
        return scoreB - scoreA;
      }),
    [investigatorsForTable]
  );

  const distinctThemeCount = useMemo(() => {
    const count = new Set(
      visibleInvestigators.flatMap((inv) => inv.keyThemes.map((t) => t.trim()).filter(Boolean))
    ).size;
    return count > 0 ? count : themeDistribution.length;
  }, [visibleInvestigators, themeDistribution.length]);

  const communityStats = [
    {
      id: "themes",
      label: "Research Themes",
      value: distinctThemeCount.toLocaleString(),
      subtext: "Structured themes in selected community",
    },
    {
      id: "rising",
      label: "Rising Themes",
      value: communityThemeMomentum.filter((row) => row.deltaPct > 0).length.toLocaleString(),
      subtext: "Positive momentum vs prior period",
    },
    {
      id: "matches",
      label: "Multi-investigator Matches",
      value: playbookRows.filter((row) => row.investigators >= 2).length.toLocaleString(),
      subtext: "Funding opportunities with shared fit",
    },
    {
      id: "priority-investigators",
      label: "Investigators to Prioritize",
      value: priorityInvestigators.slice(0, 10).length.toLocaleString(),
      subtext: "High match + momentum + collaboration",
    },
  ];

  const communitySnapshotSummary =
    (communityId && data.communityStrategyBriefByCommunityId[communityId]) || null;

  const strategySummary = useMemo(() => {
    if (communitySnapshotSummary) return communitySnapshotSummary;
    const topTheme = communityThemeMomentum[0]?.name ?? topThemeTags[0] ?? "priority themes";
    const rising = communityThemeMomentum.filter((row) => row.deltaPct > 0).length;
    const activeFunding = communityScopedItems.filter((item) => sourceFromItem(item) === "grants").length;
    const topPlay = playbookRows[0]?.title ?? "cross-cutting funding opportunities";
    return `AI synthesis across ingested signal content (papers, grant abstracts, and news) indicates community strengths in ${topTheme}. ${rising} themes are rising in the selected period, with ${activeFunding} active funding-related signals. Immediate strategy should emphasize ${topPlay.toLowerCase()} and coordinated investigator outreach.`;
  }, [communitySnapshotSummary, communityThemeMomentum, playbookRows, communityScopedItems, topThemeTags]);

  const strategyHighlights = [
    { label: "Emerging theme", value: communityThemeMomentum[0]?.name ?? "N/A" },
    {
      label: "Collaboration opportunity",
      value: playbookRows[0]?.investigators ? `${playbookRows[0].investigators} investigators overlap` : "N/A",
    },
    {
      label: "Funding gap",
      value: communityThemeMomentum.find((row) => row.deltaPct < 0)?.name ?? "No major negative trend",
    },
    { label: "Near-term play", value: playbookRows[0]?.title ?? "Generate playbook" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="app-page-title">Portfolio Intelligence</h1>
            <p className="app-page-description">
              Understand your watched research community and drill into investigator portfolios.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/portfolio-intelligence/data-sources"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            >
              Data sources
            </a>
            <Button>Prep for Consultation</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-soft">
          <div className="grid gap-3 md:grid-cols-[1fr,220px]">
            <Input
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search investigators, topics, grants, etc."
            />
            <Select value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
              {data.watchedCommunities.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </Select>
          </div>
          <div className="mt-3">
            <PeriodRangeToggle value={periodRange} onChange={setPeriodRange} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <SignalSourceChips
              active={activeSources}
              onToggle={(source) => {
                setActiveSources((prev) =>
                  prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source]
                );
              }}
            />
            <div className="text-xs text-[var(--fo-ink-muted)]">
              Source coverage:{" "}
              <span className="font-semibold text-emerald-700">
                {data.sourceCoverage}
              </span>{" "}
              {selectedCommunity ? `· ${selectedCommunity.name}` : null} ·{" "}
              {periodLabel}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedViewToggle value={viewMode} onChange={setViewMode} />
          <div className="min-w-0 flex-1 lg:max-w-3xl">
            <PeriodRangeToggle value={periodRange} onChange={setPeriodRange} />
          </div>
        </div>
      </header>

      {viewMode === "investigator" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((metric) => (
            <KpiCard
              key={metric.id}
              label={metric.label}
              value={metric.value}
              delta={metric.delta}
              comparison={metric.comparison}
              tone={metric.tone}
            />
          ))}
        </div>
      ) : null}

      {viewMode === "community" ? (
        <CommunityViewPage
          strategySummary={strategySummary}
          strategyHighlights={strategyHighlights}
          stats={communityStats}
          portfolioSummary={portfolioIntelligenceSummary}
          periodLabel={periodLabel}
          visibleSources={activeSources}
          themeDistribution={themeDistribution}
          emergingThemes={communityThemeMomentum}
          fundingPlaybook={playbookRows}
          priorityInvestigators={priorityInvestigators}
          onSelectInvestigator={(id) => {
            setSelectedInvestigatorId(id);
            setViewMode("investigator");
          }}
        />
      ) : (
        <InvestigatorViewPage
          investigators={investigatorsForTable}
          selectedInvestigator={selectedInvestigator}
          onSelectInvestigator={setSelectedInvestigatorId}
          signals={selectedInvestigatorSignals}
          trajectoryItems={selectedInvestigatorTrajectoryItems}
          trajectoryActivitySeries={selectedTrajectoryActivitySeries}
          periodLabel={periodLabel}
          metrics={investigatorMetrics}
          fundingMatches={selectedFundingMatches}
          consultationSummary={
            selectedInvestigator?.name.toLowerCase().includes("alexander marson")
              ? "Focus the consultation on whether the investigator is pursuing individual PI grants, collaborative MPI proposals, or center-scale opportunities. Ask about unpublished preliminary data, disease-specific translational angles, and potential clinical collaborators."
              : selectedConsultationSummary
          }
          consultationQuestions={consultationQuestions}
          addedSections={briefSections}
          globalQuery={globalSearchQuery}
          onToggleSection={(section) =>
            setBriefSections((prev) =>
              prev.includes(section)
                ? prev.filter((item) => item !== section)
                : [...prev, section]
            )
          }
        />
      )}
    </div>
  );
}
