"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  expireMonitorAwaitingToColdAction,
  expireStaleColdOpportunitiesAction,
  setSavedOpportunityCommunitiesAction,
  updateSavedOpportunityPipelineAction,
} from "@/app/actions/opportunity-pipeline-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { PipelineListMetricsRow } from "@/components/opportunity-pipeline/pipeline-list-metrics-row";
import { PipelineListNextActionsCard } from "@/components/opportunity-pipeline/pipeline-list-next-actions-card";
import { MonitorOpportunityPiPanel } from "@/components/opportunity-pipeline/monitor-opportunity-pi-panel";
import { TriageOpportunityWorkflow } from "@/components/opportunity-pipeline/triage-opportunity-workflow";
import {
  PIPELINE_BUCKET_LABEL,
  PIPELINE_BUCKET_TABS,
  type PipelineBucketTab,
  type PipelineStage,
} from "@/lib/opportunity-pipeline/constants";
import type { PipelineCommunityRef } from "@/lib/opportunity-pipeline/serializers";
import { formatDate } from "@/lib/formatting/dates";
import { deadlineUrgency } from "@/lib/opportunity-pipeline/pipeline-list-card-meta";
import { PipelineOpportunityBoardCard } from "@/components/opportunity-pipeline/pipeline-opportunity-board-card";
import {
  monitorStatusLine,
  outreachCardSummary,
  type NormalizedPipelineItem,
} from "@/lib/opportunity-pipeline/serializers";

type ProfileRow = { id: string; full_name: string | null; email: string | null };

/** Community filter: idle = white pill + neutral accent bar; active = primary blue + select tint. */
const COMMUNITY_FILTER_ACTIVE =
  "rounded-xl border-2 border-[var(--fo-interaction)] bg-[var(--fo-select-tint)] text-[var(--fo-title)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_14%,transparent)]";

const COMMUNITY_CHIP_ON =
  "rounded-md border border-[var(--fo-interaction)] bg-[var(--fo-select-tint)] text-[var(--fo-title)] font-semibold shadow-sm";

const COMMUNITY_STRIPES = [
  {
    filterIdle:
      "rounded-xl border border-[var(--fo-border)] border-l-[3px] border-l-[var(--fo-stripe-0)] bg-[var(--fo-paper)] text-[var(--fo-title)] shadow-sm",
    filterActive: COMMUNITY_FILTER_ACTIVE,
    chipOff:
      "rounded-md border border-[var(--fo-neutral-status-border)] bg-[var(--fo-paper)] pl-2 pr-2 py-0.5 text-[var(--fo-ink-body)] border-l-[3px] border-l-[var(--fo-stripe-0)]",
    chipOn: COMMUNITY_CHIP_ON,
  },
  {
    filterIdle:
      "rounded-xl border border-[var(--fo-border)] border-l-[3px] border-l-[var(--fo-stripe-1)] bg-[var(--fo-paper)] text-[var(--fo-title)] shadow-sm",
    filterActive: COMMUNITY_FILTER_ACTIVE,
    chipOff:
      "rounded-md border border-[var(--fo-neutral-status-border)] bg-[var(--fo-paper)] pl-2 pr-2 py-0.5 text-[var(--fo-ink-body)] border-l-[3px] border-l-[var(--fo-stripe-1)]",
    chipOn: COMMUNITY_CHIP_ON,
  },
  {
    filterIdle:
      "rounded-xl border border-[var(--fo-border)] border-l-[3px] border-l-[var(--fo-stripe-2)] bg-[var(--fo-paper)] text-[var(--fo-title)] shadow-sm",
    filterActive: COMMUNITY_FILTER_ACTIVE,
    chipOff:
      "rounded-md border border-[var(--fo-neutral-status-border)] bg-[var(--fo-paper)] pl-2 pr-2 py-0.5 text-[var(--fo-ink-body)] border-l-[3px] border-l-[var(--fo-stripe-2)]",
    chipOn: COMMUNITY_CHIP_ON,
  },
] as const;

function stripeForIndex(i: number) {
  return COMMUNITY_STRIPES[i % COMMUNITY_STRIPES.length]!;
}

/** A named research community filter tab (not All). */
function isPipelineCommunityFilterTab(tab: string): boolean {
  return tab !== "all";
}

function passesRefineFilters(
  row: NormalizedPipelineItem,
  filters: {
    fStrategic: string;
    fSponsor: string;
    fHasPis: string;
    fOutreach: string;
    fOwner: string;
    fDeadlineFrom: string;
    fDeadlineTo: string;
    fOverdue: boolean;
    today: string;
  }
): boolean {
  const { fStrategic, fSponsor, fHasPis, fOutreach, fOwner, fDeadlineFrom, fDeadlineTo, fOverdue, today } = filters;
  if (fStrategic !== "all" && row.strategic_value !== fStrategic) return false;
  const fo = row.funding_opportunities;
  const agency = (fo?.agency ?? "").toLowerCase();
  if (fSponsor.trim() && !agency.includes(fSponsor.trim().toLowerCase())) return false;
  const matches = row.saved_opportunity_pi_matches ?? [];
  if (fHasPis === "yes" && matches.length === 0) return false;
  if (fHasPis === "no" && matches.length > 0) return false;
  const { sent, interested } = outreachCardSummary(matches);
  if (fOutreach === "none" && sent > 0) return false;
  if (fOutreach === "pre_send") {
    const anySent = matches.some((m) =>
      ["sent", "responded_interested", "responded_maybe", "responded_declined"].includes(m.outreach_status)
    );
    if (anySent) return false;
  }
  if (fOutreach === "sent" && sent === 0) return false;
  if (fOutreach === "interested" && interested === 0) return false;
  if (fOwner !== "all" && (row.owner_id ?? "unassigned") !== fOwner) return false;
  const cd = fo?.close_date ?? null;
  if (fDeadlineFrom && (!cd || cd < fDeadlineFrom)) return false;
  if (fDeadlineTo && (!cd || cd > fDeadlineTo)) return false;
  if (fOverdue) {
    if (!row.next_action_date || row.next_action_date >= today) return false;
    if (row.stage === "archived") return false;
  }
  return true;
}

export function OpportunityPipelineListClient({
  items,
  profiles,
  communities,
}: {
  items: NormalizedPipelineItem[];
  profiles: ProfileRow[];
  communities: PipelineCommunityRef[];
}) {
  const router = useRouter();
  const [bucketTab, setBucketTab] = useState<PipelineBucketTab>("triage");
  const [communityTab, setCommunityTab] = useState<string>("all");
  const [communityPiFilter, setCommunityPiFilter] = useState("");
  const [pending, startTransition] = useTransition();

  const [fStrategic, setFStrategic] = useState<string>("all");
  const [fSponsor, setFSponsor] = useState("");
  const [fHasPis, setFHasPis] = useState<string>("all");
  const [fOutreach, setFOutreach] = useState<string>("all");
  const [fOwner, setFOwner] = useState<string>("all");
  const [fDeadlineFrom, setFDeadlineFrom] = useState("");
  const [fDeadlineTo, setFDeadlineTo] = useState("");
  const [fOverdue, setFOverdue] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Monitor: at most one PI workflow panel expanded at a time. Triage workflow is always visible on cards. */
  const [expandedMonitorOpportunityId, setExpandedMonitorOpportunityId] = useState<string | null>(null);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (fStrategic !== "all") n++;
    if (fHasPis !== "all") n++;
    if (fOutreach !== "all") n++;
    if (fOwner !== "all") n++;
    if (fSponsor.trim()) n++;
    if (fDeadlineFrom) n++;
    if (fDeadlineTo) n++;
    if (fOverdue) n++;
    return n;
  }, [fStrategic, fHasPis, fOutreach, fOwner, fSponsor, fDeadlineFrom, fDeadlineTo, fOverdue]);

  const ownerLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) {
      m.set(p.id, (p.full_name || p.email || p.id).trim());
    }
    return m;
  }, [profiles]);

  useEffect(() => {
    if (!isPipelineCommunityFilterTab(communityTab)) {
      setCommunityPiFilter("");
    }
  }, [communityTab]);

  const today = new Date().toISOString().slice(0, 10);

  const byBucket = useMemo(() => {
    return items.filter((row) => row.stage === bucketTab);
  }, [items, bucketTab]);

  /** First metrics tile: community / untagged context (stable across Triage · Monitor · Cold · Archived). */
  const metricsAnchorLabel = useMemo(() => {
    if (communityTab === "all") return "All communities";
    const c = communities.find((x) => x.id === communityTab);
    if (c) return c.label;
    return PIPELINE_BUCKET_LABEL[bucketTab];
  }, [communityTab, communities, bucketTab]);

  const metricsAnchorEyebrow = useMemo(() => {
    if (communityTab === "all") return "Communities";
    if (isPipelineCommunityFilterTab(communityTab)) return "Research community";
    return "Pipeline";
  }, [communityTab]);

  const refineFilterArgs = useMemo(
    () => ({
      fStrategic,
      fSponsor,
      fHasPis,
      fOutreach,
      fOwner,
      fDeadlineFrom,
      fDeadlineTo,
      fOverdue,
      today,
    }),
    [fStrategic, fSponsor, fHasPis, fOutreach, fOwner, fDeadlineFrom, fDeadlineTo, fOverdue, today]
  );

  /**
   * Community + refine filters only (no pipeline stage). Used for context summary + priorities so
   * a named community stays consistent across Triage / Monitor / Cold / Archived.
   */
  const communityAndRefineCohort = useMemo(() => {
    let list = items;
    if (isPipelineCommunityFilterTab(communityTab)) {
      list = items.filter((r) => r.communities.some((c) => c.id === communityTab));
    }
    return list.filter((row) => passesRefineFilters(row, refineFilterArgs));
  }, [items, communityTab, refineFilterArgs]);

  const filtered = useMemo(() => {
    let list = byBucket;
    if (bucketTab === "triage" && isPipelineCommunityFilterTab(communityTab)) {
      list = list.filter((r) => r.communities.some((c) => c.id === communityTab));
    }
    return list.filter((row) => passesRefineFilters(row, refineFilterArgs));
  }, [byBucket, bucketTab, communityTab, refineFilterArgs]);

  /** Context summary metrics for the current community slice. */
  const contextMetrics = useMemo(() => {
    const cohort = communityAndRefineCohort;
    const sliceTotal = cohort.length;
    let piLinked = 0;
    let interested = 0;
    let contacted = 0;
    let assigned = 0;
    let overdue = 0;
    for (const row of cohort) {
      const m = row.saved_opportunity_pi_matches ?? [];
      if (m.length > 0) piLinked++;
      if (row.owner_id) assigned++;
      if (row.next_action_date && row.next_action_date < today && row.stage !== "archived") overdue++;
      if (m.some((x) => x.outreach_status === "responded_interested")) interested++;
      if (m.some((x) => ["sent", "responded_interested", "responded_maybe", "responded_declined"].includes(x.outreach_status))) {
        contacted++;
      }
    }
    return { sliceTotal, piLinked, contacted, interested, assigned, overdue };
  }, [communityAndRefineCohort, today]);

  useEffect(() => {
    setExpandedMonitorOpportunityId(null);
  }, [bucketTab, communityTab]);

  useEffect(() => {
    if (
      expandedMonitorOpportunityId &&
      !filtered.some((r) => r.opportunity_id === expandedMonitorOpportunityId)
    ) {
      setExpandedMonitorOpportunityId(null);
    }
  }, [filtered, expandedMonitorOpportunityId]);

  useEffect(() => {
    if (bucketTab !== "monitor") return;
    let cancelled = false;
    startTransition(async () => {
      const r = await expireMonitorAwaitingToColdAction();
      if (!cancelled && r.ok && r.moved > 0) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [bucketTab, router]);

  const operationalSummary = useMemo(() => {
    const tri = items.filter((i) => i.stage === "triage").length;
    const mon = items.filter((i) => i.stage === "monitor").length;
    const parts = [`${items.length} saved total`, `${tri} in Triage`, `${mon} in Monitor`];
    if (contextMetrics.overdue > 0) parts.push(`${contextMetrics.overdue} overdue in context slice`);
    if (contextMetrics.interested > 0) parts.push(`${contextMetrics.interested} with interested PI in context slice`);
    return parts.join(" · ");
  }, [items, contextMetrics.interested, contextMetrics.overdue]);

  function setStage(oppId: string, stage: PipelineStage) {
    startTransition(async () => {
      const r = await updateSavedOpportunityPipelineAction({ opportunityId: oppId, stage });
      if (!r.ok) window.alert(r.error);
      else router.refresh();
    });
  }

  /** Promotes to Monitor (email sending disabled for now). Optionally switches the board tab to Monitor. */
  function moveToMonitor(oppId: string, options?: { switchToMonitorTab?: boolean }) {
    startTransition(async () => {
      const r = await updateSavedOpportunityPipelineAction({ opportunityId: oppId, stage: "monitor" });
      if (!r.ok) window.alert(r.error);
      else {
        if (options?.switchToMonitorTab) setBucketTab("monitor");
        router.refresh();
      }
    });
  }

  /** Clears assigned communities on a card so tags can be redone in place. */
  function clearCommunityTags(oppId: string) {
    startTransition(async () => {
      const r = await setSavedOpportunityCommunitiesAction({
        opportunityId: oppId,
        communityIds: [],
      });
      if (!r.ok) window.alert(r.error);
      else router.refresh();
    });
  }

  function runExpireCold() {
    startTransition(async () => {
      await expireStaleColdOpportunitiesAction();
      router.refresh();
    });
  }

  const boardTitle =
    bucketTab === "triage"
      ? "Triage"
      : bucketTab === "monitor"
        ? "Monitor"
        : bucketTab === "cold"
          ? "Cold"
          : "Archived";

  const triageListLayout = bucketTab === "triage";

  return (
    <div className="mx-auto w-full max-w-[min(88rem,calc(100vw-1.5rem))] space-y-8 px-3 pb-24 text-[var(--fo-title)] sm:px-5 lg:px-8">
      <header className="overflow-hidden rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-paper)] shadow-[var(--fo-shadow-surface)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_6%,transparent)]">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--fo-display)] sm:text-[1.65rem] sm:tracking-tight">
              Opportunity pipeline
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-snug text-[var(--fo-ink-body)]">
              Operational queue for saved notices — triage communities and PIs here, then open a card for full decision
              support.{" "}
              <Link href="/funding-opportunities" className="font-semibold text-[var(--fo-interaction)] underline underline-offset-2">
                Search
              </Link>
              {" · "}
              <Link href="/match/quick" className="font-semibold text-[var(--fo-interaction)] underline underline-offset-2">
                AI matches
              </Link>
            </p>
          </div>
          {items.length > 0 ? (
            <p className="max-w-xl shrink-0 rounded-xl border border-[var(--fo-border)] bg-[var(--fo-subpanel)] px-3 py-2 text-xs font-semibold leading-snug text-[var(--fo-ink-body)] sm:text-[0.8125rem]">
              {operationalSummary}
            </p>
          ) : null}
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Pipeline is empty"
          description="Star notices in Search to add them here. New saves land in Triage by default."
          className="rounded-2xl border border-dashed border-[var(--fo-border)] bg-[var(--fo-paper)] py-14 shadow-[var(--fo-shadow-surface)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_5%,transparent)]"
        />
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--fo-border-strong)] bg-[var(--fo-panel-shelf)] p-5 shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_6%,transparent)] lg:p-6">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_min(18rem,34%)] lg:items-start lg:gap-10">
              <PipelineListMetricsRow
                anchorEyebrow={metricsAnchorEyebrow}
                anchorLabel={metricsAnchorLabel}
                anchorFootnote={
                  communityTab === "all"
                    ? "All saved notices (refine filters)"
                    : "All stages · refine filters"
                }
                sliceTotal={contextMetrics.sliceTotal}
                piLinked={contextMetrics.piLinked}
                contacted={contextMetrics.contacted}
                interested={contextMetrics.interested}
                assigned={contextMetrics.assigned}
                overdue={contextMetrics.overdue}
                summaryHint={
                  communityTab === "all"
                    ? "Every notice in Triage, Monitor, Cold, and Archived — same cohort across stages."
                    : `Same "${metricsAnchorLabel}" cohort across all stages (refine filters apply).`
                }
              />
              <div className="border-t border-[var(--fo-divider)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <PipelineListNextActionsCard
                  bucketTab={bucketTab}
                  filtered={communityAndRefineCohort}
                  byBucketCount={byBucket.length}
                  sliceLabel={metricsAnchorLabel}
                />
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[var(--fo-border-strong)] bg-[var(--fo-panel)] shadow-[var(--fo-shadow-raised)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_8%,transparent)]">
            <div className="flex flex-col gap-4 border-b border-[var(--fo-divider)] bg-[var(--fo-paper)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
              <div
                className="inline-flex flex-wrap gap-0.5 rounded-xl border border-[var(--fo-border)] bg-[var(--fo-neutral-status-bg)] p-1 shadow-inner"
                role="tablist"
                aria-label="Pipeline stage"
              >
                {PIPELINE_BUCKET_TABS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="tab"
                    aria-selected={bucketTab === b}
                    className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
                      bucketTab === b
                        ? "bg-[var(--fo-interaction)] text-[var(--fo-on-accent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_28%,transparent)]"
                        : "text-[var(--fo-ink-body)] hover:bg-[var(--fo-paper)] hover:text-[var(--fo-title)]"
                    }`}
                    onClick={() => setBucketTab(b)}
                  >
                    {PIPELINE_BUCKET_LABEL[b]}
                    <span
                      className={`ml-1.5 tabular-nums text-xs font-bold ${
                        bucketTab === b ? "text-white/90" : "text-[var(--fo-ink-muted)]"
                      }`}
                    >
                      {items.filter((i) => i.stage === b).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--fo-interaction)] underline decoration-[color-mix(in_srgb,var(--fo-interaction)_35%,var(--fo-border))] decoration-2 underline-offset-2 transition hover:text-[var(--fo-interaction-hover)]"
                  onClick={runExpireCold}
                  disabled={pending}
                >
                  Run cold → archive sweep
                </button>
              </div>
            </div>

      {bucketTab === "triage" ? (
        <div className="border-b border-[var(--fo-divider)] bg-[var(--fo-paper)] px-5 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--fo-section-label)]">Research communities</p>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-snug text-[var(--fo-ink-body)]">
                {isPipelineCommunityFilterTab(communityTab) ? (
                  <>
                    Narrowing to{" "}
                    <span className="font-semibold text-[var(--fo-title)]">
                      {communities.find((c) => c.id === communityTab)?.label ?? "this community"}
                    </span>
                    . Switch to <span className="font-medium">All communities</span> to work through every notice on one
                    card — tag communities, pick investigators, and draft outreach without leaving the grant.
                  </>
                ) : (
                  <>
                    Each card is a full triage workspace: tag communities, select investigators from those rosters, then
                    generate and send outreach.{" "}
                    <span className="text-[var(--fo-ink-muted)]">
                      Use a community tab below to focus on one roster across cards.
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              className={`min-h-[2.75rem] max-w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold leading-snug transition-all [overflow-wrap:anywhere] sm:min-h-0 sm:px-4 ${
                communityTab === "all"
                  ? "border-2 border-[var(--fo-interaction)] bg-[var(--fo-select-tint)] text-[var(--fo-title)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_14%,transparent)]"
                  : "border border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-subpanel)]"
              }`}
              onClick={() => setCommunityTab("all")}
            >
              All communities
            </button>
            {communities.map((c, i) => {
              const stripe = stripeForIndex(i);
              const active = communityTab === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`min-h-[2.75rem] max-w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold leading-snug transition-all [overflow-wrap:anywhere] sm:min-h-0 sm:px-4 ${
                    active ? stripe.filterActive : `${stripe.filterIdle} hover:border-[var(--fo-line-hover)]`
                  }`}
                  onClick={() => setCommunityTab(c.id)}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 max-w-xl">
            <label className="text-[0.7rem] font-bold uppercase tracking-wide text-[var(--fo-ink-muted)]">
              Filter investigator names on cards
            </label>
            <input
              type="search"
              className="mt-1.5 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2 text-sm text-[var(--fo-title)] shadow-sm placeholder:text-[var(--fo-ink-faint)] focus:border-[var(--fo-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--fo-focus-ring)]"
              placeholder="Narrows rosters on every expanded card…"
              value={communityPiFilter}
              onChange={(e) => setCommunityPiFilter(e.target.value)}
              aria-label="Filter investigators by name on triage cards"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-[var(--fo-divider)] bg-[var(--fo-neutral-status-bg)] px-5 py-3 text-sm sm:px-7">
        <span className="font-bold tabular-nums text-[var(--fo-display)]">{filtered.length}</span>
        <span className="text-[var(--fo-ink-muted)]">{filtered.length === 1 ? "opportunity" : "opportunities"} in</span>
        <span className="font-semibold text-[var(--fo-display)] [overflow-wrap:anywhere]">{metricsAnchorLabel}</span>
        <span className="text-[var(--fo-ink-muted)]">·</span>
        <span className="max-w-2xl text-[var(--fo-ink-body)]">
          Same slice as the summary tiles — refine below to narrow the list.
        </span>
      </div>

      <div className="border-b border-[var(--fo-divider)] bg-[var(--fo-paper)]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--fo-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)] sm:px-7"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          aria-controls="pipeline-filters-panel"
          id="pipeline-filters-toggle"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-bold uppercase tracking-wide text-[var(--fo-display)]">Refine list</span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full border border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--fo-warn-text)]">
                {activeFilterCount} active
              </span>
            ) : (
              <span className="rounded-full border border-[var(--fo-neutral-status-border)] bg-[var(--fo-subpanel)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fo-neutral-status-text)]">
                Showing all in bucket
              </span>
            )}
          </span>
          <svg
            className={`h-5 w-5 shrink-0 text-[var(--fo-ink-muted)] transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {filtersOpen ? (
          <div id="pipeline-filters-panel" role="region" aria-labelledby="pipeline-filters-toggle" className="border-t border-[var(--fo-divider)] px-5 pb-5 pt-4 sm:px-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <label className="text-xs font-semibold text-[var(--fo-ink-body)]">
                Strategic value
                <Select className="mt-1 rounded-lg border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-title)] shadow-sm" value={fStrategic} onChange={(e) => setFStrategic(e.target.value)}>
                  <option value="all">All</option>
                  <option value="opportunistic">Opportunistic</option>
                  <option value="useful">Useful</option>
                  <option value="strategic">Strategic</option>
                  <option value="highly_strategic">Highly strategic</option>
                </Select>
              </label>
              <label className="text-xs font-semibold text-[var(--fo-ink-body)]">
                Matched PIs
                <Select className="mt-1 rounded-lg border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-title)] shadow-sm" value={fHasPis} onChange={(e) => setFHasPis(e.target.value)}>
                  <option value="all">Any</option>
                  <option value="yes">Has matches</option>
                  <option value="no">No matches</option>
                </Select>
              </label>
              <label className="text-xs font-semibold text-[var(--fo-ink-body)]">
                Outreach
                <Select className="mt-1 rounded-lg border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-title)] shadow-sm" value={fOutreach} onChange={(e) => setFOutreach(e.target.value)}>
                  <option value="all">Any</option>
                  <option value="pre_send">Not yet sent</option>
                  <option value="sent">At least one sent</option>
                  <option value="interested">Someone interested</option>
                  <option value="none">Hide with outreach</option>
                </Select>
              </label>
              <label className="text-xs font-semibold text-[var(--fo-ink-body)]">
                Owner
                <Select className="mt-1 rounded-lg border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-title)] shadow-sm" value={fOwner} onChange={(e) => setFOwner(e.target.value)}>
                  <option value="all">Anyone</option>
                  <option value="unassigned">Unassigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.full_name || p.email || p.id).trim()}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-xs font-semibold text-[var(--fo-ink-body)]">
                Sponsor contains
                <input
                  value={fSponsor}
                  onChange={(e) => setFSponsor(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2 py-1.5 text-sm text-[var(--fo-title)] shadow-sm"
                  placeholder="e.g. NIH"
                />
              </label>
              <label className="text-xs font-semibold text-[var(--fo-ink-body)]">
                Deadline from
                <input
                  type="date"
                  value={fDeadlineFrom}
                  onChange={(e) => setFDeadlineFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2 py-1.5 text-sm text-[var(--fo-title)] shadow-sm"
                />
              </label>
              <label className="text-xs font-semibold text-[var(--fo-ink-body)]">
                Deadline to
                <input
                  type="date"
                  value={fDeadlineTo}
                  onChange={(e) => setFDeadlineTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2 py-1.5 text-sm text-[var(--fo-title)] shadow-sm"
                />
              </label>
              <label className="flex items-end gap-2 pb-1 text-xs font-semibold text-[var(--fo-ink-body)]">
                <input type="checkbox" checked={fOverdue} onChange={(e) => setFOverdue(e.target.checked)} />
                Overdue next action
              </label>
            </div>
          </div>
        ) : null}
      </div>

        <div
          className={
            triageListLayout
              ? "w-full min-w-0 pb-2"
              : "flex gap-3 overflow-x-auto pb-2"
          }
        >
          <div
            className={
              triageListLayout
                ? "min-w-0 w-full bg-[var(--fo-panel)]"
                : "w-full min-w-[min(100%,22rem)] max-w-2xl shrink-0 bg-[var(--fo-panel)]"
            }
          >
            <div className="border-b border-[var(--fo-divider)] bg-[var(--fo-subpanel)] px-5 py-3 sm:px-7 sm:py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--fo-section-label)]">{boardTitle} workspace</p>
              <p className="mt-1 text-sm font-semibold text-[var(--fo-display)]">{filtered.length} opportunities</p>
            </div>
            <ul
              className={`p-4 sm:p-6 ${
                triageListLayout ? "space-y-5" : "space-y-4"
              }`}
            >
              {filtered.map((row) => {
                const fo = row.funding_opportunities;
                const title = (fo?.title ?? "").trim() || "Untitled notice";
                const matches = row.saved_opportunity_pi_matches ?? [];
                const { sent, interested, total } = outreachCardSummary(matches);
                const outreachLine =
                  total === 0 ? "No PI matches" : `${sent} sent · ${interested} interested · ${total} matched`;
                const statusLine =
                  bucketTab === "monitor"
                    ? monitorStatusLine(matches)
                    : bucketTab === "cold"
                      ? row.cold_until
                        ? `Cold until ${formatDate(row.cold_until)}`
                        : "Cold"
                      : bucketTab === "archived"
                        ? row.archived_at
                          ? `Archived ${formatDate(row.archived_at)}`
                          : "Archived"
                        : outreachLine;
                const urgency = deadlineUrgency(fo?.close_date ?? null, today);
                const ownerShort = row.owner_id ? ownerLabel.get(row.owner_id) ?? null : null;
                const triageSlot =
                  bucketTab === "triage" ? (
                    <TriageOpportunityWorkflow
                      opportunityId={row.opportunity_id}
                      row={row}
                      communities={communities}
                      fundingOpportunity={fo}
                      disabled={pending}
                      globalRosterFilter={communityPiFilter}
                      ownerLabel={ownerShort}
                      onCommunitiesUpdated={() => router.refresh()}
                      onClearCommunities={() => clearCommunityTags(row.opportunity_id)}
                    />
                  ) : null;
                const monitorSlot =
                  bucketTab === "monitor" ? (
                    <MonitorOpportunityPiPanel
                      opportunityId={row.opportunity_id}
                      matches={row.saved_opportunity_pi_matches ?? []}
                      ownerId={row.owner_id}
                      profiles={profiles}
                      disabled={pending}
                    />
                  ) : null;
                return (
                  <PipelineOpportunityBoardCard
                    key={row.opportunity_id}
                    row={row}
                    fo={fo}
                    title={title}
                    bucketTab={bucketTab}
                    urgency={urgency}
                    statusLine={statusLine}
                    ownerLabel={ownerShort}
                    sendEmailsLabel="Send outreach & monitor"
                    triageSlot={triageSlot}
                    monitorSlot={monitorSlot}
                    workflowExpanded={expandedMonitorOpportunityId === row.opportunity_id}
                    onWorkflowToggle={() =>
                      setExpandedMonitorOpportunityId((prev) =>
                        prev === row.opportunity_id ? null : row.opportunity_id
                      )
                    }
                    onSendEmails={() => moveToMonitor(row.opportunity_id, { switchToMonitorTab: true })}
                    onMoveMonitor={() => moveToMonitor(row.opportunity_id, { switchToMonitorTab: true })}
                    onStageChange={(s) => setStage(row.opportunity_id, s)}
                    pending={pending}
                  />
                );
              })}
            </ul>
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
