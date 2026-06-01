"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
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
import type { MouseHandlerDataParam } from "recharts";
import {
  type CommunityInvestigatorOption,
  type CommunitySourceItemRow,
  type DashboardRange,
  buildMonthlySeries,
  communityItemsMonthSpan,
  cumulativeTotalSeries,
  effectiveMonthKey,
  filterCommunityItemsByInvestigators,
  filterMonthlyByRange,
  formatDashboardSnapshotLabel,
  formatMonthSpanLabel,
  grantAgencyLabel,
  itemsInRange,
  pubmedJournalLabel,
  sumMonthlyKpis,
  topEntitiesInRange,
  truncateLabel,
} from "@/lib/community/signal-dashboard-analytics";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const RANGE_OPTIONS: { id: DashboardRange; label: string }[] = [
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1Y" },
  { id: "2y", label: "2Y" },
  { id: "5y", label: "5Y" },
  { id: "max", label: "Max" },
];

const STACK_COLORS: Record<string, string> = {
  paper: "#5b7a9a",
  award: "#c9955b",
  media: "#a66b72",
  newFunding: "#4a8f6a",
  activeGrants: "#3d7358",
  other: "#9a8d84",
};

const STACK_LABELS: Record<string, string> = {
  paper: "Publications",
  award: "Awards",
  media: "News",
  newFunding: "New funding",
  activeGrants: "Active grants",
  other: "Other",
};

function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="app-surface-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-ink-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--fo-title)]">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-[var(--fo-ink-muted)]">{sub}</p>
    </div>
  );
}

function InvestigatorFilter({
  investigators,
  selectedIds,
  onChange,
}: {
  investigators: CommunityInvestigatorOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? investigators.filter((inv) => inv.name.toLowerCase().includes(q))
      : investigators;
    return list.slice(0, 80);
  }, [investigators, query]);

  const selectedInvestigators = useMemo(
    () => investigators.filter((inv) => selected.has(inv.id)),
    [investigators, selected]
  );

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <p className="shrink-0 text-sm font-semibold text-[var(--fo-title)]">Investigators</p>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="max-w-md bg-[var(--card)]"
          aria-label="Search investigators"
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fo-ink-muted)]">
          {selectedIds.length === 0 ? (
            <span>All investigators ({investigators.length.toLocaleString()})</span>
          ) : (
            <span>
              {selectedIds.length.toLocaleString()} selected · charts show their signals only
            </span>
          )}
          {selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="font-semibold text-[var(--fo-interaction)] hover:underline"
            >
              Clear filter
            </button>
          ) : null}
        </div>
      </div>

      {selectedInvestigators.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectedInvestigators.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => toggle(inv.id)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--fo-interaction)]/30 bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--fo-title)] hover:bg-[var(--fo-paper-2)]"
            >
              {inv.name}
              <span className="text-[var(--fo-ink-muted)]" aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)]"
        role="listbox"
        aria-label="Select investigators"
        aria-multiselectable="true"
      >
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[var(--fo-ink-muted)]">No names match your search.</p>
        ) : (
          visible.map((inv) => (
            <label
              key={inv.id}
              className="flex cursor-pointer items-center gap-2 border-b border-[var(--border)]/50 px-3 py-2 text-sm last:border-0 hover:bg-[var(--fo-paper-2)]"
            >
              <input
                type="checkbox"
                className="rounded border-[var(--border)]"
                checked={selected.has(inv.id)}
                onChange={() => toggle(inv.id)}
              />
              <span className="min-w-0 truncate text-[var(--fo-title)]">{inv.name}</span>
            </label>
          ))
        )}
      </div>
      {query.trim() && investigators.length > visible.length ? (
        <p className="mt-2 text-xs text-[var(--fo-ink-muted)]">
          Showing {visible.length} of {investigators.length} matches — refine search to narrow further.
        </p>
      ) : null}
    </div>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: DashboardRange;
  onChange: (v: DashboardRange) => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-1"
      role="group"
      aria-label="Time range"
    >
      {RANGE_OPTIONS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === id
              ? "bg-[var(--fo-interaction)] text-white shadow-sm"
              : "text-[var(--fo-ink-muted)] hover:bg-[var(--card)] hover:text-[var(--fo-title)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DrillDownPanel({
  title,
  subtitle,
  items,
  entityNameById,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  items: CommunitySourceItemRow[];
  entityNameById: Record<string, string>;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fo-title)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium text-[var(--fo-interaction)] hover:underline"
        >
          Dismiss
        </button>
      </div>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
        {items.length === 0 ? (
          <li className="text-[var(--fo-ink-muted)]">No signals in this slice.</li>
        ) : (
          items.map((item) => {
            const entityIds =
              item.tracked_entity_ids && item.tracked_entity_ids.length > 0
                ? item.tracked_entity_ids
                : item.signal_tracked_entity_id
                  ? [item.signal_tracked_entity_id]
                  : [];
            const names = Array.from(new Set(entityIds))
              .map((id) => entityNameById[id])
              .filter(Boolean);
            return (
              <li
                key={item.id}
                className="border-b border-[var(--border)]/60 pb-2 last:border-0"
              >
                <p className="font-medium text-[var(--fo-title)]">{item.title ?? "(untitled)"}</p>
                <p className="text-xs text-[var(--fo-ink-muted)]">
                  {names.length > 0 ? names.join(", ") : "Unlinked"}
                  {item.published_at
                    ? ` · ${new Date(item.published_at).toLocaleDateString()}`
                    : ""}
                </p>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

export type CommunityDashboardProps = {
  items: CommunitySourceItemRow[];
  investigators: CommunityInvestigatorOption[];
  entityNameById: Record<string, string>;
  watchlistFaculty: number;
  snapshotAt: string;
  /** Total rows in community_source_items (may exceed loaded items if capped). */
  totalInDatabase?: number | null;
};

export function CommunityDashboard({
  items,
  investigators,
  entityNameById,
  watchlistFaculty,
  snapshotAt,
  totalInDatabase,
}: CommunityDashboardProps) {
  const [range, setRange] = useState<DashboardRange>("max");
  const [selectedInvestigatorIds, setSelectedInvestigatorIds] = useState<string[]>([]);
  const [showCumulative, setShowCumulative] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<string | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);

  const filteredItems = useMemo(
    () => filterCommunityItemsByInvestigators(items, investigators, selectedInvestigatorIds),
    [items, investigators, selectedInvestigatorIds]
  );

  const investigatorFilterActive = selectedInvestigatorIds.length > 0;

  const monthly = useMemo(
    () => filterMonthlyByRange(buildMonthlySeries(filteredItems), range),
    [filteredItems, range]
  );
  const kpis = useMemo(() => sumMonthlyKpis(monthly), [monthly]);
  const cumulative = useMemo(() => cumulativeTotalSeries(monthly), [monthly]);
  const chartData = useMemo(
    () =>
      monthly.map((row, i) => ({
        ...row,
        cumulative: cumulative[i]?.cumulative ?? 0,
      })),
    [monthly, cumulative]
  );

  const dataMonthSpan = useMemo(() => communityItemsMonthSpan(filteredItems), [filteredItems]);
  const rangeItems = useMemo(() => itemsInRange(filteredItems, range), [filteredItems, range]);

  const recentItems = useMemo(
    () =>
      [...filteredItems]
        .sort((a, b) => {
          const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
          const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 12)
        .map((item) => {
          const entityId =
            item.tracked_entity_ids?.[0] ?? item.signal_tracked_entity_id ?? null;
          return {
            id: item.id,
            title: item.title ?? "(untitled)",
            entityName: entityId ? (entityNameById[entityId] ?? "Unknown") : "Unlinked",
            published_at: item.published_at,
          };
        }),
    [filteredItems, entityNameById]
  );

  const topJournals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of rangeItems) {
      if (item.source_type !== "pubmed") continue;
      const journal = pubmedJournalLabel(item);
      if (!journal) continue;
      counts.set(journal, (counts.get(journal) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([journal, value]) => ({ journal, value, fill: "#5b7a9a" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [rangeItems]);

  const topAgencies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of rangeItems) {
      const agency = grantAgencyLabel(item);
      if (!agency) continue;
      counts.set(agency, (counts.get(agency) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, fill: "#4a8f6a" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [rangeItems]);

  const topInvestigators = useMemo(
    () => topEntitiesInRange(filteredItems, entityNameById, range, 20),
    [filteredItems, entityNameById, range]
  );

  const monthItems = useMemo(() => {
    if (!selectedMonth) return [];
    return rangeItems
      .filter((item) => effectiveMonthKey(item) === selectedMonth)
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [rangeItems, selectedMonth]);

  const journalItems = useMemo(() => {
    if (!selectedJournal) return [];
    return rangeItems
      .filter((item) => item.source_type === "pubmed" && pubmedJournalLabel(item) === selectedJournal)
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [rangeItems, selectedJournal]);

  const agencyItems = useMemo(() => {
    if (!selectedAgency) return [];
    return rangeItems
      .filter((item) => grantAgencyLabel(item) === selectedAgency)
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [rangeItems, selectedAgency]);

  const onChartClick = useCallback((state: MouseHandlerDataParam) => {
      let index =
        typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : undefined;
      if (index == null || index < 0) {
        const label = state.activeLabel;
        if (label != null) {
          index = chartData.findIndex((row) => row.shortLabel === String(label));
        }
      }
      if (index == null || index < 0) return;
      const row = chartData[index];
      if (!row?.month) return;
      setSelectedJournal(null);
      setSelectedAgency(null);
      setSelectedMonth((prev) => (prev === row.month ? null : row.month));
    }, [chartData]);

  if (items.length === 0 && !investigatorFilterActive) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--fo-paper-2)] px-6 py-10 text-center">
        <p className="text-sm font-medium text-[var(--fo-title)]">No Signal data yet</p>
        <p className="mt-2 text-sm text-[var(--fo-ink-muted)]">
          Add people via CSV or manual entry on{" "}
          <Link href="/investigators" className="font-semibold text-[var(--fo-interaction)] underline">
            People
          </Link>
          , refresh PubMed / RePORTER on their profiles (or use sync below), then click{" "}
          <span className="font-medium">Sync community signals</span>. Signal import is optional.
        </p>
      </div>
    );
  }

  if (investigatorFilterActive && filteredItems.length === 0) {
    return (
      <div className="space-y-6">
        <InvestigatorFilter
          investigators={investigators}
          selectedIds={selectedInvestigatorIds}
          onChange={(ids) => {
            setSelectedInvestigatorIds(ids);
            setSelectedMonth(null);
            setSelectedJournal(null);
            setSelectedAgency(null);
          }}
        />
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--fo-paper-2)] px-6 py-10 text-center">
          <p className="text-sm font-medium text-[var(--fo-title)]">No signals for this selection</p>
          <p className="mt-2 text-sm text-[var(--fo-ink-muted)]">
            None of the selected investigators have linked signals in Community yet. Try clearing the
            filter, syncing community signals, or refreshing PubMed / RePORTER on their profiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <InvestigatorFilter
        investigators={investigators}
        selectedIds={selectedInvestigatorIds}
        onChange={(ids) => {
          setSelectedInvestigatorIds(ids);
          setSelectedMonth(null);
          setSelectedJournal(null);
          setSelectedAgency(null);
        }}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-[var(--fo-ink-muted)]">
            Updated {formatDashboardSnapshotLabel(snapshotAt)}
          </p>
        </div>
        <div className="flex max-w-md flex-col items-start gap-2 sm:items-end sm:text-right">
          <RangeSelector
            value={range}
            onChange={(v) => {
              setRange(v);
              setSelectedMonth(null);
              setSelectedJournal(null);
              setSelectedAgency(null);
            }}
          />
          <p className="text-xs leading-snug text-[var(--fo-ink-muted)]">
            Charts bucket signals by publication month (award dates for grants), not import date.
            {dataMonthSpan ? (
              <>
                {" "}
                Loaded data spans {formatMonthSpanLabel(dataMonthSpan)} (
                {filteredItems.length.toLocaleString()}
                {investigatorFilterActive ? " filtered" : ""} signals
                {investigatorFilterActive && items.length !== filteredItems.length
                  ? ` of ${items.length.toLocaleString()} total`
                  : ""}
                ).
              </>
            ) : null}
            {range !== "max" ? " YTD is Jan through this month (UTC)." : null}
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--fo-ink-muted)] sm:justify-end">
            <input
              type="checkbox"
              checked={showCumulative}
              onChange={(e) => setShowCumulative(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            Overlay cumulative total
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label="Faculty tracked"
          value={investigatorFilterActive ? selectedInvestigatorIds.length : watchlistFaculty}
          sub={
            investigatorFilterActive
              ? `Selected of ${watchlistFaculty.toLocaleString()} on roster`
              : "Community roster"
          }
        />
        <KpiTile
          label="Publications"
          value={kpis.paper}
          sub={investigatorFilterActive ? "Selected investigators · range" : "In selected range"}
        />
        <KpiTile label="Awards" value={kpis.award} sub="In range" />
        <KpiTile label="New funding" value={kpis.newFunding} sub="NIH type 1 · yr 1" />
        <KpiTile label="Active grants" value={kpis.activeGrants} sub="Continuing NIH" />
        <KpiTile label="News" value={kpis.media} sub="In range" />
        <KpiTile label="Other" value={kpis.other} sub="In range" />
        <KpiTile
          label="Signals ingested"
          value={kpis.total}
          sub={
            totalInDatabase != null && totalInDatabase !== kpis.total
              ? `${kpis.total.toLocaleString()} in range · ${totalInDatabase.toLocaleString()} in database`
              : totalInDatabase != null
                ? `${totalInDatabase.toLocaleString()} in database · filtered by range`
                : investigatorFilterActive
                  ? "Selected investigators · range"
                  : "All categories, range"
          }
        />
        <KpiTile label="Approved in range" value={kpis.approved} sub="Ready for digest" />
      </div>

      <Card>
        <CardHeader
          title="Research volume by month"
          description="Stacked by signal type. Click a month to list the signals behind that bar."
        />
        <CardBody>
          <div className="h-[340px] w-full min-w-0 text-[var(--fo-ink-muted)]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: showCumulative ? 16 : 8, left: 0, bottom: 0 }}
                onClick={onChartClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
                {showCumulative ? (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    width={44}
                    allowDecimals={false}
                  />
                ) : null}
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {Object.entries(STACK_COLORS).map(([key, color]) => (
                  <Area
                    key={key}
                    yAxisId="left"
                    type="monotone"
                    dataKey={key}
                    name={STACK_LABELS[key] ?? key}
                    stackId="sig"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.85}
                  />
                ))}
                {showCumulative ? (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative total"
                    stroke="#6c5a50"
                    strokeWidth={2}
                    dot={false}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {selectedMonth ? (
            <div className="mt-4">
              <DrillDownPanel
                title={`Signals in ${selectedMonth}`}
                subtitle="Same month assignment as the chart (publication date, or first-seen date if missing)."
                items={monthItems}
                entityNameById={entityNameById}
                onDismiss={() => setSelectedMonth(null)}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top journals (range)"
            description="PubMed signals in range. Click a bar to list underlying signals."
          />
          <CardBody>
            <div className="h-[260px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={
                    topJournals.length
                      ? topJournals
                      : [{ journal: "—", value: 0, fill: "#eadfd5" }]
                  }
                  margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  onClick={(state) => {
                    const idx =
                      typeof state?.activeTooltipIndex === "number" ? state.activeTooltipIndex : -1;
                    if (idx < 0) return;
                    const row = topJournals[idx];
                    if (!row?.journal || row.journal === "—") return;
                    setSelectedMonth(null);
                    setSelectedAgency(null);
                    setSelectedJournal((prev) => (prev === row.journal ? null : row.journal));
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="journal"
                    tick={{ fontSize: 11 }}
                    width={148}
                    tickFormatter={(v) => truncateLabel(String(v), 40)}
                  />
                  <Tooltip />
                  <Bar dataKey="value" name="Papers" radius={[0, 4, 4, 0]} fill="#5b7a9a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {selectedJournal ? (
              <div className="mt-4">
                <DrillDownPanel
                  title={`Journal — ${selectedJournal}`}
                  subtitle="PubMed signals attributed to this journal."
                  items={journalItems}
                  entityNameById={entityNameById}
                  onDismiss={() => setSelectedJournal(null)}
                />
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Grant agencies (range)"
            description="RePORTER-linked funding signals. Click a bar to list underlying signals."
          />
          <CardBody>
            <div className="h-[260px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={
                    topAgencies.length ? topAgencies : [{ name: "—", value: 0, fill: "#eadfd5" }]
                  }
                  margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  onClick={(state) => {
                    const idx =
                      typeof state?.activeTooltipIndex === "number" ? state.activeTooltipIndex : -1;
                    if (idx < 0) return;
                    const row = topAgencies[idx];
                    if (!row?.name || row.name === "—") return;
                    setSelectedMonth(null);
                    setSelectedJournal(null);
                    setSelectedAgency((prev) => (prev === row.name ? null : row.name));
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
                  <Tooltip />
                  <Bar dataKey="value" name="Grants" radius={[0, 4, 4, 0]} fill="#4a8f6a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {selectedAgency ? (
              <div className="mt-4">
                <DrillDownPanel
                  title={`Grant agency — ${selectedAgency}`}
                  subtitle="RePORTER-linked funding signals for this agency."
                  items={agencyItems}
                  entityNameById={entityNameById}
                  onDismiss={() => setSelectedAgency(null)}
                />
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top investigators (range)"
            description={
              investigatorFilterActive
                ? "Signal counts for selected investigators in this range."
                : "Most ingested signals linked to a watchlist member."
            }
          />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {topInvestigators.length === 0 ? (
                <li className="text-[var(--fo-ink-muted)]">No linked items in this range.</li>
              ) : (
                topInvestigators.map((row, i) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-2 last:border-0"
                  >
                    <span className="min-w-0 truncate text-[var(--fo-title)]">
                      <span className="text-[var(--fo-ink-muted)]">{i + 1}. </span>
                      {row.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--fo-ink-muted)]">
                      {row.count}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" description="Latest ingested signals." />
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--fo-ink-muted)]">
                  <th className="pb-2 pr-2 font-medium">Title</th>
                  <th className="pb-2 pr-2 font-medium">Investigator</th>
                  <th className="pb-2 font-medium">Published</th>
                </tr>
              </thead>
              <tbody>
                {recentItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-[var(--fo-ink-muted)]">
                      No items yet.
                    </td>
                  </tr>
                ) : (
                  recentItems.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--border)]/60 last:border-b-0"
                    >
                      <td className="py-2 pr-2 font-medium text-[var(--fo-title)]">
                        <span className="line-clamp-2">{row.title}</span>
                      </td>
                      <td className="py-2 pr-2 text-[var(--fo-ink-muted)]">{row.entityName}</td>
                      <td className="py-2 text-[var(--fo-ink-muted)]">
                        {row.published_at
                          ? new Date(row.published_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
