"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { transformEmailOutreachDraftAction } from "@/app/actions/email-outreach-ai-actions";
import {
  addSavedOpportunityPiMatchAction,
  appendPipelineTimelineNoteAction,
  logOutreachSentAction,
  moveOpportunityToColdAction,
  removeSavedOpportunityPiMatchAction,
  reorderSavedOpportunityPiMatchesAction,
  sendPipelineOutreachEmailsAndMoveToMonitorAction,
  updateSavedOpportunityPiMatchAction,
  updateSavedOpportunityPipelineAction,
} from "@/app/actions/opportunity-pipeline-actions";
import {
  InvestigatorDecisionList,
  type PiMatchPatch,
} from "@/components/opportunity-pipeline/investigator-decision-list";
import { PipelineMetricsRow } from "@/components/opportunity-pipeline/pipeline-metrics-row";
import { PipelineNextActionsCard } from "@/components/opportunity-pipeline/pipeline-next-actions-card";
import { PipelineOpportunityHeader } from "@/components/opportunity-pipeline/pipeline-opportunity-header";
import {
  PipelineSuggestedMatches,
  type PipelineSuggestedInvestigator,
} from "@/components/opportunity-pipeline/pipeline-suggested-matches";
import { PipelineSectionCard } from "@/components/opportunity-pipeline/pipeline-section-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CLOSURE_REASONS,
  CLOSURE_REASON_LABEL,
  EMAIL_DRAFT_MODE_LABEL,
  EMAIL_DRAFT_MODES,
  type EmailDraftMode,
  type PipelineStage,
} from "@/lib/opportunity-pipeline/constants";
import { buildOutreachEmailDraft } from "@/lib/opportunity-pipeline/email-drafts";
import { resolveFundingSourceUrl } from "@/lib/funding-opportunities/source-url";
import { formatDate, formatDateTime } from "@/lib/formatting/dates";
import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import {
  invName,
  monitorStatusLine,
  type NormalizedPipelineItem,
} from "@/lib/opportunity-pipeline/serializers";

type ProfileRow = { id: string; full_name: string | null; email: string | null };

type ActivityRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function activityTitle(t: string) {
  switch (t) {
    case "stage_change":
      return "Stage change";
    case "note":
      return "Note";
    case "outreach_sent":
      return "Outreach sent";
    case "pi_added":
      return "PI added";
    case "pi_removed":
      return "PI removed";
    case "pi_updated":
      return "PI updated";
    case "pipeline_update":
      return "Update";
    case "closure":
      return "Closed";
    case "communities_updated":
      return "Communities";
    default:
      return t;
  }
}

function formatActivitySummary(eventType: string, payload: Record<string, unknown>): string {
  if (eventType === "outreach_sent") {
    const prev = typeof payload.body_preview === "string" ? payload.body_preview.slice(0, 120) : "";
    return prev ? `Preview: ${prev}${prev.length >= 120 ? "…" : ""}` : "Outreach logged.";
  }
  if (eventType === "note" && typeof payload.body === "string") {
    const b = payload.body.trim();
    return b.length > 160 ? `${b.slice(0, 160)}…` : b || "Note added.";
  }
  if (eventType === "stage_change") {
    const from = typeof payload.from === "string" ? payload.from : "—";
    const to = typeof payload.to === "string" ? payload.to : "—";
    return `${from} → ${to}`;
  }
  if (eventType === "pi_updated" && payload.patch && typeof payload.patch === "object") {
    const keys = Object.keys(payload.patch as object);
    return keys.length ? `Updated: ${keys.join(", ")}` : "PI match updated.";
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return "—";
  }
}

export function OpportunityPipelineDetailClient({
  opportunityId,
  initialItem,
  activities,
  profiles,
  suggestedInvestigators,
}: {
  opportunityId: string;
  initialItem: NormalizedPipelineItem;
  activities: ActivityRow[];
  profiles: ProfileRow[];
  suggestedInvestigators: PipelineSuggestedInvestigator[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState(initialItem.stage);
  const [strategic, setStrategic] = useState(initialItem.strategic_value);
  const [ownerId, setOwnerId] = useState<string>(initialItem.owner_id ?? "");
  const [internalNotes, setInternalNotes] = useState(initialItem.internal_notes ?? "");
  const [whyMatters, setWhyMatters] = useState(initialItem.why_matters ?? "");
  const [risksBarriers, setRisksBarriers] = useState(initialItem.risks_barriers ?? "");
  const [tagsText, setTagsText] = useState((initialItem.area_program_tags ?? []).join(", "));
  const [nextAction, setNextAction] = useState(initialItem.next_action ?? "");
  const [nextActionDate, setNextActionDate] = useState(initialItem.next_action_date ?? "");
  const [closureReason, setClosureReason] = useState(initialItem.closure_reason ?? "");
  const [coldUntilInput, setColdUntilInput] = useState(initialItem.cold_until ?? "");
  const [timelineNote, setTimelineNote] = useState("");

  const [piQuery, setPiQuery] = useState("");
  const [piHits, setPiHits] = useState<{ id: string; full_name: string; email: string | null }[]>([]);

  const [emailMode, setEmailMode] = useState<EmailDraftMode>("exploratory");
  const [emailTargetInvestigatorId, setEmailTargetInvestigatorId] = useState<string>("");
  const [emailBody, setEmailBody] = useState("");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [outreachOpen, setOutreachOpen] = useState(true);

  useEffect(() => {
    setStage(initialItem.stage);
    setStrategic(initialItem.strategic_value);
    setOwnerId(initialItem.owner_id ?? "");
    setInternalNotes(initialItem.internal_notes ?? "");
    setWhyMatters(initialItem.why_matters ?? "");
    setRisksBarriers(initialItem.risks_barriers ?? "");
    setTagsText((initialItem.area_program_tags ?? []).join(", "));
    setNextAction(initialItem.next_action ?? "");
    setNextActionDate(initialItem.next_action_date ?? "");
    setClosureReason(initialItem.closure_reason ?? "");
    setColdUntilInput(initialItem.cold_until ?? "");
  }, [initialItem]);

  const matches = useMemo(() => initialItem.saved_opportunity_pi_matches ?? [], [initialItem]);
  const fo = initialItem.funding_opportunities;

  useEffect(() => {
    if (piQuery.trim().length < 2) {
      setPiHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/investigators/search?q=${encodeURIComponent(piQuery.trim())}`);
        const j = (await r.json()) as { results?: { id: string; full_name: string; email: string | null }[] };
        setPiHits(j.results ?? []);
      } catch {
        setPiHits([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [piQuery]);

  useEffect(() => {
    const primary = matches.find((m) => m.is_primary_target);
    const first = matches[0];
    const pick = primary?.investigator_id ?? first?.investigator_id ?? "";
    setEmailTargetInvestigatorId((prev) => (prev && matches.some((m) => m.investigator_id === prev) ? prev : pick));
  }, [matches]);

  const sponsorLine = useMemo(() => {
    const agency = coercePlainTextFromUnknown(fo?.agency);
    const mech = coercePlainTextFromUnknown(fo?.funding_instrument);
    if (agency && mech) return `${agency} · ${mech}`;
    return agency || mech || "—";
  }, [fo]);

  const activityCode = useMemo(() => {
    const n = (fo?.opportunity_number ?? "").trim();
    return n || null;
  }, [fo?.opportunity_number]);

  const externalUrl = resolveFundingSourceUrl(fo?.raw_payload_json);

  const itemForNextActions = useMemo(
    () => ({
      ...initialItem,
      owner_id: ownerId || null,
      next_action: nextAction,
      next_action_date: nextActionDate || null,
    }),
    [initialItem, ownerId, nextAction, nextActionDate]
  );

  const metrics = useMemo(() => {
    const total = matches.length;
    const shortlisted = matches.filter((m) => m.is_primary_target).length;
    const contacted = matches.filter((m) =>
      ["sent", "responded_interested", "responded_maybe", "responded_declined"].includes(m.outreach_status)
    ).length;
    const interested = matches.filter((m) => m.outreach_status === "responded_interested").length;
    const declined = matches.filter((m) => m.outreach_status === "responded_declined").length;
    const activeNextSteps =
      (nextAction.trim() ? 1 : 0) + (nextActionDate ? 1 : 0) + matches.filter((m) => !!m.follow_up_date).length;
    return { total, shortlisted, contacted, interested, declined, activeNextSteps };
  }, [matches, nextAction, nextActionDate]);

  const saveAssessment = useCallback(() => {
    startTransition(async () => {
      const tags = tagsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await updateSavedOpportunityPipelineAction({
        opportunityId,
        stage,
        strategicValue: strategic,
        ownerId: ownerId || null,
        internalNotes,
        whyMatters,
        risksBarriers,
        areaProgramTags: tags,
        nextAction,
        nextActionDate: nextActionDate || null,
        closureReason: stage === "archived" ? closureReason || null : null,
        coldUntil: stage === "cold" ? coldUntilInput || null : null,
      });
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      router.refresh();
    });
  }, [
    opportunityId,
    stage,
    strategic,
    ownerId,
    internalNotes,
    whyMatters,
    risksBarriers,
    tagsText,
    nextAction,
    nextActionDate,
    closureReason,
    coldUntilInput,
    router,
  ]);

  function addNote() {
    startTransition(async () => {
      const r = await appendPipelineTimelineNoteAction({ opportunityId, body: timelineNote });
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      setTimelineNote("");
      router.refresh();
    });
  }

  function addPi(invId: string) {
    startTransition(async () => {
      const r = await addSavedOpportunityPiMatchAction({ opportunityId, investigatorId: invId });
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      setPiQuery("");
      setPiHits([]);
      router.refresh();
    });
  }

  function generateEmail() {
    const m = matches.find((x) => x.investigator_id === emailTargetInvestigatorId);
    if (!m || !fo) {
      window.alert("Choose a matched PI first.");
      return;
    }
    const piN = invName(m);
    const inv = m.investigators;
    const one = inv && !Array.isArray(inv) ? inv : Array.isArray(inv) ? inv[0] : null;
    const rationale = [m.rationale, m.notes].filter(Boolean).join(" ").trim() || whyMatters.trim() || internalNotes.trim();
    const body = buildOutreachEmailDraft(emailMode, {
      piName: piN,
      piEmail: one?.email,
      opportunityTitle: (fo.title ?? "").trim() || "Funding opportunity",
      sponsorOrMechanism: sponsorLine,
      deadlineLine: formatDate(fo.close_date ?? null),
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
    const inv = m?.investigators;
    const one = inv && !Array.isArray(inv) ? inv : Array.isArray(inv) ? inv[0] : null;
    const email = one?.email?.trim();
    if (!email) {
      window.alert("This PI has no email on file. Add it in Investigators, or paste the draft into your mail client.");
      return;
    }
    const t = ((fo?.title ?? "").trim() || "Funding opportunity").slice(0, 80);
    const subj = encodeURIComponent(`Funding opportunity: ${t}`);
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

  function logSent() {
    if (!emailTargetInvestigatorId) {
      window.alert("Select a PI.");
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
      router.refresh();
    });
  }

  async function moveMatch(idx: number, dir: -1 | 1) {
    const list = [...matches];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[j]!;
    list[j] = tmp!;
    startTransition(async () => {
      const r = await reorderSavedOpportunityPiMatchesAction({
        opportunityId,
        orderedMatchIds: list.map((x) => x.id),
      });
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      router.refresh();
    });
  }

  const patchMatch = useCallback(
    (matchId: string, patch: PiMatchPatch) => {
      startTransition(async () => {
        const r = await updateSavedOpportunityPiMatchAction({ matchId, ...patch });
        if (!r.ok) window.alert(r.error);
        else router.refresh();
      });
    },
    [router]
  );

  const bulkPatch = useCallback(
    (matchIds: string[], patch: PiMatchPatch) => {
      startTransition(async () => {
        if (patch.isPrimaryTarget === true && matchIds.length > 0) {
          const first = matchIds[0]!;
          const r = await updateSavedOpportunityPiMatchAction({ matchId: first, isPrimaryTarget: true });
          if (!r.ok) window.alert(r.error);
          else router.refresh();
          return;
        }
        for (const id of matchIds) {
          const r = await updateSavedOpportunityPiMatchAction({ matchId: id, ...patch });
          if (!r.ok) {
            window.alert(r.error);
            return;
          }
        }
        router.refresh();
      });
    },
    [router]
  );

  const title = (fo?.title ?? "").trim() || "Untitled notice";

  function persistPipeline(partial: { stage?: PipelineStage }) {
    const tags = tagsText
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const r = await updateSavedOpportunityPipelineAction({
        opportunityId,
        stage: partial.stage ?? stage,
        strategicValue: strategic,
        ownerId: ownerId || null,
        internalNotes,
        whyMatters,
        risksBarriers,
        areaProgramTags: tags,
        nextAction,
        nextActionDate: nextActionDate || null,
        closureReason: (partial.stage ?? stage) === "archived" ? closureReason || null : null,
        coldUntil: (partial.stage ?? stage) === "cold" ? coldUntilInput || null : null,
      });
      if (!r.ok) window.alert(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <PipelineOpportunityHeader
        opportunityId={opportunityId}
        title={title}
        sponsorLine={sponsorLine}
        activityCode={activityCode}
        closeDate={fo?.close_date ?? null}
        opportunityStatus={fo?.status ?? null}
        stage={stage}
        onStageChange={setStage}
        ownerId={ownerId}
        onOwnerChange={setOwnerId}
        profiles={profiles}
        communities={initialItem.communities}
        pending={pending}
        onSave={saveAssessment}
        externalUrl={externalUrl}
        triageAdvanceLabel={initialItem.communities.length > 0 ? "Send emails & monitor" : "Move to monitor"}
        onMoveToMonitor={() => {
          if (initialItem.communities.length > 0) {
            startTransition(async () => {
              const r = await sendPipelineOutreachEmailsAndMoveToMonitorAction({ opportunityId, mode: emailMode });
              if (!r.ok) window.alert(r.error);
              else {
                if (r.alreadyLogged) {
                  window.alert("Outreach was already logged for all matched PIs. Moved this opportunity to Monitor.");
                } else {
                  window.alert(`Sent ${r.sent} email(s) and moved this opportunity to Monitor.`);
                }
                router.refresh();
              }
            });
          } else {
            startTransition(async () => {
              const r = await updateSavedOpportunityPipelineAction({ opportunityId, stage: "monitor" });
              if (!r.ok) window.alert(r.error);
              else router.refresh();
            });
          }
        }}
        onMoveToCold={() =>
          startTransition(async () => {
            const r = await moveOpportunityToColdAction({ opportunityId, coldUntil: coldUntilInput || undefined });
            if (!r.ok) window.alert(r.error);
            else router.refresh();
          })
        }
        onArchive={() => {
          setStage("archived");
          persistPipeline({ stage: "archived" });
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_min(22rem,100%)] lg:items-start">
        <PipelineMetricsRow
          total={metrics.total}
          shortlisted={metrics.shortlisted}
          contacted={metrics.contacted}
          interested={metrics.interested}
          declined={metrics.declined}
          activeNextSteps={metrics.activeNextSteps}
        />
        <PipelineNextActionsCard item={itemForNextActions} matches={matches} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_min(22rem,100%)]">
        <div className="space-y-6">
          <PipelineSectionCard
            title="Opportunity snapshot"
            subtitle="High-signal context for triage — full documentation lives below."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Deadline</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">{formatDate(fo?.close_date ?? null)}</p>
              </div>
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Notice status</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">{fo?.status ?? "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Why this matters</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-700">
                  {whyMatters.trim() ? (
                    <>
                      {whyMatters.trim().slice(0, 280)}
                      {whyMatters.trim().length > 280 ? "…" : ""}
                    </>
                  ) : (
                    <span className="text-stone-500">Not captured yet — add one sentence in Strategy & documentation.</span>
                  )}
                </p>
              </div>
            </div>
            {stage === "monitor" ? (
              <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-700">
                <span className="font-semibold text-stone-900">Monitor pulse: </span>
                {monitorStatusLine(matches)}
              </p>
            ) : null}
            {stage === "cold" && coldUntilInput ? (
              <p className="mt-2 text-xs text-stone-600">
                Cold until {formatDate(coldUntilInput)} — then archived if untouched.
              </p>
            ) : null}
          </PipelineSectionCard>

          <PipelineSectionCard
            title="Communities & tags"
            subtitle="Tags drive routing, suggestions, and team context."
            action={
              <Button type="button" variant="secondary" className="text-xs" disabled={pending} onClick={saveAssessment}>
                Save tags
              </Button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {initialItem.communities.length === 0 ? (
                <p className="text-sm text-stone-600">No research communities tagged yet.</p>
              ) : (
                initialItem.communities.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center rounded-lg border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-950"
                  >
                    {c.label}
                  </span>
                ))
              )}
            </div>
            <p className="mt-3 text-xs text-stone-500">
              Manage community assignments from the pipeline board triage cards, or keep refining tags here.
            </p>
            <label className="mt-4 block text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
              Area / program tags
              <input
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="Comma-separated keywords…"
              />
            </label>
          </PipelineSectionCard>

          <PipelineSectionCard
            title="Investigator decision list"
            subtitle="Triage-first layout: scan chips, expand for rationale and notes, draft outreach from the panel below."
          >
            <div className="mb-5">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Add investigator</label>
              <input
                className="mt-1 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm"
                placeholder="Search directory (2+ characters)…"
                value={piQuery}
                onChange={(e) => setPiQuery(e.target.value)}
              />
              {piHits.length > 0 ? (
                <ul className="mt-2 max-w-md divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white text-sm shadow-sm">
                  {piHits.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate font-medium text-stone-900">{h.full_name}</span>
                      <Button type="button" variant="secondary" className="shrink-0 text-xs" disabled={pending} onClick={() => addPi(h.id)}>
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <InvestigatorDecisionList
              matches={matches}
              pending={pending}
              onPatch={patchMatch}
              onRemove={(id) =>
                startTransition(async () => {
                  const r = await removeSavedOpportunityPiMatchAction(id);
                  if (!r.ok) window.alert(r.error);
                  else router.refresh();
                })
              }
              onReorder={moveMatch}
              onBulkPatch={bulkPatch}
              onSelectOutreachTarget={(invId) => {
                setEmailTargetInvestigatorId(invId);
                setOutreachOpen(true);
              }}
            />
          </PipelineSectionCard>

          <PipelineSectionCard
            title="Outreach & activity"
            subtitle="Operational layer: templates, AI polish, send logging, and timeline."
          >
            <div className="rounded-xl border border-stone-200/90 bg-stone-50/50 p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-semibold text-stone-900"
                onClick={() => setOutreachOpen((o) => !o)}
                aria-expanded={outreachOpen}
              >
                Outreach drafting
                <span className="text-xs font-normal text-stone-500">{outreachOpen ? "Hide" : "Show"}</span>
              </button>
              {outreachOpen ? (
                <div className="mt-4 space-y-4 border-t border-stone-200/80 pt-4">
                  <p className="text-xs leading-relaxed text-stone-600">
                    Generate a concise note, refine with AI, then open in your mail client or log send for the monitor view.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EMAIL_DRAFT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setEmailMode(mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          emailMode === mode
                            ? "bg-white text-stone-900 ring-2 ring-stone-900/10"
                            : "text-stone-600 hover:bg-white/80"
                        }`}
                      >
                        {EMAIL_DRAFT_MODE_LABEL[mode]}
                      </button>
                    ))}
                  </div>
                  <label className="block text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                    Recipient
                    <Select
                      className="mt-1 max-w-md rounded-lg border-stone-300 bg-white text-sm"
                      value={emailTargetInvestigatorId}
                      onChange={(e) => setEmailTargetInvestigatorId(e.target.value)}
                    >
                      <option value="">—</option>
                      {matches.map((m) => (
                        <option key={m.id} value={m.investigator_id}>
                          {invName(m)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" disabled={pending || matches.length === 0} onClick={generateEmail}>
                      Generate draft
                    </Button>
                    <Button type="button" variant="secondary" disabled={!emailBody} onClick={() => void copyEmail()}>
                      Copy
                    </Button>
                    <Button type="button" variant="secondary" disabled={!emailBody || pending} onClick={() => runAiTransform("shorten")}>
                      Shorten
                    </Button>
                    <Button type="button" variant="secondary" disabled={!emailBody || pending} onClick={() => runAiTransform("lengthen")}>
                      Lengthen
                    </Button>
                    <Button type="button" variant="secondary" disabled={pending || !emailTargetInvestigatorId} onClick={openMailto}>
                      Open in email app
                    </Button>
                    <Button type="button" disabled={pending || !emailTargetInvestigatorId} onClick={logSent}>
                      Mark outreach sent
                    </Button>
                  </div>
                  <label className="block text-xs text-stone-600">
                    <span className="font-semibold text-stone-800">Agent instruction</span>
                    <Textarea
                      className="mt-1 min-h-[56px] rounded-lg border-stone-300 bg-white text-sm"
                      placeholder="e.g. Emphasize cohort access and keep under 200 words…"
                      value={agentInstruction}
                      onChange={(e) => setAgentInstruction(e.target.value)}
                    />
                  </label>
                  <Button type="button" variant="secondary" disabled={!emailBody || pending} onClick={() => runAiTransform("revise")}>
                    Apply instruction
                  </Button>
                  <Textarea
                    className="min-h-[200px] rounded-lg border-stone-300 bg-white font-mono text-sm text-stone-800"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-8">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Activity timeline</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  className="min-w-[12rem] flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm"
                  placeholder="Log a brief note…"
                  value={timelineNote}
                  onChange={(e) => setTimelineNote(e.target.value)}
                />
                <Button type="button" variant="secondary" disabled={pending || !timelineNote.trim()} onClick={addNote}>
                  Log note
                </Button>
              </div>
              <ul className="mt-4 max-h-[380px] space-y-2 overflow-y-auto">
                {activities.map((a) => (
                  <li key={a.id} className="rounded-xl border border-stone-200/90 bg-white px-4 py-3 text-sm shadow-sm">
                    <p className="text-xs font-semibold text-stone-900">
                      {activityTitle(a.event_type)} · {formatDateTime(a.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-stone-600">
                      {formatActivitySummary(a.event_type, a.payload)}
                    </p>
                  </li>
                ))}
              </ul>
              {activities.length === 0 ? <p className="mt-3 text-sm text-stone-500">No activity yet.</p> : null}
            </div>
          </PipelineSectionCard>

          <details className="group overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.03]">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-stone-900 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Strategy & documentation
                <span className="text-xs font-normal text-stone-500">Expand</span>
              </span>
            </summary>
            <div className="space-y-4 border-t border-stone-100 px-5 py-5">
              <div className="flex justify-end">
                <Button type="button" disabled={pending} onClick={saveAssessment}>
                  Save strategy
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                  Strategic value
                  <Select className="mt-1 rounded-lg border-stone-300 bg-white text-sm" value={strategic} onChange={(e) => setStrategic(e.target.value)}>
                    <option value="opportunistic">Opportunistic</option>
                    <option value="useful">Useful</option>
                    <option value="strategic">Strategic</option>
                    <option value="highly_strategic">Highly strategic</option>
                  </Select>
                </label>
                {stage === "archived" ? (
                  <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                    Closure reason
                    <Select className="mt-1 rounded-lg border-stone-300 bg-white text-sm" value={closureReason} onChange={(e) => setClosureReason(e.target.value)}>
                      <option value="">—</option>
                      {CLOSURE_REASONS.map((k) => (
                        <option key={k} value={k}>
                          {CLOSURE_REASON_LABEL[k]}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : (
                  <div />
                )}
                {stage === "cold" ? (
                  <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                    Cold until
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm"
                      value={coldUntilInput}
                      onChange={(e) => setColdUntilInput(e.target.value)}
                    />
                  </label>
                ) : (
                  <div />
                )}
              </div>
              <div>
                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Why this matters (full)</label>
                <Textarea className="mt-1 min-h-[88px] rounded-lg border-stone-300 bg-white text-sm" value={whyMatters} onChange={(e) => setWhyMatters(e.target.value)} />
              </div>
              <div>
                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Risks / barriers</label>
                <Textarea className="mt-1 min-h-[88px] rounded-lg border-stone-300 bg-white text-sm" value={risksBarriers} onChange={(e) => setRisksBarriers(e.target.value)} />
              </div>
              <div>
                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Internal notes</label>
                <Textarea className="mt-1 min-h-[120px] rounded-lg border-stone-300 bg-white text-sm" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              </div>
              <div className="border-t border-stone-100 pt-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Opportunity next steps</p>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-stone-600">Next action</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600">Due date</label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                      value={nextActionDate}
                      onChange={(e) => setNextActionDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        <aside className="space-y-6">
          <PipelineSuggestedMatches opportunityId={opportunityId} suggestions={suggestedInvestigators} />
        </aside>
      </div>
    </div>
  );
}
