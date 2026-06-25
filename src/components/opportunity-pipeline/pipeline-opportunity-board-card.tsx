"use client";

import Link from "next/link";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PIPELINE_STAGE_LABEL, type PipelineBucketTab, type PipelineStage } from "@/lib/opportunity-pipeline/constants";
import { piPortfolioSummary, type DeadlineUrgency } from "@/lib/opportunity-pipeline/pipeline-list-card-meta";
import { formatDate } from "@/lib/formatting/dates";
import type { NormalizedPipelineItem, PipelineFundingRow } from "@/lib/opportunity-pipeline/serializers";

const piToneWrap: Record<string, string> = {
  empty: "border-[var(--fo-neutral-status-border)] bg-[var(--fo-inset)]",
  warm: "border-[var(--fo-neutral-status-border)] bg-[var(--fo-inset)]",
  active: "border-[var(--fo-border)] bg-[var(--fo-select-tint)]",
  hot: "border-[var(--fo-success-border)] bg-[var(--fo-success-bg)]",
};

function ChevronIcon({ open, className = "h-4 w-4" }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className} shrink-0 text-[var(--fo-ink-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PipelineOpportunityBoardCard({
  row,
  fo,
  title,
  bucketTab,
  urgency,
  statusLine,
  ownerLabel,
  triageSlot,
  monitorSlot = null,
  workflowExpanded = false,
  onWorkflowToggle,
  onSendEmails,
  onMoveMonitor,
  onStageChange,
  pending,
  sendEmailsLabel,
}: {
  row: NormalizedPipelineItem;
  fo: PipelineFundingRow | null;
  title: string;
  bucketTab: PipelineBucketTab;
  urgency: DeadlineUrgency;
  statusLine: string;
  ownerLabel: string | null;
  triageSlot: ReactNode;
  /** Expanded workflow for Monitor bucket (PI response + owner). Triage workflow is always visible. */
  monitorSlot?: ReactNode | null;
  workflowExpanded?: boolean;
  onWorkflowToggle?: () => void;
  onSendEmails: () => void;
  onMoveMonitor: () => void;
  onStageChange: (stage: PipelineStage) => void;
  pending: boolean;
  sendEmailsLabel: string;
}) {
  const matches = row.saved_opportunity_pi_matches ?? [];
  const pi = piPortfolioSummary(matches);
  const agency = (fo?.agency ?? "").trim() || "—";
  const instrument = (fo?.funding_instrument ?? "").trim();
  const triageWorkflowAlwaysOpen = bucketTab === "triage" && Boolean(triageSlot);
  const canExpandMonitorWorkflow = Boolean(monitorSlot) && bucketTab === "monitor";

  /** True for real controls — not the expandable region wrapper (previously role=button matched every click). */
  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        "a[href],button,input,select,textarea,label,summary,[contenteditable='true']"
      )
    );
  }

  function toggleWorkflowFromCard() {
    if (!canExpandMonitorWorkflow || !onWorkflowToggle) return;
    onWorkflowToggle();
  }

  function handleCardClick(e: MouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(e.target)) return;
    toggleWorkflowFromCard();
  }

  function handleCardKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isInteractiveTarget(e.target)) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleWorkflowFromCard();
    }
  }

  const triageLayout = bucketTab === "triage";
  /** Monitor list reads cleaner with title + owner stacked (no side-by-side header). */
  const monitorHeaderSingleColumn = bucketTab === "monitor";

  return (
    <li className="group relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--fo-border-strong)] bg-[var(--fo-paper)] shadow-[var(--fo-shadow-raised)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_8%,transparent)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.09)] hover:ring-[color-mix(in_srgb,var(--fo-ink)_11%,transparent)]">
      <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={`flex min-h-0 flex-1 flex-col rounded-2xl transition-colors duration-150 ${
              canExpandMonitorWorkflow
                ? "cursor-pointer hover:bg-[color-mix(in_srgb,var(--fo-inset)_88%,var(--fo-paper))] focus-within:bg-[color-mix(in_srgb,var(--fo-inset)_94%,var(--fo-paper))] focus-visible:bg-[color-mix(in_srgb,var(--fo-inset)_94%,var(--fo-paper))]"
                : ""
            }`}
            role={canExpandMonitorWorkflow ? "group" : undefined}
            tabIndex={canExpandMonitorWorkflow ? 0 : undefined}
            aria-label={
              canExpandMonitorWorkflow
                ? `Opportunity summary — click empty space or press Enter to ${workflowExpanded ? "collapse" : "expand"} PI workflow`
                : undefined
            }
            onClick={handleCardClick}
            onKeyDown={handleCardKeyDown}
          >
            <div className={`h-1 w-full shrink-0 ${urgency.barClass}`} aria-hidden />
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6 lg:p-7">
          <div
            className={
              monitorHeaderSingleColumn
                ? "grid grid-cols-1 gap-3"
                : "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(7.5rem,10rem)] sm:items-start sm:gap-x-4"
            }
          >
            <div className="min-w-0">
              <Link
                href={`/match/saved/${row.opportunity_id}`}
                className="block text-[0.9375rem] font-semibold leading-snug text-[var(--fo-display)] underline-offset-2 transition hover:text-[var(--fo-interaction)] hover:underline [overflow-wrap:anywhere] sm:text-base"
                onClick={(e) => e.stopPropagation()}
              >
                {title}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums ${urgency.badgeClass}`}>
                  {urgency.badge}
                </span>
                {canExpandMonitorWorkflow ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2 py-1 text-xs font-semibold text-[var(--fo-ink-body)] shadow-sm transition hover:border-[var(--fo-border-strong)] hover:bg-[var(--fo-row-hover)] hover:text-[var(--fo-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)]"
                    aria-expanded={workflowExpanded}
                    aria-label={`${workflowExpanded ? "Collapse" : "Expand"} PI workflow panel`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWorkflowFromCard();
                    }}
                  >
                    <ChevronIcon open={workflowExpanded} className="h-4 w-4" />
                    <span className="hidden sm:inline">{workflowExpanded ? "Hide" : "Expand"}</span>
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-sm font-semibold text-[var(--fo-metadata)]">{agency}</p>
              {instrument ? <p className="mt-0.5 text-xs text-[var(--fo-ink-muted)]">{instrument}</p> : null}
            </div>
            <div className={`shrink-0 text-left ${monitorHeaderSingleColumn ? "" : "sm:text-right"}`}>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--fo-ink-muted)]">Owner</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--fo-display)]">{ownerLabel ?? "Unassigned"}</p>
              {row.next_action?.trim() ? (
                <p
                  className={
                    monitorHeaderSingleColumn
                      ? "mt-2 max-w-[14rem] text-left text-xs leading-snug text-[var(--fo-ink-muted)]"
                      : "mt-2 max-w-[14rem] text-left text-xs leading-snug text-[var(--fo-ink-muted)] sm:ml-auto sm:text-right"
                  }
                >
                  <span className="font-semibold text-[var(--fo-ink-body)]">Next: </span>
                  {row.next_action.trim()}
                </p>
              ) : null}
              {row.next_action_date ? (
                <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--fo-metadata)]">Due {formatDate(row.next_action_date)}</p>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {row.communities.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {row.communities.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--fo-neutral-status-border)] bg-[var(--fo-neutral-status-bg)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--fo-neutral-status-text)] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-sm before:bg-[var(--fo-ink-muted)] before:content-['']"
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            ) : bucketTab === "triage" ? (
              <p className="mt-3 inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-lg border border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] px-2.5 py-1.5 text-xs leading-snug text-[var(--fo-warn-text)]">
                <span className="font-semibold">Needs communities</span>
                <span className="opacity-90">Tag below to route and suggest PIs.</span>
              </p>
            ) : null}

            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <div className={`flex min-h-0 flex-1 flex-col rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${piToneWrap[pi.tone] ?? piToneWrap.warm}`}>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--fo-section-label)]">Investigator state</p>
                <p className={`mt-1 text-sm font-semibold ${pi.tone === "hot" ? "text-[var(--fo-success-text)]" : "text-[var(--fo-display)]"}`}>
                  {pi.headline}
                </p>
                <p className={`mt-0.5 text-xs leading-relaxed ${pi.tone === "hot" ? "text-[var(--fo-success-text)]/90" : "text-[var(--fo-ink-body)]"}`}>
                  {pi.detail}
                </p>
                {triageLayout ? <div className="min-h-[1rem] flex-1" aria-hidden /> : null}
              </div>
            </div>

            {bucketTab !== "triage" ? (
              <p className="mt-3 text-sm font-medium text-[var(--fo-ink-body)]">
                <span className="text-[var(--fo-ink-muted)]">Status · </span>
                {statusLine}
              </p>
            ) : null}

            {triageWorkflowAlwaysOpen ? (
              <div
                className="mt-6 min-h-0 shrink-0 border-t border-[var(--fo-divider)] pt-5 sm:mt-8 sm:pt-6"
                onClick={(e) => e.stopPropagation()}
              >
                {triageSlot}
              </div>
            ) : null}
            {monitorSlot && workflowExpanded ? (
              <div
                className="mt-6 min-h-0 shrink-0 border-t border-[var(--fo-divider)] pt-5 sm:mt-8 sm:pt-6"
                onClick={(e) => e.stopPropagation()}
              >
                {monitorSlot}
              </div>
            ) : null}
          </div>
            </div>
          </div>

      <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-[var(--fo-divider)] bg-[var(--fo-inset)] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {bucketTab === "triage" ? (
            <>
              {row.communities.length > 0 ? (
                <Button type="button" disabled={pending} className="text-xs font-semibold sm:min-h-[2.25rem]" onClick={onSendEmails}>
                  {sendEmailsLabel}
                </Button>
              ) : (
                <Button type="button" variant="secondary" disabled={pending} className="text-xs font-semibold sm:min-h-[2.25rem]" onClick={onMoveMonitor}>
                  Move to monitor
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                className="text-xs font-semibold"
                title="Archive this opportunity"
                onClick={() => onStageChange("archived")}
              >
                Archive
              </Button>
            </>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[14rem] sm:flex-none sm:justify-end">
          <label className="sr-only" htmlFor={`stage-${row.opportunity_id}`}>
            Pipeline stage
          </label>
          <Select
            id={`stage-${row.opportunity_id}`}
            disabled={pending}
            className="min-h-[2.25rem] rounded-lg border-[var(--fo-border)] bg-[var(--fo-paper)] text-xs font-semibold text-[var(--fo-title)] shadow-sm sm:text-sm"
            value={row.stage}
            onChange={(e) => onStageChange(e.target.value as PipelineStage)}
          >
            {(["triage", "monitor", "cold", "archived"] as const).map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
    </li>
  );
}
