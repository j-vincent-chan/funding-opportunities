"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  expireMonitorAwaitingToColdAction,
  resendMonitorOutreachReminderAction,
  updateSavedOpportunityPiMatchAction,
  updateSavedOpportunityPipelineAction,
} from "@/app/actions/opportunity-pipeline-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  daysSinceIso,
  monitorResponseUiFromMatch,
  outreachStatusFromMonitorUi,
  type MonitorPiResponseUi,
} from "@/lib/opportunity-pipeline/monitor-pi-response";
import { invName, type PipelinePiMatchRow } from "@/lib/opportunity-pipeline/serializers";

type ProfileRow = { id: string; full_name: string | null; email: string | null };

const RESPONSE_OPTIONS: { value: MonitorPiResponseUi; label: string }[] = [
  { value: "awaiting", label: "No response yet / awaiting" },
  { value: "interested", label: "Responded — interested" },
  { value: "declined", label: "Responded — not interested" },
];

export function MonitorOpportunityPiPanel({
  opportunityId,
  matches,
  ownerId,
  profiles,
  disabled: parentDisabled,
}: {
  opportunityId: string;
  matches: PipelinePiMatchRow[];
  ownerId: string | null;
  profiles: ProfileRow[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const disabled = parentDisabled || pending;

  const hasInterested = matches.some((m) => m.outreach_status === "responded_interested");

  function refresh() {
    router.refresh();
  }

  function patchMatch(matchId: string, ui: MonitorPiResponseUi, prev: PipelinePiMatchRow) {
    const nextStatus = outreachStatusFromMonitorUi(ui, prev);
    startTransition(async () => {
      const r = await updateSavedOpportunityPiMatchAction({
        matchId,
        outreachStatus: nextStatus,
      });
      if (!r.ok) window.alert(r.error);
      else refresh();
    });
  }

  function setOwner(next: string) {
    startTransition(async () => {
      const r = await updateSavedOpportunityPipelineAction({
        opportunityId,
        ownerId: next === "" ? null : next,
      });
      if (!r.ok) window.alert(r.error);
      else refresh();
    });
  }

  function resend(matchId: string) {
    startTransition(async () => {
      const r = await resendMonitorOutreachReminderAction(matchId);
      if (!r.ok) window.alert(r.error);
      else refresh();
    });
  }

  function runSlaSweep() {
    startTransition(async () => {
      const r = await expireMonitorAwaitingToColdAction();
      if (!r.ok) window.alert(r.error);
      else if (r.moved > 0) refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--fo-section-label)]">Monitor &amp; follow-up</p>
        <Button type="button" variant="secondary" className="text-xs" disabled={disabled} onClick={runSlaSweep}>
          Apply SLA rules (14d → Cold)
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--fo-ink-body)]">
        Set each PI&apos;s response. After outreach is logged as <strong>sent</strong>, you can re-send a notification after{" "}
        <strong>7 days</strong>. If there is still no interested response after <strong>14 days</strong> from the last send
        timestamp, move this card to <strong>Cold</strong> (use the button or stage control).
      </p>

      {hasInterested ? (
        <label className="block text-xs font-semibold text-[var(--fo-section-label)]">
          Assign owner (interested PI)
          <Select
            className="mt-1.5 border-[var(--fo-border)] bg-[var(--fo-paper)] text-sm"
            value={ownerId ?? ""}
            disabled={disabled}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.full_name || p.email || p.id).trim()}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <p className="rounded-lg border border-[var(--fo-border)] bg-[var(--fo-inset)] px-3 py-2 text-xs text-[var(--fo-ink-muted)]">
          Owner assignment unlocks when at least one PI is marked <strong>interested</strong>.
        </p>
      )}

      {matches.length === 0 ? (
        <p className="text-sm text-[var(--fo-ink-muted)]">No investigators linked. Add PIs from the saved opportunity page.</p>
      ) : (
        <ul className="space-y-4">
          {matches.map((m) => {
            const ui = monitorResponseUiFromMatch(m);
            const days = m.outreach_status === "sent" ? daysSinceIso(m.outreach_sent_at) : null;
            const canResend = m.outreach_status === "sent" && days !== null && days >= 7;
            const staleCold = m.outreach_status === "sent" && days !== null && days >= 14;

            return (
              <li
                key={m.id}
                className="rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-3 shadow-sm sm:px-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--fo-display)] [overflow-wrap:anywhere]">{invName(m)}</p>
                    {m.outreach_status === "sent" && m.outreach_sent_at ? (
                      <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">
                        Last outreach logged · {days === null ? "—" : `${days} day${days === 1 ? "" : "s"} ago`}
                      </p>
                    ) : null}
                  </div>
                  <label className="min-w-[min(100%,14rem)] shrink-0 text-xs font-semibold text-[var(--fo-section-label)] sm:text-right">
                    Response
                    <Select
                      className="mt-1.5 w-full border-[var(--fo-border)] bg-[var(--fo-paper)] text-sm sm:text-left"
                      value={ui}
                      disabled={disabled}
                      onChange={(e) => patchMatch(m.id, e.target.value as MonitorPiResponseUi, m)}
                    >
                      {RESPONSE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                {m.outreach_status === "sent" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--fo-divider)] pt-3">
                    {staleCold ? (
                      <span className="inline-flex items-center rounded-md border border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] px-2 py-1 text-[0.65rem] font-semibold text-[var(--fo-warn-text)]">
                        14d+ awaiting — consider Cold
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      disabled={disabled || !canResend}
                      title={
                        !canResend
                          ? "Available 7 days after last outreach timestamp"
                          : "Updates last-send time (restarts 14-day window)"
                      }
                      onClick={() => resend(m.id)}
                    >
                      Re-send notification
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
