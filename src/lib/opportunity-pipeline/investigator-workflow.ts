import type { MatchPriority, MatchStrength, OutreachStatus } from "@/lib/opportunity-pipeline/constants";
import { MATCH_PRIORITIES, MATCH_STRENGTHS } from "@/lib/opportunity-pipeline/constants";
import type { PipelinePiMatchRow } from "@/lib/opportunity-pipeline/serializers";

export type WorkflowPhaseId =
  | "unreviewed"
  | "shortlisted"
  | "pursuing"
  | "contacted"
  | "interested"
  | "maybe"
  | "passed";

export type WorkflowPhase = {
  id: WorkflowPhaseId;
  label: string;
  /** Tailwind-ish class bundle for chip (pipeline workbench) */
  chipClass: string;
};

const STRENGTH = new Set(MATCH_STRENGTHS as unknown as string[]);
const PRIORITY = new Set(MATCH_PRIORITIES as unknown as string[]);

export function coerceMatchPriority(raw: string | null | undefined): MatchPriority {
  const s = String(raw ?? "medium");
  return PRIORITY.has(s) ? (s as MatchPriority) : "medium";
}

export function getFitStrengthPresentation(m: PipelinePiMatchRow): { id: MatchStrength | "unknown"; label: string; chipClass: string } {
  const s = String(m.match_strength ?? "plausible");
  const id = STRENGTH.has(s) ? (s as MatchStrength) : "unknown";
  const label =
    id === "strong"
      ? "Strong fit"
      : id === "plausible"
        ? "Plausible fit"
        : id === "stretch"
          ? "Possible fit"
          : "Fit TBD";
  const chipClass =
    id === "strong"
      ? "border-emerald-300/80 bg-emerald-50 text-emerald-950"
      : id === "plausible"
        ? "border-sky-300/80 bg-sky-50 text-sky-950"
        : id === "stretch"
          ? "border-amber-300/80 bg-amber-50 text-amber-950"
          : "border-stone-300 bg-stone-100 text-stone-800";
  return { id, label, chipClass };
}

/** Workflow phase derived from outreach + primary target (no new DB columns). */
export function getWorkflowPhase(m: PipelinePiMatchRow): WorkflowPhase {
  const o = String(m.outreach_status ?? "not_contacted") as OutreachStatus;
  if (o === "responded_declined") {
    return { id: "passed", label: "Passed", chipClass: "border-rose-300/90 bg-rose-50 text-rose-950" };
  }
  if (o === "responded_interested") {
    return { id: "interested", label: "Interested", chipClass: "border-emerald-400/90 bg-emerald-50 text-emerald-950" };
  }
  if (o === "responded_maybe") {
    return { id: "maybe", label: "Maybe", chipClass: "border-sky-300/80 bg-sky-50 text-sky-950" };
  }
  if (o === "sent") {
    return { id: "contacted", label: "Contacted", chipClass: "border-violet-300/90 bg-violet-50 text-violet-950" };
  }
  if (o === "drafted") {
    return { id: "pursuing", label: "Pursuing", chipClass: "border-indigo-300/90 bg-indigo-50 text-indigo-950" };
  }
  if (m.is_primary_target) {
    return { id: "shortlisted", label: "Shortlisted", chipClass: "border-amber-400/90 bg-amber-50 text-amber-950" };
  }
  return { id: "unreviewed", label: "Unreviewed", chipClass: "border-stone-300 bg-stone-100 text-stone-800" };
}

export function getPriorityPresentation(p: MatchPriority): { label: string; chipClass: string } {
  const label = p === "high" ? "High" : p === "low" ? "Low" : "Medium";
  const chipClass =
    p === "high"
      ? "border-red-300/90 bg-red-50 text-red-950"
      : p === "low"
        ? "border-stone-300 bg-white text-stone-600"
        : "border-amber-300/80 bg-amber-50/80 text-amber-950";
  return { label, chipClass };
}

export function investigatorOrgLine(m: PipelinePiMatchRow): string {
  const inv = m.investigators;
  const one = inv && !Array.isArray(inv) ? inv : Array.isArray(inv) ? inv[0] : null;
  if (!one) return "—";
  const parts = [one.home_department, one.division].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : "—";
}

export function buildSuggestionWhyText(input: {
  communityLabel: string | null;
  agency: string | null;
  instrument: string | null;
  tags: string[];
}): string {
  const bits: string[] = [];
  if (input.communityLabel) {
    bits.push(`Aligned with the ${input.communityLabel} research community for this opportunity`);
  }
  if (input.tags.length) {
    bits.push(`Themes: ${input.tags.slice(0, 3).join(", ")}`);
  }
  const sponsor = [input.agency, input.instrument].filter(Boolean).join(" · ");
  if (sponsor) {
    bits.push(`Potential fit for ${sponsor} based on community triage and directory overlap`);
  } else {
    bits.push("Potential fit based on methodology, population, and prior submissions in related areas");
  }
  return bits.join(" · ") + ".";
}

export type InvestigatorSortKey = "match" | "priority" | "activity" | "name";

export function compareMatches(a: PipelinePiMatchRow, b: PipelinePiMatchRow, key: InvestigatorSortKey): number {
  if (key === "name") {
    const an = invSortName(a);
    const bn = invSortName(b);
    return an.localeCompare(bn, undefined, { sensitivity: "base" });
  }
  if (key === "priority") {
    const order = { high: 0, medium: 1, low: 2 };
    const ap = order[coerceMatchPriority(a.match_priority)];
    const bp = order[coerceMatchPriority(b.match_priority)];
    if (ap !== bp) return ap - bp;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  }
  if (key === "activity") {
    const at = lastTouchTs(a);
    const bt = lastTouchTs(b);
    if (at !== bt) return bt - at;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  }
  const orderS = { strong: 0, plausible: 1, stretch: 2 };
  const as = orderS[(STRENGTH.has(String(a.match_strength)) ? a.match_strength : "plausible") as MatchStrength] ?? 1;
  const bs = orderS[(STRENGTH.has(String(b.match_strength)) ? b.match_strength : "plausible") as MatchStrength] ?? 1;
  if (as !== bs) return as - bs;
  return (a.sort_order ?? 0) - (b.sort_order ?? 0);
}

function invSortName(m: PipelinePiMatchRow): string {
  const inv = m.investigators;
  const one = inv && !Array.isArray(inv) ? inv : Array.isArray(inv) ? inv[0] : null;
  return (one?.full_name ?? "").trim() || "—";
}

function lastTouchTs(m: PipelinePiMatchRow): number {
  const raw = m.outreach_sent_at ?? m.updated_at ?? "";
  const t = raw ? Date.parse(raw) : 0;
  return Number.isFinite(t) ? t : 0;
}

export type InvestigatorFilterBucket = "all" | "unreviewed" | "active" | "interested" | "passed" | "contacted" | "not_contacted";

export function matchInvestigatorFilterBucket(m: PipelinePiMatchRow, bucket: InvestigatorFilterBucket): boolean {
  if (bucket === "all") return true;
  const phase = getWorkflowPhase(m);
  if (bucket === "unreviewed") return phase.id === "unreviewed";
  if (bucket === "interested") return phase.id === "interested";
  if (bucket === "passed") return phase.id === "passed";
  if (bucket === "contacted") return phase.id === "contacted";
  if (bucket === "not_contacted") return String(m.outreach_status ?? "") === "not_contacted";
  if (bucket === "active") return ["pursuing", "contacted", "maybe", "shortlisted"].includes(phase.id);
  return true;
}

export function matchPriorityFilter(m: PipelinePiMatchRow, p: "all" | MatchPriority): boolean {
  if (p === "all") return true;
  return coerceMatchPriority(m.match_priority) === p;
}

export function matchInvestigatorSearch(m: PipelinePiMatchRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const inv = m.investigators;
  const one = inv && !Array.isArray(inv) ? inv : Array.isArray(inv) ? inv[0] : null;
  const name = (one?.full_name ?? "").toLowerCase();
  const email = (one?.email ?? "").toLowerCase();
  const org = investigatorOrgLine(m).toLowerCase();
  const rationale = (m.rationale ?? "").toLowerCase();
  return name.includes(s) || email.includes(s) || org.includes(s) || rationale.includes(s);
}
