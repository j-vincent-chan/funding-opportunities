"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { setSavedOpportunityCommunitiesAction } from "@/app/actions/opportunity-pipeline-actions";
import { matchInvestigatorRosterQuery } from "@/lib/opportunity-pipeline/investigator-workflow";
import type { PipelineStage } from "@/lib/opportunity-pipeline/constants";
import type { PipelineCommunityRef, NormalizedPipelineItem, PipelineFundingRow } from "@/lib/opportunity-pipeline/serializers";
import {
  TriageCommunityPiPanel,
  type CommunityInvestigatorHit,
} from "@/components/opportunity-pipeline/triage-community-pi-panel";

const COMMUNITY_CHIP_ON =
  "rounded-md border border-[var(--fo-interaction)] bg-[var(--fo-select-tint)] text-[var(--fo-title)] font-semibold shadow-sm";

const COMMUNITY_STRIPES = [
  {
    chipOff:
      "rounded-md border border-[var(--fo-neutral-status-border)] bg-[var(--fo-paper)] pl-2 pr-2 py-0.5 text-[var(--fo-ink-body)] border-l-[3px] border-l-[var(--fo-stripe-0)]",
    chipOn: COMMUNITY_CHIP_ON,
  },
  {
    chipOff:
      "rounded-md border border-[var(--fo-neutral-status-border)] bg-[var(--fo-paper)] pl-2 pr-2 py-0.5 text-[var(--fo-ink-body)] border-l-[3px] border-l-[var(--fo-stripe-1)]",
    chipOn: COMMUNITY_CHIP_ON,
  },
  {
    chipOff:
      "rounded-md border border-[var(--fo-neutral-status-border)] bg-[var(--fo-paper)] pl-2 pr-2 py-0.5 text-[var(--fo-ink-body)] border-l-[3px] border-l-[var(--fo-stripe-2)]",
    chipOn: COMMUNITY_CHIP_ON,
  },
] as const;

function stripeForIndex(i: number) {
  return COMMUNITY_STRIPES[i % COMMUNITY_STRIPES.length]!;
}

function TriageOpportunityCommunities({
  opportunityId,
  row,
  communities,
  disabled,
  onUpdated,
  onSaved,
}: {
  opportunityId: string;
  row: NormalizedPipelineItem;
  communities: PipelineCommunityRef[];
  disabled: boolean;
  onUpdated: (communityIds: string[]) => void;
  onSaved: () => void;
}) {
  const serverIds = useMemo(() => row.communities.map((c) => c.id), [row.communities]);
  const [localIds, setLocalIds] = useState(serverIds);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLocalIds(serverIds);
  }, [opportunityId, serverIds]);

  const selected = new Set(localIds);

  function toggle(cid: string) {
    const next = selected.has(cid) ? localIds.filter((x) => x !== cid) : [...localIds, cid];
    setLocalIds(next);
    onUpdated(next);
    startTransition(async () => {
      const r = await setSavedOpportunityCommunitiesAction({
        opportunityId,
        communityIds: next,
      });
      if (!r.ok) {
        setLocalIds(serverIds);
        onUpdated(serverIds);
        window.alert(r.error);
      } else {
        onSaved();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="w-full text-[0.65rem] font-bold uppercase tracking-wide text-[var(--fo-ink-muted)]">
        Step 1 · Tag communities
      </span>
      {communities.map((c, idx) => {
        const checked = selected.has(c.id);
        const stripe = stripeForIndex(idx);
        return (
          <label
            key={c.id}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium leading-snug transition-colors duration-150 [overflow-wrap:anywhere] ${
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

async function fetchCommunityRoster(communityId: string): Promise<CommunityInvestigatorHit[]> {
  const r = await fetch(`/api/investigators/search?communityId=${encodeURIComponent(communityId)}`);
  const j = (await r.json()) as { results?: CommunityInvestigatorHit[]; error?: string };
  return j.error ? [] : j.results ?? [];
}

export function TriageOpportunityWorkflow({
  opportunityId,
  row,
  communities,
  fundingOpportunity,
  disabled,
  globalRosterFilter = "",
  ownerLabel = null,
  onCommunitiesUpdated,
  onClearCommunities,
}: {
  opportunityId: string;
  row: NormalizedPipelineItem;
  communities: PipelineCommunityRef[];
  fundingOpportunity: PipelineFundingRow | null;
  disabled: boolean;
  globalRosterFilter?: string;
  ownerLabel?: string | null;
  onCommunitiesUpdated: () => void;
  onClearCommunities: () => void;
}) {
  const serverCommunityIds = useMemo(() => row.communities.map((c) => c.id), [row.communities]);
  const serverCommunityKey = serverCommunityIds.join(",");
  const [activeCommunityIds, setActiveCommunityIds] = useState(serverCommunityIds);

  useEffect(() => {
    setActiveCommunityIds(serverCommunityIds);
  }, [opportunityId, serverCommunityKey, serverCommunityIds]);

  const taggedCommunities = useMemo(
    () => communities.filter((c) => activeCommunityIds.includes(c.id)),
    [communities, activeCommunityIds]
  );
  const communityLabel =
    taggedCommunities.length > 0 ? taggedCommunities.map((c) => c.label).join(" · ") : "Tagged communities";

  const [roster, setRoster] = useState<CommunityInvestigatorHit[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const activeCommunityKey = activeCommunityIds.join(",");

  useEffect(() => {
    if (activeCommunityIds.length === 0) {
      setRoster([]);
      setRosterLoading(false);
      return;
    }

    let cancelled = false;
    setRosterLoading(true);

    void (async () => {
      try {
        const batches = await Promise.all(
          taggedCommunities.map(async (community) => {
            const hits = await fetchCommunityRoster(community.id);
            return hits.map((hit) => ({
              ...hit,
              community_label: community.label,
            }));
          })
        );

        if (cancelled) return;

        const byId = new Map<string, CommunityInvestigatorHit>();
        for (const hit of batches.flat()) {
          const existing = byId.get(hit.id);
          if (!existing) {
            byId.set(hit.id, hit);
            continue;
          }
          const labels = new Set(
            [existing.community_label, hit.community_label].filter(Boolean) as string[]
          );
          byId.set(hit.id, {
            ...existing,
            community_label: [...labels].join(" · "),
          });
        }

        setRoster(
          [...byId.values()].sort((a, b) =>
            (a.full_name ?? "").localeCompare(b.full_name ?? "", undefined, { sensitivity: "base" })
          )
        );
      } catch {
        if (!cancelled) setRoster([]);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCommunityKey, activeCommunityIds.length, taggedCommunities]);

  const filteredRoster = useMemo(() => {
    if (!globalRosterFilter.trim()) return roster;
    return roster.filter((r) =>
      matchInvestigatorRosterQuery(r.full_name ?? "", r.email, globalRosterFilter, [
        r.community_label ?? "",
      ])
    );
  }, [roster, globalRosterFilter]);

  return (
    <div className="space-y-5">
      <TriageOpportunityCommunities
        opportunityId={opportunityId}
        row={row}
        communities={communities}
        disabled={disabled}
        onUpdated={(communityIds) => setActiveCommunityIds(communityIds)}
        onSaved={onCommunitiesUpdated}
      />

      {activeCommunityIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--fo-border)] bg-[var(--fo-inset)] px-4 py-4">
          <p className="text-sm font-semibold text-[var(--fo-display)]">Step 2 · Select investigators</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--fo-ink-muted)]">
            Tag at least one research community above to unlock rosters from those directories on this card.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--fo-ink-muted)]">
              Step 2 · Select investigators · Step 3 · Draft outreach
            </p>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-1 text-xs font-semibold text-[var(--fo-title)] shadow-sm transition hover:border-[var(--fo-border-strong)] hover:bg-[var(--fo-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)]"
              disabled={disabled}
              onClick={onClearCommunities}
            >
              Clear community tags
            </button>
          </div>
          <TriageCommunityPiPanel
            opportunityId={opportunityId}
            communityLabel={communityLabel}
            roster={filteredRoster}
            rosterLoading={rosterLoading}
            matches={row.saved_opportunity_pi_matches ?? []}
            fundingOpportunity={fundingOpportunity}
            whyMatters={row.why_matters}
            internalNotes={row.internal_notes}
            disabled={disabled}
            ownerLabel={ownerLabel}
            stage={row.stage as PipelineStage}
            opportunityCommunities={row.communities}
            hideHeader
            showCommunityOnRoster={taggedCommunities.length > 1}
            researchCommunities={taggedCommunities.map((c) => ({ id: c.id, label: c.label }))}
            defaultResearchCommunityId={taggedCommunities[0]?.id ?? null}
            onInvestigatorCreated={(hit) => {
              setRoster((prev) => {
                if (prev.some((r) => r.id === hit.id)) return prev;
                return [...prev, hit].sort((a, b) =>
                  (a.full_name ?? "").localeCompare(b.full_name ?? "", undefined, { sensitivity: "base" })
                );
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
