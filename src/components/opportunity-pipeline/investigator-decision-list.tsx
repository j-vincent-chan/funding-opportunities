"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MATCH_PRIORITIES,
  MATCH_PRIORITY_LABEL,
  MATCH_STRENGTHS,
  OUTREACH_STATUSES,
  OUTREACH_STATUS_LABEL,
  ROLE_LABEL,
  ROLE_SUGGESTIONS,
  type MatchPriority,
  type OutreachStatus,
} from "@/lib/opportunity-pipeline/constants";
import {
  compareMatches,
  coerceMatchPriority,
  getFitStrengthPresentation,
  getPriorityPresentation,
  getWorkflowPhase,
  investigatorOrgLine,
  matchInvestigatorFilterBucket,
  matchInvestigatorSearch,
  matchPriorityFilter,
  type InvestigatorFilterBucket,
  type InvestigatorSortKey,
} from "@/lib/opportunity-pipeline/investigator-workflow";
import { formatDate } from "@/lib/formatting/dates";
import { invName, type PipelinePiMatchRow } from "@/lib/opportunity-pipeline/serializers";

export type PiMatchPatch = {
  matchStrength?: string;
  matchPriority?: string;
  rationale?: string | null;
  roleSuggestion?: string;
  outreachStatus?: string;
  notes?: string | null;
  isPrimaryTarget?: boolean;
  followUpDate?: string | null;
};

function Chip({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold leading-tight ${className}`}
    >
      {children}
    </span>
  );
}

function lastTouchedLabel(m: PipelinePiMatchRow): string {
  const raw = m.outreach_sent_at ?? m.updated_at ?? "";
  if (!raw) return "—";
  return formatDate(raw.slice(0, 10));
}

export function InvestigatorDecisionList({
  matches,
  pending,
  onPatch,
  onRemove,
  onReorder,
  onBulkPatch,
  onSelectOutreachTarget,
}: {
  matches: PipelinePiMatchRow[];
  pending: boolean;
  onPatch: (matchId: string, patch: PiMatchPatch) => void;
  onRemove: (matchId: string) => void;
  onReorder: (index: number, dir: -1 | 1) => void;
  onBulkPatch: (matchIds: string[], patch: PiMatchPatch) => void;
  onSelectOutreachTarget: (investigatorId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<InvestigatorFilterBucket>("all");
  const [pri, setPri] = useState<"all" | MatchPriority>("all");
  const [sortKey, setSortKey] = useState<InvestigatorSortKey>("match");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelected({});
  }, [matches]);

  const filtered = useMemo(() => {
    const list = matches.filter((m) => matchInvestigatorFilterBucket(m, bucket));
    const p2 = list.filter((m) => matchPriorityFilter(m, pri));
    const p3 = p2.filter((m) => matchInvestigatorSearch(m, q));
    return [...p3].sort((a, b) => compareMatches(a, b, sortKey));
  }, [matches, bucket, pri, q, sortKey]);

  const primaryFiltered = useMemo(() => filtered.filter((m) => m.is_primary_target), [filtered]);
  const restFiltered = useMemo(() => filtered.filter((m) => !m.is_primary_target), [filtered]);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  function toggleSelect(id: string, next: boolean) {
    setSelected((s) => ({ ...s, [id]: next }));
  }

  function toggleExpanded(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  function renderRow(m: PipelinePiMatchRow, globalIndex: number) {
    const inv = m.investigators;
    const one = inv && !Array.isArray(inv) ? inv : Array.isArray(inv) ? inv[0] : null;
    const invId = one?.id ?? m.investigator_id;
    const fit = getFitStrengthPresentation(m);
    const phase = getWorkflowPhase(m);
    const mp = getPriorityPresentation(coerceMatchPriority(m.match_priority));
    const open = expandedId === m.id;
    const rationalePreview = (m.rationale ?? "").trim().slice(0, 120);

    return (
      <li key={m.id} className="rounded-xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
        <div
          className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 ${open ? "border-b border-stone-100 bg-stone-50/50" : ""}`}
        >
          <div className="flex items-start gap-2 sm:w-8 sm:shrink-0 sm:justify-center">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-stone-400 text-stone-900 focus:ring-2 focus:ring-stone-400/40"
              checked={!!selected[m.id]}
              disabled={pending}
              onChange={(e) => toggleSelect(m.id, e.target.checked)}
              aria-label={`Select ${invName(m)}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleExpanded(m.id)}
                className="text-left text-sm font-semibold text-stone-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50"
              >
                {invName(m)}
              </button>
              {m.is_primary_target ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-900">
                  Shortlist
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-stone-600">{investigatorOrgLine(m)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip className={fit.chipClass}>{fit.label}</Chip>
              <Chip className={phase.chipClass}>{phase.label}</Chip>
              <Chip className={mp.chipClass}>Priority · {mp.label}</Chip>
            </div>
            {rationalePreview ? (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600">
                <span className="font-semibold text-stone-700">Why matched: </span>
                {rationalePreview}
                {(m.rationale ?? "").trim().length > 120 ? "…" : ""}
              </p>
            ) : (
              <p className="mt-2 text-xs italic text-stone-500">No short fit note yet — expand to add rationale.</p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:flex sm:flex-col sm:items-end">
            <div className="text-stone-500 sm:text-right">
              <span className="font-semibold text-stone-700">Outreach</span>
              <div className="text-stone-800">
                {OUTREACH_STATUS_LABEL[m.outreach_status as OutreachStatus] ?? m.outreach_status}
              </div>
            </div>
            <div className="text-stone-500 sm:text-right">
              <span className="font-semibold text-stone-700">Last touched</span>
              <div className="tabular-nums text-stone-800">{lastTouchedLabel(m)}</div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
            <Button type="button" variant="secondary" className="px-2.5 py-1.5 text-xs" disabled={pending} onClick={() => onSelectOutreachTarget(invId)}>
              Draft email
            </Button>
            <Link
              href={`/investigators/${invId}`}
              className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
            >
              Profile
            </Link>
            <Button type="button" variant="ghost" className="px-2 py-1 text-xs text-stone-600" onClick={() => toggleExpanded(m.id)}>
              {open ? "Collapse" : "Details"}
            </Button>
          </div>
        </div>
        {open ? (
          <div className="space-y-4 px-3 pb-4 pt-1 sm:px-6">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                Match strength
                <Select
                  className="mt-1 rounded-lg border-stone-300 bg-white text-sm"
                  value={m.match_strength}
                  disabled={pending}
                  onChange={(e) => onPatch(m.id, { matchStrength: e.target.value })}
                >
                  {MATCH_STRENGTHS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                Triage priority
                <Select
                  className="mt-1 rounded-lg border-stone-300 bg-white text-sm"
                  value={coerceMatchPriority(m.match_priority)}
                  disabled={pending}
                  onChange={(e) => onPatch(m.id, { matchPriority: e.target.value })}
                >
                  {MATCH_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {MATCH_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                Outreach status
                <Select
                  className="mt-1 rounded-lg border-stone-300 bg-white text-sm"
                  value={m.outreach_status}
                  disabled={pending}
                  onChange={(e) => onPatch(m.id, { outreachStatus: e.target.value })}
                >
                  {OUTREACH_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {OUTREACH_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                Role suggestion
                <Select
                  className="mt-1 rounded-lg border-stone-300 bg-white text-sm"
                  value={m.role_suggestion}
                  disabled={pending}
                  onChange={(e) => onPatch(m.id, { roleSuggestion: e.target.value })}
                >
                  {ROLE_SUGGESTIONS.map((s) => (
                    <option key={s} value={s}>
                      {ROLE_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                Follow-up date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
                  value={m.follow_up_date ?? ""}
                  disabled={pending}
                  onChange={(e) => onPatch(m.id, { followUpDate: e.target.value || null })}
                />
              </label>
              <label className="flex items-end gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-400"
                  checked={m.is_primary_target}
                  disabled={pending}
                  onChange={(e) => onPatch(m.id, { isPrimaryTarget: e.target.checked })}
                />
                Primary / shortlist target
              </label>
            </div>
            <div>
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Full rationale</label>
              <Textarea
                key={`r-${m.id}-${m.updated_at ?? ""}`}
                className="mt-1 min-h-[72px] rounded-lg border-stone-300 bg-white text-sm"
                defaultValue={m.rationale ?? ""}
                disabled={pending}
                onBlur={(e) => {
                  if (e.target.value !== (m.rationale ?? "")) onPatch(m.id, { rationale: e.target.value });
                }}
              />
            </div>
            <div>
              <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">Internal notes</label>
              <Textarea
                key={`n-${m.id}-${m.updated_at ?? ""}`}
                className="mt-1 min-h-[72px] rounded-lg border-stone-300 bg-white text-sm"
                defaultValue={m.notes ?? ""}
                disabled={pending}
                onBlur={(e) => {
                  if (e.target.value !== (m.notes ?? "")) onPatch(m.id, { notes: e.target.value });
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
              <Button type="button" variant="ghost" className="text-xs" disabled={pending || globalIndex === 0} onClick={() => onReorder(globalIndex, -1)}>
                Move up
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                disabled={pending || globalIndex >= matches.length - 1}
                onClick={() => onReorder(globalIndex, 1)}
              >
                Move down
              </Button>
              <Button type="button" variant="danger" className="text-xs" disabled={pending} onClick={() => onRemove(m.id)}>
                Remove from opportunity
              </Button>
            </div>
          </div>
        ) : null}
      </li>
    );
  }

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    matches.forEach((row, i) => m.set(row.id, i));
    return m;
  }, [matches]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200/90 bg-stone-50/60 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
            Search
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 shadow-sm"
              placeholder="Name, email, department…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
            Workflow
            <Select className="mt-1 rounded-lg border-stone-300 bg-white text-sm" value={bucket} onChange={(e) => setBucket(e.target.value as InvestigatorFilterBucket)}>
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="active">Active / in motion</option>
              <option value="contacted">Contacted</option>
              <option value="not_contacted">Not contacted</option>
              <option value="interested">Interested</option>
              <option value="passed">Passed</option>
            </Select>
          </label>
          <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
            Priority
            <Select className="mt-1 rounded-lg border-stone-300 bg-white text-sm" value={pri} onChange={(e) => setPri(e.target.value as typeof pri)}>
              <option value="all">All</option>
              {MATCH_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {MATCH_PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
            Sort
            <Select className="mt-1 rounded-lg border-stone-300 bg-white text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as InvestigatorSortKey)}>
              <option value="match">Match strength</option>
              <option value="priority">Priority</option>
              <option value="activity">Recent activity</option>
              <option value="name">Alphabetical</option>
            </Select>
          </label>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-semibold text-stone-800">{selectedIds.length} selected</span>
          <Button type="button" variant="secondary" className="text-xs" disabled={pending} onClick={() => onBulkPatch(selectedIds, { outreachStatus: "drafted" })}>
            Mark reviewed
          </Button>
          <Button type="button" variant="secondary" className="text-xs" disabled={pending} onClick={() => onBulkPatch(selectedIds, { isPrimaryTarget: true })}>
            Shortlist (first = primary)
          </Button>
          <Button type="button" variant="secondary" className="text-xs" disabled={pending} onClick={() => onBulkPatch(selectedIds, { outreachStatus: "sent" })}>
            Mark contacted
          </Button>
          <Button type="button" variant="secondary" className="text-xs" disabled={pending} onClick={() => onBulkPatch(selectedIds, { outreachStatus: "responded_declined" })}>
            Not a fit
          </Button>
          <Button type="button" variant="ghost" className="text-xs" onClick={() => setSelected({})}>
            Clear selection
          </Button>
        </div>
      ) : null}

      {primaryFiltered.length > 0 ? (
        <div>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500">Shortlisted & primary targets</p>
          <ul className="space-y-2">
            {primaryFiltered.map((m) => renderRow(m, indexById.get(m.id) ?? 0))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500">All candidate investigators</p>
        {restFiltered.length === 0 && primaryFiltered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-8 text-center text-sm text-stone-600">
            No investigators match these filters.
          </p>
        ) : (
          <ul className="space-y-2">
            {restFiltered.map((m) => renderRow(m, indexById.get(m.id) ?? 0))}
          </ul>
        )}
      </div>
    </div>
  );
}
