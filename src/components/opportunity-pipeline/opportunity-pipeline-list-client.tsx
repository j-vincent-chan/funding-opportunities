"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  expireMonitorAwaitingToColdAction,
  expireStaleColdOpportunitiesAction,
  moveOpportunityToColdAction,
  setSavedOpportunityCommunitiesAction,
  updateSavedOpportunityPipelineAction,
} from "@/app/actions/opportunity-pipeline-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { PipelineListMetricsRow } from "@/components/opportunity-pipeline/pipeline-list-metrics-row";
import { PipelineListNextActionsCard } from "@/components/opportunity-pipeline/pipeline-list-next-actions-card";
import { MonitorOpportunityPiPanel } from "@/components/opportunity-pipeline/monitor-opportunity-pi-panel";
import {
  TriageCommunityPiPanel,
  type CommunityInvestigatorHit,
} from "@/components/opportunity-pipeline/triage-community-pi-panel";
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

/** A named research community is selected (not Untagged / All). */
function isPipelineCommunityFilterTab(tab: string): boolean {
  return tab !== "none" && tab !== "all";
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

function TriageOpportunityCommunities({
  opportunityId,
  row,
  communities,
  disabled,
  onUpdated,
  compact = false,
}: {
  opportunityId: string;
  row: NormalizedPipelineItem;
  communities: PipelineCommunityRef[];
  disabled: boolean;
  onUpdated: () => void;
  compact?: boolean;
}) {
  const ids = row.communities.map((c) => c.id);
  const selected = new Set(ids);
  const [pending, startTransition] = useTransition();

  function toggle(cid: string) {
    const next = selected.has(cid) ? ids.filter((x) => x !== cid) : [...ids, cid];
    startTransition(async () => {
      const r = await setSavedOpportunityCommunitiesAction({
        opportunityId,
        communityIds: next,
      });
      if (!r.ok) window.alert(r.error);
      else onUpdated();
    });
  }

  const chipBase =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-md border font-medium transition-colors duration-150";
  const chipSize = compact
    ? "max-w-full px-2 py-0.5 text-[0.6875rem] leading-snug [overflow-wrap:anywhere]"
    : "px-2.5 py-1 text-xs leading-snug [overflow-wrap:anywhere]";

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-2"}`}>
      {!compact ? (
        <span className="w-full text-[0.65rem] font-bold uppercase tracking-wide text-[var(--fo-ink-muted)]">Tag communities</span>
      ) : null}
      {communities.map((c, idx) => {
        const checked = selected.has(c.id);
        const stripe = stripeForIndex(idx);
        return (
          <label
            key={c.id}
            className={`${chipBase} ${chipSize} ${
              checked ? `${stripe.chipOn} hover:opacity-[0.98]` : `${stripe.chipOff} hover:brightness-[0.99]`
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border-[var(--fo-border)] text-[var(--fo-interaction)] focus:ring-2 focus:ring-[var(--fo-focus-ring)]"
              checked={checked}
              disabled={disabled || pending}
              onChange={() => toggle(c.id)}
            />
            {c.label}
          </label>
        );
      })}
    </div>
  );
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
  const [communityTab, setCommunityTab] = useState<string>("none");
  const [communityPiFilter, setCommunityPiFilter] = useState("");
  const [communityRoster, setCommunityRoster] = useState<CommunityInvestigatorHit[]>([]);
  const [communityRosterLoading, setCommunityRosterLoading] = useState(false);
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
  /** Board: at most one opportunity workflow (PI triage / communities) expanded at a time. */
  const [expandedWorkflowOpportunityId, setExpandedWorkflowOpportunityId] = useState<string | null>(null);

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
      setCommunityRoster([]);
      setCommunityPiFilter("");
      setCommunityRosterLoading(false);
      return;
    }
    setCommunityPiFilter("");
    let cancelled = false;
    setCommunityRosterLoading(true);
    void (async () => {
      try {
        const r = await fetch(`/api/investigators/search?communityId=${encodeURIComponent(communityTab)}`);
        const j = (await r.json()) as { results?: CommunityInvestigatorHit[]; error?: string };
        if (!cancelled) setCommunityRoster(j.error ? [] : j.results ?? []);
      } catch {
        if (!cancelled) setCommunityRoster([]);
      } finally {
        if (!cancelled) setCommunityRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityTab]);

  const filteredCommunityRoster = useMemo(() => {
    const q = communityPiFilter.trim().toLowerCase();
    if (!q) return communityRoster;
    return communityRoster.filter((x) => (x.full_name ?? "").toLowerCase().includes(q));
  }, [communityRoster, communityPiFilter]);

  const today = new Date().toISOString().slice(0, 10);

  const byBucket = useMemo(() => {
    return items.filter((row) => row.stage === bucketTab);
  }, [items, bucketTab]);

  /** First metrics tile: community / untagged context (stable across Triage · Monitor · Cold · Archived). */
  const metricsAnchorLabel = useMemo(() => {
    if (communityTab === "none") return "Untagged";
    if (communityTab === "all") return "All communities";
    const c = communities.find((x) => x.id === communityTab);
    if (c) return c.label;
    return PIPELINE_BUCKET_LABEL[bucketTab];
  }, [communityTab, communities, bucketTab]);

  const metricsAnchorEyebrow = useMemo(() => {
    if (communityTab === "none") return "Without community tags";
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
    if (communityTab === "none") {
      list = items.filter((r) => r.communities.length === 0);
    } else if (communityTab === "all") {
      list = items.filter((r) => r.communities.length > 0);
    } else if (isPipelineCommunityFilterTab(communityTab)) {
      list = items.filter((r) => r.communities.some((c) => c.id === communityTab));
    }
    return list.filter((row) => passesRefineFilters(row, refineFilterArgs));
  }, [items, communityTab, refineFilterArgs]);

  const filtered = useMemo(() => {
    let list = byBucket;
    if (bucketTab === "triage" && communityTab !== "all") {
      if (communityTab === "none") {
        list = list.filter((r) => r.communities.length === 0);
      } else {
        list = list.filter((r) => r.communities.some((c) => c.id === communityTab));
      }
    }
    return list.filter((row) => passesRefineFilters(row, refineFilterArgs));
  }, [byBucket, bucketTab, communityTab, refineFilterArgs]);

  /** Context summary metrics: Untagged shows only a total + dash placeholders; named community / All use full overlap counts on the cohort above. */
  const contextMetrics = useMemo(() => {
    const cohort = communityAndRefineCohort;
    const secondaryNa = communityTab === "none";
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
    return { sliceTotal, piLinked, contacted, interested, assigned, overdue, secondaryNa };
  }, [communityAndRefineCohort, communityTab, today]);

  useEffect(() => {
    setExpandedWorkflowOpportunityId(null);
  }, [bucketTab, communityTab]);

  useEffect(() => {
    if (
      expandedWorkflowOpportunityId &&
      !filtered.some((r) => r.opportunity_id === expandedWorkflowOpportunityId)
    ) {
      setExpandedWorkflowOpportunityId(null);
    }
  }, [filtered, expandedWorkflowOpportunityId]);

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
    if (!contextMetrics.secondaryNa) {
      if (contextMetrics.overdue > 0) parts.push(`${contextMetrics.overdue} overdue in context slice`);
      if (contextMetrics.interested > 0) parts.push(`${contextMetrics.interested} with interested PI in context slice`);
    }
    return parts.join(" · ");
  }, [items, contextMetrics.interested, contextMetrics.overdue, contextMetrics.secondaryNa]);

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

  function moveToCold(oppId: string) {
    startTransition(async () => {
      const r = await moveOpportunityToColdAction({ opportunityId: oppId });
      if (!r.ok) window.alert(r.error);
      else router.refresh();
    });
  }

  /** Clears assigned communities so the card returns to Untagged for a full re-tag pass. */
  function sendToUntaggedForRetag(oppId: string) {
    startTransition(async () => {
      const r = await setSavedOpportunityCommunitiesAction({
        opportunityId: oppId,
        communityIds: [],
      });
      if (!r.ok) window.alert(r.error);
      else {
        setCommunityTab("none");
        router.refresh();
      }
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

  /** Triage while a named community is selected: one column of cards + aside for future AI suggestions. */
  const triageCommunityPiMode = bucketTab === "triage" && isPipelineCommunityFilterTab(communityTab);

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
          <div className="grid gap-6 rounded-2xl border border-[var(--fo-border-strong)] bg-[var(--fo-panel-shelf)] p-5 shadow-inner ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_7%,transparent)] lg:grid-cols-[1fr_min(22rem,100%)] lg:items-stretch lg:gap-8 lg:p-7">
            <PipelineListMetricsRow
              anchorEyebrow={metricsAnchorEyebrow}
              anchorLabel={metricsAnchorLabel}
              anchorFootnote={
                communityTab === "none"
                  ? "Notices without a research community tag (refine filters)"
                  : "All pipeline stages · refine filters"
              }
              sliceTotal={contextMetrics.sliceTotal}
              piLinked={contextMetrics.piLinked}
              contacted={contextMetrics.contacted}
              interested={contextMetrics.interested}
              assigned={contextMetrics.assigned}
              overdue={contextMetrics.overdue}
              secondaryDisplay={contextMetrics.secondaryNa ? "na" : "numbers"}
              summaryHint={
                communityTab === "none"
                  ? undefined
                  : communityTab === "all"
                    ? "Every notice with at least one research community tag — same cohort across Triage, Monitor, Cold, and Archived (refine filters apply). Counts overlap."
                    : `Same "${metricsAnchorLabel}" cohort across Triage, Monitor, Cold, and Archived (refine filters apply). Counts overlap — one opportunity can be PI linked, contacted, assigned, and overdue at the same time.`
              }
            />
            <PipelineListNextActionsCard
              bucketTab={bucketTab}
              filtered={communityAndRefineCohort}
              byBucketCount={byBucket.length}
              sliceLabel={metricsAnchorLabel}
            />
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
                    Shortlisting in{" "}
                    <span className="font-semibold text-[var(--fo-title)]">
                      {communities.find((c) => c.id === communityTab)?.label ?? "this community"}
                    </span>
                    . Switch to <span className="font-medium">Untagged</span> or <span className="font-medium">All</span> to
                    tag which communities apply to each notice.
                  </>
                ) : (
                  <>
                    Tag each card, then pick a community to open PI shortlists for that roster.{" "}
                    <span className="text-[var(--fo-ink-muted)]">Untagged surfaces notices still missing tags.</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              className={`min-h-[2.75rem] max-w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold leading-snug transition-all [overflow-wrap:anywhere] sm:min-h-0 sm:px-4 ${
                communityTab === "none"
                  ? "border-2 border-[var(--fo-interaction)] bg-[var(--fo-select-tint)] text-[var(--fo-title)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_14%,transparent)]"
                  : "border border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-subpanel)]"
              }`}
              onClick={() => setCommunityTab("none")}
            >
              Untagged
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
          </div>
          {isPipelineCommunityFilterTab(communityTab) ? (
            <div className="mt-4 max-w-xl">
              <label className="text-[0.7rem] font-bold uppercase tracking-wide text-[var(--fo-ink-muted)]">Filter roster names</label>
              <input
                type="search"
                className="mt-1.5 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2 text-sm text-[var(--fo-title)] shadow-sm placeholder:text-[var(--fo-ink-faint)] focus:border-[var(--fo-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--fo-focus-ring)]"
                placeholder="Narrows checklists on every card…"
                value={communityPiFilter}
                onChange={(e) => setCommunityPiFilter(e.target.value)}
                aria-label="Filter investigators by name within the selected community"
              />
              <p className="mt-1.5 text-xs font-medium text-[var(--fo-ink-muted)]">
                {communityRosterLoading
                  ? "Loading directory…"
                  : `${filteredCommunityRoster.length} shown · ${communityRoster.length} in community`}
              </p>
            </div>
          ) : null}
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
            triageCommunityPiMode
              ? "flex w-full min-w-0 flex-col gap-8 pb-4 lg:gap-10"
              : bucketTab === "triage"
                ? "w-full min-w-0 pb-2"
                : "flex gap-3 overflow-x-auto pb-2"
          }
        >
          <div
            className={
              triageCommunityPiMode || bucketTab === "triage"
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
                triageCommunityPiMode
                  ? "space-y-5"
                  : bucketTab === "triage"
                    ? "grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 lg:gap-8"
                    : "space-y-4"
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
                    isPipelineCommunityFilterTab(communityTab) ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-[var(--fo-border)] bg-[var(--fo-inset)] px-3 py-2.5 sm:px-4">
                          <p className="text-xs text-[var(--fo-ink-body)]">
                            Need to retag communities for this opportunity?
                          </p>
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center rounded-md border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-1 text-xs font-semibold text-[var(--fo-title)] shadow-sm transition hover:border-[var(--fo-border-strong)] hover:bg-[var(--fo-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)]"
                            disabled={pending}
                            onClick={() => sendToUntaggedForRetag(row.opportunity_id)}
                          >
                            Send to Untagged to re-tag
                          </button>
                        </div>
                        <TriageCommunityPiPanel
                          opportunityId={row.opportunity_id}
                          communityLabel={communities.find((c) => c.id === communityTab)?.label ?? "Community"}
                          roster={filteredCommunityRoster}
                          rosterLoading={communityRosterLoading}
                          matches={row.saved_opportunity_pi_matches ?? []}
                          fundingOpportunity={fo}
                          whyMatters={row.why_matters}
                          internalNotes={row.internal_notes}
                          disabled={pending}
                          ownerLabel={ownerShort}
                          stage={row.stage}
                          opportunityCommunities={row.communities}
                          hideHeader
                        />
                      </div>
                    ) : (
                      <TriageOpportunityCommunities
                        opportunityId={row.opportunity_id}
                        row={row}
                        communities={communities}
                        disabled={pending}
                        onUpdated={() => router.refresh()}
                      />
                    )
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
                    workflowExpanded={expandedWorkflowOpportunityId === row.opportunity_id}
                    onWorkflowToggle={() =>
                      setExpandedWorkflowOpportunityId((prev) =>
                        prev === row.opportunity_id ? null : row.opportunity_id
                      )
                    }
                    onSendEmails={() => moveToMonitor(row.opportunity_id, { switchToMonitorTab: true })}
                    onMoveMonitor={() => moveToMonitor(row.opportunity_id, { switchToMonitorTab: true })}
                    onCold={() => moveToCold(row.opportunity_id)}
                    onStageChange={(s) => setStage(row.opportunity_id, s)}
                    pending={pending}
                  />
                );
              })}
            </ul>
          </div>
          {triageCommunityPiMode ? (
            <aside
              className="min-w-0 rounded-xl border border-dashed border-[var(--fo-border)] bg-[color-mix(in_srgb,var(--fo-paper)_92%,var(--fo-inset))] px-5 py-4 sm:flex sm:items-start sm:gap-6 sm:px-7 sm:py-5"
              aria-label="Suggested PI matches (coming soon)"
            >
              <div className="shrink-0 sm:pt-0.5">
                <p className="text-sm font-semibold text-[var(--fo-title)]">Suggested matches</p>
                <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--fo-ink-muted)]">Coming soon</p>
              </div>
              <div className="mt-3 min-w-0 sm:mt-0">
                <p className="text-sm leading-relaxed text-[var(--fo-ink-body)]">
                  Soon: an AI pass over this community&apos;s directory and the notice text to surface fit-ranked PIs beside
                  your manual shortlist.
                </p>
                <p className="mt-2 text-xs text-[var(--fo-ink-muted)]">
                  For now, use each card&apos;s checklist and the roster filter above.
                </p>
              </div>
            </aside>
          ) : null}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
