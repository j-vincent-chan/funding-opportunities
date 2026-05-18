"use client";

import Link from "next/link";
import { SaveFundingOpportunityButton } from "@/components/funding/save-funding-opportunity-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PIPELINE_STAGE_LABEL, PIPELINE_STAGES, type PipelineStage } from "@/lib/opportunity-pipeline/constants";
import { formatDate } from "@/lib/formatting/dates";
import type { PipelineCommunityRef } from "@/lib/opportunity-pipeline/serializers";

type ProfileRow = { id: string; full_name: string | null; email: string | null };

export function PipelineOpportunityHeader({
  opportunityId,
  title,
  sponsorLine,
  activityCode,
  closeDate,
  opportunityStatus,
  stage,
  onStageChange,
  ownerId,
  onOwnerChange,
  profiles,
  communities,
  pending,
  onSave,
  externalUrl,
  onMoveToMonitor,
  onMoveToCold,
  onArchive,
  triageAdvanceLabel,
}: {
  opportunityId: string;
  title: string;
  sponsorLine: string;
  activityCode: string | null;
  closeDate: string | null;
  opportunityStatus: string | null;
  stage: PipelineStage;
  onStageChange: (s: PipelineStage) => void;
  ownerId: string;
  onOwnerChange: (id: string) => void;
  profiles: ProfileRow[];
  communities: PipelineCommunityRef[];
  pending: boolean;
  onSave: () => void;
  externalUrl: string | null;
  onMoveToMonitor: () => void;
  onMoveToCold: () => void;
  onArchive: () => void;
  triageAdvanceLabel: string;
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-stone-300/90 bg-white shadow-md ring-1 ring-stone-950/[0.06]">
      <div className="border-b border-stone-200/90 bg-gradient-to-br from-stone-50 via-white to-amber-50/30 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <Link
              href="/match/saved"
              className="text-xs font-semibold text-stone-500 transition hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50"
            >
              ← Pipeline
            </Link>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl [overflow-wrap:anywhere]">
              {title}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-stone-700">{sponsorLine}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
              {activityCode ? (
                <span>
                  <span className="font-semibold text-stone-800">Activity</span> {activityCode}
                </span>
              ) : null}
              <span>
                <span className="font-semibold text-stone-800">Deadline</span> {formatDate(closeDate)}
              </span>
              {opportunityStatus ? (
                <span>
                  <span className="font-semibold text-stone-800">Notice</span> {opportunityStatus}
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="info" className="border-sky-200/90 !bg-sky-50/90 !text-sky-950">
                {PIPELINE_STAGE_LABEL[stage]}
              </Badge>
              {communities.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2 py-0.5 text-xs font-semibold text-emerald-950"
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:max-w-md lg:w-80">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                Stage
                <Select
                  className="mt-1 w-full rounded-lg border-stone-300 bg-white text-sm font-medium text-stone-900 shadow-sm"
                  value={stage}
                  onChange={(e) => onStageChange(e.target.value as PipelineStage)}
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {PIPELINE_STAGE_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                Owner
                <Select
                  className="mt-1 w-full rounded-lg border-stone-300 bg-white text-sm font-medium text-stone-900 shadow-sm"
                  value={ownerId}
                  onChange={(e) => onOwnerChange(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.full_name || p.email || p.id).trim()}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={onSave} className="min-h-[2.5rem] flex-1 sm:flex-none">
                Save
              </Button>
              <SaveFundingOpportunityButton opportunityId={opportunityId} initiallySaved />
              <Link
                href={`/funding-opportunities/${opportunityId}`}
                className="inline-flex min-h-[2.5rem] flex-1 items-center justify-center rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50 sm:flex-none"
              >
                Edit in search
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-stone-200/80 pt-3">
              <Button type="button" variant="secondary" disabled={pending || stage !== "triage"} onClick={onMoveToMonitor}>
                {triageAdvanceLabel}
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={onMoveToCold}>
                Cold
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={onArchive}>
                Archive
              </Button>
              {externalUrl ? (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-transparent px-2 text-sm font-semibold text-[var(--fo-interaction)] underline-offset-2 hover:underline"
                >
                  External source
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
