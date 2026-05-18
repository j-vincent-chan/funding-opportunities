"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { transformEmailOutreachDraftAction } from "@/app/actions/email-outreach-ai-actions";
import {
  addSavedOpportunityPiMatchAction,
  logOutreachSentAction,
  removeSavedOpportunityPiMatchAction,
  reorderSavedOpportunityPiMatchesAction,
  updateSavedOpportunityPiMatchAction,
} from "@/app/actions/opportunity-pipeline-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import { formatDate } from "@/lib/formatting/dates";
import {
  MATCH_STRENGTHS,
  OUTREACH_STATUSES,
  OUTREACH_STATUS_LABEL,
  PIPELINE_STAGE_LABEL,
  ROLE_LABEL,
  ROLE_SUGGESTIONS,
  type EmailDraftMode,
  type PipelineStage,
} from "@/lib/opportunity-pipeline/constants";
import { buildOutreachEmailDraft } from "@/lib/opportunity-pipeline/email-drafts";
import { deadlineUrgency } from "@/lib/opportunity-pipeline/pipeline-list-card-meta";
import {
  invName,
  type PipelineCommunityRef,
  type PipelineFundingRow,
  type PipelinePiMatchRow,
} from "@/lib/opportunity-pipeline/serializers";

export type CommunityInvestigatorHit = { id: string; full_name: string; email: string | null };

function ChevronUpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClipboardIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M13.5 1.25A2.75 2.75 0 0116.25 4v1.25h.5A2.25 2.25 0 0119 7.5v9.25A2.25 2.25 0 0116.75 19h-9.5A2.25 2.25 0 015 16.75V7.5A2.25 2.25 0 017.25 5.25h.5V4A2.75 2.75 0 0110.5 1.25h3zM7.75 5.25h4.5V4c0-.69-.56-1.25-1.25-1.25h-3c-.69 0-1.25.56-1.25 1.25v1.25zm-1 1.5c-.41 0-.75.34-.75.75v9.25c0 .41.34.75.75.75h9.5c.41 0 .75-.34.75-.75V7.5c0-.41-.34-.75-.75-.75h-9.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function firstInv(m: PipelinePiMatchRow) {
  const inv = m.investigators;
  if (!inv) return null;
  return Array.isArray(inv) ? inv[0] ?? null : inv;
}

function invSubtitle(m: PipelinePiMatchRow): string | null {
  const one = firstInv(m);
  if (!one) return null;
  const parts = [one.home_department, one.division].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : null;
}

function deadlineContext(closeDate: string | null, today: string): { primary: string; secondary: string | null } {
  if (!closeDate) return { primary: "No deadline", secondary: null };
  const d = formatDate(closeDate);
  const ms = new Date(`${closeDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime();
  const days = Math.ceil(ms / 86400000);
  if (closeDate < today) return { primary: `Past due · ${d}`, secondary: null };
  if (closeDate === today) return { primary: `Due today · ${d}`, secondary: null };
  if (days === 1) return { primary: `Due tomorrow · ${d}`, secondary: null };
  if (days <= 0) return { primary: d, secondary: null };
  return { primary: `Due ${d}`, secondary: `${days} days left` };
}

function outreachAggregate(matches: PipelinePiMatchRow[]): "none" | "building" | "drafting" | "in_flight" | "engaged" {
  if (matches.length === 0) return "none";
  const statuses = matches.map((m) => m.outreach_status);
  if (statuses.some((s) => ["responded_interested", "responded_maybe", "responded_declined"].includes(s))) {
    return "engaged";
  }
  if (statuses.some((s) => s === "sent")) return "in_flight";
  if (statuses.some((s) => s === "drafted")) return "drafting";
  return "building";
}

function emailBodyState(
  matches: PipelinePiMatchRow[],
  emailBody: string,
  targetId: string
): "blocked" | "needs_draft" | "ready" | "logged" {
  if (matches.length === 0) return "blocked";
  const m = matches.find((x) => x.investigator_id === targetId);
  if (m && ["sent", "responded_interested", "responded_maybe", "responded_declined"].includes(m.outreach_status)) {
    return "logged";
  }
  if (emailBody.trim().length > 0) return "ready";
  return "needs_draft";
}

const MATCH_STRENGTH_LABEL: Record<string, string> = {
  stretch: "Stretch",
  plausible: "Plausible",
  strong: "Strong",
};

export function TriageCommunityPiPanel({
  opportunityId,
  communityLabel,
  roster,
  rosterLoading,
  matches,
  fundingOpportunity,
  whyMatters,
  internalNotes,
  disabled: parentDisabled,
  compact = false,
  ownerLabel = null,
  stage = "triage",
  opportunityCommunities = [],
  hideHeader = false,
}: {
  opportunityId: string;
  communityLabel: string;
  roster: CommunityInvestigatorHit[];
  rosterLoading: boolean;
  matches: PipelinePiMatchRow[];
  fundingOpportunity: PipelineFundingRow | null;
  whyMatters: string | null;
  internalNotes: string | null;
  disabled: boolean;
  compact?: boolean;
  ownerLabel?: string | null;
  stage?: PipelineStage;
  opportunityCommunities?: PipelineCommunityRef[];
  /** Suppress panel header when parent card already shows notice context. */
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const disabled = parentDisabled || pending;
  const today = new Date().toISOString().slice(0, 10);

  /** Single default; tone picker removed from UI. */
  const emailMode: EmailDraftMode = "exploratory";
  const [emailTargetInvestigatorId, setEmailTargetInvestigatorId] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [rosterFilter, setRosterFilter] = useState("");
  /** Center = neutral; drag toward Shorter/Longer and release to run AI (see commitDraftLengthSlider). */
  const [draftLengthSlider, setDraftLengthSlider] = useState(50);

  const matchByInvestigatorId = useMemo(() => {
    const m = new Map<string, PipelinePiMatchRow>();
    for (const row of matches) m.set(row.investigator_id, row);
    return m;
  }, [matches]);

  const fo = fundingOpportunity;
  const title = ((fo?.title ?? "").trim() || "Untitled notice").slice(0, 200);
  const urgency = deadlineUrgency(fo?.close_date ?? null, today);
  const deadline = deadlineContext(fo?.close_date ?? null, today);
  const sponsorLine = useMemo(() => {
    const agency = coercePlainTextFromUnknown(fo?.agency);
    const mech = coercePlainTextFromUnknown(fo?.funding_instrument);
    if (agency && mech) return { sponsor: agency, mechanism: mech };
    return { sponsor: agency || "—", mechanism: mech || null };
  }, [fo?.agency, fo?.funding_instrument]);

  const filteredRoster = useMemo(() => {
    const q = rosterFilter.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
    );
  }, [roster, rosterFilter]);

  /** Selected (linked) investigators first, then the rest; alphabetical within each group. */
  const displayRoster = useMemo(() => {
    const nameKey = (r: CommunityInvestigatorHit) => (r.full_name ?? "").trim().toLowerCase();
    return [...filteredRoster].sort((a, b) => {
      const aLinked = matchByInvestigatorId.has(a.id);
      const bLinked = matchByInvestigatorId.has(b.id);
      if (aLinked !== bLinked) return aLinked ? -1 : 1;
      return nameKey(a).localeCompare(nameKey(b), undefined, { sensitivity: "base" });
    });
  }, [filteredRoster, matchByInvestigatorId]);

  const aggregate = outreachAggregate(matches);
  const bodyState = emailBodyState(matches, emailBody, emailTargetInvestigatorId);
  const subjectPreview = `Funding opportunity: ${((fo?.title ?? "").trim() || "Notice").slice(0, 72)}`;

  useEffect(() => {
    const primary = matches.find((m) => m.is_primary_target);
    const first = matches[0];
    const pick = primary?.investigator_id ?? first?.investigator_id ?? "";
    setEmailTargetInvestigatorId((prev) => (prev && matches.some((m) => m.investigator_id === prev) ? prev : pick));
  }, [matches]);

  function refresh() {
    router.refresh();
  }

  function toggleInvestigator(inv: CommunityInvestigatorHit, nextChecked: boolean) {
    startTransition(async () => {
      if (nextChecked) {
        const r = await addSavedOpportunityPiMatchAction({
          opportunityId,
          investigatorId: inv.id,
        });
        if (!r.ok) window.alert(r.error);
      } else {
        const row = matchByInvestigatorId.get(inv.id);
        if (!row) return;
        const r = await removeSavedOpportunityPiMatchAction(row.id);
        if (!r.ok) window.alert(r.error);
      }
      refresh();
    });
  }

  function moveMatch(idx: number, dir: -1 | 1) {
    const list = [...matches];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const tmp = list[idx]!;
    list[idx] = list[j]!;
    list[j] = tmp;
    startTransition(async () => {
      const r = await reorderSavedOpportunityPiMatchesAction({
        opportunityId,
        orderedMatchIds: list.map((x) => x.id),
      });
      if (!r.ok) window.alert(r.error);
      else refresh();
    });
  }

  function patchMatch(
    matchId: string,
    patch: Omit<Parameters<typeof updateSavedOpportunityPiMatchAction>[0], "matchId">,
  ) {
    startTransition(async () => {
      const r = await updateSavedOpportunityPiMatchAction({ matchId, ...patch });
      if (!r.ok) window.alert(r.error);
      else refresh();
    });
  }

  function generateEmail() {
    const m = matches.find((x) => x.investigator_id === emailTargetInvestigatorId);
    if (!m) {
      window.alert("Add at least one matched PI above, then choose who to write to.");
      return;
    }
    const piN = invName(m);
    const one = firstInv(m);
    const rationale =
      [m.rationale, m.notes].filter(Boolean).join(" ").trim() ||
      (whyMatters ?? "").trim() ||
      (internalNotes ?? "").trim();
    const sponsorOrMech =
      sponsorLine.mechanism ? `${sponsorLine.sponsor} · ${sponsorLine.mechanism}` : sponsorLine.sponsor;
    const body = buildOutreachEmailDraft(emailMode, {
      piName: piN,
      piEmail: one?.email,
      opportunityTitle: (fo?.title ?? "").trim() || "Funding opportunity",
      sponsorOrMechanism: fo ? sponsorOrMech : "—",
      deadlineLine: formatDate(fo?.close_date ?? null),
      fitRationale: rationale || "We see conceptual alignment worth a brief scan.",
    });
    setEmailBody(body);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(emailBody);
    } catch {
      window.alert("Could not copy to clipboard.");
    }
  }

  function openMailto() {
    const m = matches.find((x) => x.investigator_id === emailTargetInvestigatorId);
    const one = m ? firstInv(m) : null;
    const email = one?.email?.trim();
    if (!email) {
      window.alert("This PI has no email on file. Add it in Investigators, or paste the draft into your mail client.");
      return;
    }
    const subj = encodeURIComponent(subjectPreview);
    const body = encodeURIComponent(emailBody);
    window.open(`mailto:${encodeURIComponent(email)}?subject=${subj}&body=${body}`);
  }

  function runAiTransform(mode: "shorten" | "lengthen" | "revise") {
    startTransition(async () => {
      const r = await transformEmailOutreachDraftAction({
        body: emailBody,
        mode,
        instruction: mode === "revise" ? agentInstruction : undefined,
      });
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      if ("text" in r) setEmailBody(r.text);
    });
  }

  /** Drag toward Shorter or Longer and release; center leaves draft unchanged. Uses live input value so React state is never stale. */
  function applyDraftLengthChoice(value: number) {
    if (!emailBody.trim() || pending || disabled) {
      setDraftLengthSlider(50);
      return;
    }
    if (value < 38) {
      runAiTransform("shorten");
    } else if (value > 62) {
      runAiTransform("lengthen");
    }
    setDraftLengthSlider(50);
  }

  function logSent() {
    if (!emailTargetInvestigatorId) {
      window.alert("Select a PI to address the email.");
      return;
    }
    startTransition(async () => {
      const r = await logOutreachSentAction({
        opportunityId,
        investigatorId: emailTargetInvestigatorId,
        mode: emailMode,
        bodyPreview: emailBody.slice(0, 400),
      });
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      refresh();
    });
  }

  const rosterScroll = compact ? "max-h-40" : "";
  const shell = compact
    ? "rounded-lg border border-[var(--fo-border-strong)] bg-[var(--fo-paper)] shadow-sm"
    : "flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_5%,transparent)]";

  const statusCopy: Record<typeof aggregate, { label: string; tone: "neutral" | "progress" | "ok" | "warn" }> = {
    none: { label: "No PIs linked", tone: "warn" },
    building: { label: "Building shortlist", tone: "neutral" },
    drafting: { label: "Draft in progress", tone: "progress" },
    in_flight: { label: "Outreach sent", tone: "progress" },
    engaged: { label: "Responses tracked", tone: "ok" },
  };

  const statusToneClass = {
    neutral: "border-[var(--fo-neutral-status-border)] bg-[var(--fo-neutral-status-bg)] text-[var(--fo-neutral-status-text)]",
    progress: "border-[var(--fo-border)] bg-[var(--fo-select-tint)] text-[var(--fo-interaction)]",
    ok: "border-[var(--fo-success-border)] bg-[var(--fo-success-bg)] text-[var(--fo-success-text)]",
    warn: "border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] text-[var(--fo-warn-text)]",
  };

  const emailBanner = {
    blocked: {
      label: "Outreach locked",
      detail: "Select one or more investigators to generate a draft.",
      cls: "border-[var(--fo-neutral-status-border)] bg-[var(--fo-neutral-status-bg)] text-[var(--fo-neutral-status-text)]",
    },
    needs_draft: {
      label: "Draft not generated",
      detail: "Pick a recipient, then generate or write your email.",
      cls: "border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] text-[var(--fo-warn-text)]",
    },
    ready: {
      label: "Draft ready",
      detail: "Review below, open in your mail client, then log outreach when sent.",
      cls: "border-[var(--fo-success-border)] bg-[var(--fo-success-bg)] text-[var(--fo-success-text)]",
    },
    logged: {
      label: "Outreach logged",
      detail: "This PI is marked as sent or responded — update status if needed.",
      cls: "border-[var(--fo-success-border)] bg-[var(--fo-success-bg)] text-[var(--fo-success-text)]",
    },
  }[bodyState];

  const metaChip =
    "inline-flex max-w-full items-center rounded-md bg-[color-mix(in_srgb,var(--fo-inset)_88%,var(--fo-paper))] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--fo-metadata)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_6%,transparent)]";

  return (
    <div
      className={`${shell}${
        hideHeader && !compact
          ? " max-h-[min(75vh,52rem)] lg:max-h-[min(80vh,56rem)]"
          : ""
      }`}
    >
      {!hideHeader && !compact ? (
        <header className="shrink-0 border-b border-[var(--fo-divider)] bg-[var(--fo-inset)] px-5 py-3 sm:px-6 sm:py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/match/saved/${opportunityId}`}
                  className="text-sm font-semibold text-[var(--fo-interaction)] underline-offset-2 hover:underline"
                >
                  Open full notice
                </Link>
                <span className="hidden text-[var(--fo-divider)] sm:inline" aria-hidden>
                  ·
                </span>
                <p className="max-w-[min(100%,42rem)] truncate text-xs font-medium text-[var(--fo-ink-muted)]" title={title}>
                  {title}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.8125rem] leading-snug text-[var(--fo-ink-body)]">
                <span className={metaChip}>{sponsorLine.sponsor}</span>
                {sponsorLine.mechanism ? <span className={metaChip}>{sponsorLine.mechanism}</span> : null}
                <span className={`${metaChip} text-[var(--fo-section-label)]`}>{PIPELINE_STAGE_LABEL[stage]}</span>
                {opportunityCommunities.length ? (
                  <span className="text-[var(--fo-ink-muted)]">
                    <span className="font-semibold text-[var(--fo-section-label)]">Communities </span>
                    {opportunityCommunities.map((c) => c.label).join(" · ")}
                  </span>
                ) : null}
              </div>
              <p className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--fo-ink-muted)]">
                Roster · <span className="font-semibold normal-case tracking-normal text-[var(--fo-ink-body)]">{communityLabel}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2.5 sm:items-end sm:text-right">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className={`tabular-nums ${urgency.badgeClass} inline-flex items-center rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold`}>
                  {urgency.badge}
                </span>
                <div>
                  <p className="text-sm font-semibold tabular-nums text-[var(--fo-display)]">{deadline.primary}</p>
                  {deadline.secondary ? (
                    <p className="text-xs font-medium text-[var(--fo-metadata)]">{deadline.secondary}</p>
                  ) : null}
                </div>
              </div>
              <div className="text-sm sm:text-right">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--fo-section-label)]">RDSG owner</p>
                {ownerLabel ? (
                  <p className="mt-0.5 font-semibold text-[var(--fo-display)]">{ownerLabel}</p>
                ) : (
                  <p className="mt-0.5 font-semibold text-[var(--fo-warn-text)]">Unassigned</p>
                )}
              </div>
            </div>
          </div>
        </header>
      ) : !hideHeader ? (
        <div className="border-b border-[var(--fo-divider)] bg-[var(--fo-inset)] px-3 py-2">
          <p className="text-xs font-semibold text-[var(--fo-display)]">{communityLabel}</p>
          <p className="text-[0.65rem] text-[var(--fo-ink-muted)]">PI workflow · same actions as board</p>
        </div>
      ) : null}

      {/* Linked / outreach orientation — omitted in board card: parent card already shows Investigator state */}
      {!hideHeader ? (
        <div
          className={`shrink-0 flex flex-col gap-3 border-b border-[var(--fo-divider)] bg-[var(--fo-paper)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 ${compact ? "px-3 py-2.5" : ""}`}
        >
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-section-label)]">Outreach status</p>
            <p className="mt-1 text-sm font-semibold text-[var(--fo-display)]">
              {matches.length === 0 ? "No PIs linked yet" : `${matches.length} linked · workflow active`}
            </p>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--fo-ink-muted)]">
              {matches.length === 0
                ? "Select one or more investigators below to start outreach."
                : "Review candidates → confirm targets → generate email → send or log from your inbox."}
            </p>
          </div>
          <span className={`shrink-0 self-start rounded-lg border px-3 py-1.5 text-xs font-semibold sm:self-center ${statusToneClass[statusCopy[aggregate].tone]}`}>
            {statusCopy[aggregate].label}
          </span>
        </div>
      ) : null}

      <div
        className={
          compact
            ? "divide-y divide-[var(--fo-divider)]"
            : "grid min-h-0 flex-1 divide-y divide-[var(--fo-divider)] lg:grid-cols-[minmax(0,1.62fr)_minmax(17.5rem,1fr)] lg:items-stretch lg:divide-x lg:divide-y-0 lg:gap-0 lg:overflow-hidden"
        }
      >
        {/* Candidate investigators */}
        <section
          className={`${compact ? "p-3" : "flex min-h-0 flex-col overflow-hidden p-5 sm:p-6 lg:h-full lg:pr-8"} bg-[var(--fo-panel)]`}
        >
          <div className="shrink-0">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className={`font-semibold text-[var(--fo-display)] ${compact ? "text-xs" : "text-sm"}`}>Candidate investigators</h3>
                <p className={`mt-1 text-[var(--fo-ink-muted)] ${compact ? "text-[0.65rem]" : "text-xs leading-relaxed"}`}>
                  Directory: {communityLabel}. Check names to add to this opportunity.
                </p>
              </div>
              {!compact ? (
                <label className="w-full min-w-0 sm:max-w-md">
                  <span className="sr-only">Filter roster</span>
                  <input
                    type="search"
                    placeholder="Filter by name or email…"
                    value={rosterFilter}
                    onChange={(e) => setRosterFilter(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3.5 py-2.5 text-sm text-[var(--fo-title)] shadow-sm placeholder:text-[var(--fo-ink-faint)] focus:border-[var(--fo-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--fo-focus-ring)]"
                  />
                </label>
              ) : null}
            </div>
          </div>
          <div
            className={`mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg bg-[var(--fo-paper)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_7%,transparent)] ${rosterScroll}`}
            role="listbox"
            aria-label={`Investigators in ${communityLabel}. Linked to this opportunity are listed first, then others; each group is alphabetical.`}
          >
            {rosterLoading ? (
              <p className={`p-3 text-[var(--fo-ink-muted)] ${compact ? "text-xs" : "text-sm"}`}>Loading directory…</p>
            ) : filteredRoster.length === 0 ? (
              <p className={`p-3 text-[var(--fo-ink-muted)] ${compact ? "text-xs" : "text-sm"}`}>
                {roster.length === 0
                  ? "No investigators match the current filter. Assign a community on the Investigators page to include them here."
                  : "No names match your filter — clear search or widen the roster filter above."}
              </p>
            ) : (
              displayRoster.map((inv) => {
                const checked = matchByInvestigatorId.has(inv.id);
                return (
                  <label
                    key={inv.id}
                    className={`flex cursor-pointer items-start gap-3 border-b border-[var(--fo-divider)] px-4 py-3.5 transition-colors last:border-b-0 ${
                      checked
                        ? "bg-[var(--fo-select-tint)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--fo-interaction)_18%,transparent)]"
                        : "hover:bg-[var(--fo-row-hover)]"
                    } ${compact ? "px-3 py-2.5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--fo-border)] text-[var(--fo-interaction)] focus:ring-2 focus:ring-[var(--fo-focus-ring)]"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => toggleInvestigator(inv, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold text-[var(--fo-display)] ${compact ? "text-xs" : "text-sm"}`}>
                        {inv.full_name}
                      </span>
                      <span className={`mt-0.5 block truncate text-[var(--fo-metadata)] ${compact ? "text-[0.65rem]" : "text-xs"}`}>
                        {inv.email ?? "No email on file"}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </section>

        {/* Targets + email — scroll inside column when panel height is capped (e.g. expanded card) */}
        <section
          className={`${
            compact
              ? "space-y-3 p-3"
              : "flex h-full max-h-full min-h-0 flex-col gap-8 overflow-y-auto overflow-x-hidden overscroll-contain p-5 pb-6 sm:p-6 sm:pb-8 lg:pl-7"
          } bg-[var(--fo-inset)]`}
        >
          <div>
            <h3 className={`font-semibold text-[var(--fo-display)] ${compact ? "text-xs" : "text-sm"}`}>Outreach targets</h3>
            <p className={`mt-1 text-[var(--fo-ink-muted)] ${compact ? "text-[0.65rem]" : "text-xs leading-relaxed"}`}>
              Who will receive this notice — reorder for priority; mark one primary.
            </p>
            {matches.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--fo-border)] bg-[color-mix(in_srgb,var(--fo-paper)_96%,transparent)] px-4 py-5 text-center ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_4%,transparent)]">
                <p className="text-sm font-semibold text-[var(--fo-section-label)]">No targets yet</p>
                <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">Select investigators in the list to attach them here.</p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--fo-divider)] overflow-hidden rounded-lg bg-[var(--fo-paper)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_6%,transparent)]">
                {matches.map((m, idx) => {
                  const sub = invSubtitle(m);
                  const strength = MATCH_STRENGTH_LABEL[m.match_strength] ?? m.match_strength;
                  return (
                    <li key={m.id} className="px-4 py-3.5 sm:px-5 sm:py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-semibold text-[var(--fo-display)] ${compact ? "text-xs" : "text-sm"}`}>{invName(m)}</p>
                            {m.is_primary_target ? (
                              <span className="rounded-md bg-[var(--fo-select-tint)] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--fo-interaction)] ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_25%,transparent)]">
                                Primary
                              </span>
                            ) : null}
                            <span className="rounded-md bg-[var(--fo-neutral-status-bg)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--fo-neutral-status-text)] ring-1 ring-[var(--fo-neutral-status-border)]">
                              {strength}
                            </span>
                          </div>
                          {sub ? <p className="mt-1 text-xs text-[var(--fo-metadata)]">{sub}</p> : null}
                          <label className={`mt-2.5 flex items-center gap-2 text-[var(--fo-ink-muted)] ${compact ? "text-[0.65rem]" : "text-xs"}`}>
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-[var(--fo-border)] text-[var(--fo-interaction)]"
                              checked={m.is_primary_target}
                              disabled={disabled}
                              onChange={(e) => patchMatch(m.id, { isPrimaryTarget: e.target.checked })}
                            />
                            Primary target for this grant
                          </label>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 rounded-lg p-0 text-[var(--fo-ink-body)] hover:text-[var(--fo-title)]"
                            disabled={disabled || idx === 0}
                            title="Move up"
                            aria-label="Move target up"
                            onClick={() => moveMatch(idx, -1)}
                          >
                            <ChevronUpIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 rounded-lg p-0 text-[var(--fo-ink-body)] hover:text-[var(--fo-title)]"
                            disabled={disabled || idx >= matches.length - 1}
                            title="Move down"
                            aria-label="Move target down"
                            onClick={() => moveMatch(idx, 1)}
                          >
                            <ChevronDownIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="ml-1 h-auto px-2 py-1 text-[0.6875rem] font-medium text-[var(--fo-ink-muted)] hover:bg-[var(--fo-row-hover)] hover:text-red-700"
                            disabled={disabled}
                            title="Remove from shortlist"
                            onClick={() =>
                              startTransition(async () => {
                                const r = await removeSavedOpportunityPiMatchAction(m.id);
                                if (!r.ok) window.alert(r.error);
                                else refresh();
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      {!compact ? (
                        <details className="group mt-3 border-t border-[var(--fo-divider)] pt-3">
                          <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--fo-interaction)] outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                            <span className="underline decoration-[color-mix(in_srgb,var(--fo-interaction)_35%,var(--fo-border))] decoration-2 underline-offset-2 group-open:no-underline">
                              Match fields &amp; outreach status
                            </span>
                            <span className="ml-2 text-[var(--fo-ink-muted)] group-open:hidden">(optional)</span>
                          </summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="text-xs text-[var(--fo-section-label)]">
                              Match strength
                              <Select
                                className="mt-1.5 border-[var(--fo-border)] bg-[var(--fo-paper)] text-sm"
                                value={m.match_strength}
                                disabled={disabled}
                                onChange={(e) => patchMatch(m.id, { matchStrength: e.target.value })}
                              >
                                {MATCH_STRENGTHS.map((s) => (
                                  <option key={s} value={s}>
                                    {MATCH_STRENGTH_LABEL[s] ?? s}
                                  </option>
                                ))}
                              </Select>
                            </label>
                            <label className="text-xs text-[var(--fo-section-label)]">
                              Role suggestion
                              <Select
                                className="mt-1.5 border-[var(--fo-border)] bg-[var(--fo-paper)] text-sm"
                                value={m.role_suggestion}
                                disabled={disabled}
                                onChange={(e) => patchMatch(m.id, { roleSuggestion: e.target.value })}
                              >
                                {ROLE_SUGGESTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {ROLE_LABEL[s]}
                                  </option>
                                ))}
                              </Select>
                            </label>
                            <label className="text-xs text-[var(--fo-section-label)] sm:col-span-2">
                              Outreach status
                              <Select
                                className="mt-1.5 border-[var(--fo-border)] bg-[var(--fo-paper)] text-sm"
                                value={m.outreach_status}
                                disabled={disabled}
                                onChange={(e) => patchMatch(m.id, { outreachStatus: e.target.value })}
                              >
                                {OUTREACH_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {OUTREACH_STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </Select>
                            </label>
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={compact ? "rounded-lg border border-[var(--fo-border-strong)] bg-[var(--fo-paper)] p-3 shadow-sm" : "border-t border-[var(--fo-divider)] pt-8"}>
            <h3 className={`font-semibold text-[var(--fo-display)] ${compact ? "text-xs" : "text-sm"}`}>Outreach email</h3>
            <p className={`mt-1 text-[var(--fo-ink-muted)] ${compact ? "text-[0.65rem]" : "text-xs leading-relaxed"}`}>
              Generate a draft, then open in your mail client or log when sent.
            </p>

            <div className={`my-6 rounded-lg border px-4 py-4 text-xs leading-relaxed ${emailBanner.cls}`}>
              <p className="font-semibold">{emailBanner.label}</p>
              <p className="mt-1.5 opacity-90">{emailBanner.detail}</p>
            </div>

            {matches.length === 0 ? (
              <p className={`mt-3 text-center text-[var(--fo-ink-muted)] ${compact ? "text-[0.65rem]" : "text-xs"}`}>
                Select at least one PI to unlock drafting.
              </p>
            ) : (
              <>
                <div className="mt-5 rounded-lg bg-[color-mix(in_srgb,var(--fo-paper)_88%,var(--fo-inset))] px-4 py-3 ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_6%,transparent)]">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--fo-section-label)]">Subject</p>
                  <p className="mt-2 break-words text-sm font-medium leading-snug text-[var(--fo-display)]">{subjectPreview}</p>
                </div>

                <label className={`mt-5 block text-xs font-semibold text-[var(--fo-section-label)]`}>
                  Recipient
                  <Select
                    className={`mt-2 border-[var(--fo-border)] bg-[var(--fo-paper)] ${compact ? "text-xs" : "text-sm"}`}
                    value={emailTargetInvestigatorId}
                    onChange={(e) => setEmailTargetInvestigatorId(e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Choose a linked PI…</option>
                    {matches.map((m) => (
                      <option key={m.id} value={m.investigator_id}>
                        {invName(m)}
                      </option>
                    ))}
                  </Select>
                </label>

                <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-3">
                  <Button type="button" variant="secondary" className="text-xs" disabled={disabled || matches.length === 0} onClick={generateEmail}>
                    Generate draft
                  </Button>
                  <button
                    type="button"
                    disabled={!emailBody}
                    title="Copy body"
                    aria-label="Copy email body to clipboard"
                    onClick={() => void copyEmail()}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-body)] shadow-sm transition hover:border-[var(--fo-border-strong)] hover:bg-[var(--fo-row-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-interaction)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ClipboardIcon className="h-4 w-4" />
                  </button>
                  <div className="flex min-w-[9rem] max-w-[16rem] flex-[1_1_8rem] flex-col gap-1">
                    <div className="flex items-center justify-between text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--fo-section-label)]">
                      <span>Shorter</span>
                      <span>Longer</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={draftLengthSlider}
                      disabled={!emailBody.trim() || pending || disabled}
                      aria-label="Adjust draft length. Release pointer toward Shorter or Longer to apply, or press Enter after adjusting with arrow keys."
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={draftLengthSlider}
                      onChange={(e) => setDraftLengthSlider(Number(e.target.value))}
                      onPointerUp={(e) => applyDraftLengthChoice(Number(e.currentTarget.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyDraftLengthChoice(Number((e.target as HTMLInputElement).value));
                        }
                      }}
                      className="h-2 w-full cursor-pointer accent-[var(--fo-interaction)] disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <Button type="button" variant="secondary" className="text-xs" disabled={pending || !emailTargetInvestigatorId} onClick={openMailto}>
                    Open in email app
                  </Button>
                  <Button type="button" className="text-xs" disabled={pending || !emailTargetInvestigatorId} onClick={logSent}>
                    Log outreach sent
                  </Button>
                </div>

                <details className="group mt-6 rounded-lg bg-[var(--fo-paper)] px-3 py-2 ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_5%,transparent)]">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--fo-interaction)] marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="underline decoration-[color-mix(in_srgb,var(--fo-interaction)_35%,var(--fo-border))] decoration-2 underline-offset-2">
                      AI instruction for revise
                    </span>
                    <span className="ml-2 font-normal text-[var(--fo-ink-muted)]">(optional)</span>
                  </summary>
                  <label className="mt-3 block text-xs text-[var(--fo-ink-muted)]">
                    <span className="font-semibold text-[var(--fo-section-label)]">Instruction</span>
                    <Textarea
                      className={`mt-2 border-[var(--fo-border)] bg-[var(--fo-paper)] ${compact ? "min-h-[40px] text-xs" : "min-h-[52px] text-sm"}`}
                      placeholder="e.g. Keep under 180 words and mention the deadline…"
                      value={agentInstruction}
                      onChange={(e) => setAgentInstruction(e.target.value)}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 text-xs"
                    disabled={!emailBody || pending}
                    onClick={() => runAiTransform("revise")}
                  >
                    Apply instruction to draft
                  </Button>
                </details>

                <label className="mt-6 block text-[0.65rem] font-bold uppercase tracking-wide text-[var(--fo-section-label)]">
                  Body preview / edit
                </label>
                <Textarea
                  className={`mt-2 border-[var(--fo-border)] bg-[var(--fo-paper)] font-mono text-[var(--fo-ink-body)] ${
                    compact ? "min-h-[100px] text-xs" : "min-h-[200px] text-sm leading-relaxed"
                  }`}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Generate a draft or type your own message…"
                  disabled={disabled}
                />
              </>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
