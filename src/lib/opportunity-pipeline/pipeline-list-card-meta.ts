import { formatDate } from "@/lib/formatting/dates";
import { outreachCardSummary, type PipelinePiMatchRow } from "@/lib/opportunity-pipeline/serializers";

export type DeadlineUrgency = {
  /** Short badge text */
  badge: string;
  /** Top accent bar on card */
  barClass: string;
  /** Pill around badge */
  badgeClass: string;
  /** Semantic level for layout tweaks */
  level: "none" | "past" | "critical" | "soon" | "upcoming" | "later";
};

/** Classify deadline vs today (YYYY-MM-DD) for triage visuals. */
export function deadlineUrgency(closeDate: string | null, today: string): DeadlineUrgency {
  if (!closeDate) {
    return {
      badge: "No deadline",
      barClass: "bg-slate-300",
      badgeClass: "border border-slate-200 bg-slate-50 text-slate-600",
      level: "none",
    };
  }
  if (closeDate === today) {
    return {
      badge: "Due today",
      barClass: "bg-[#c97818]",
      badgeClass: "border border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] text-[var(--fo-warn-text)] font-semibold",
      level: "critical",
    };
  }
  if (closeDate < today) {
    return {
      badge: "Past due",
      barClass: "bg-red-600",
      badgeClass: "border border-red-200 bg-red-50 text-red-900 font-semibold",
      level: "past",
    };
  }
  const ms = new Date(`${closeDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime();
  const days = Math.ceil(ms / 86400000);
  if (days <= 7) {
    return {
      badge: days === 1 ? "Due tomorrow" : `${days} days`,
      barClass: "bg-[#c97818]",
      badgeClass: "border border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] text-[var(--fo-warn-text)] font-semibold",
      level: "critical",
    };
  }
  if (days <= 21) {
    return {
      badge: `${days} days`,
      barClass: "bg-[#d9a23d]",
      badgeClass: "border border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] text-[var(--fo-warn-text)] font-semibold",
      level: "soon",
    };
  }
  if (days <= 60) {
    return {
      badge: formatDate(closeDate),
      barClass: "bg-slate-400",
      badgeClass: "border border-slate-200 bg-slate-50 text-slate-800",
      level: "upcoming",
    };
  }
  return {
    badge: formatDate(closeDate),
    barClass: "bg-slate-300",
    badgeClass: "border border-slate-200 bg-white text-slate-700",
    level: "later",
  };
}

export type PiPortfolioTone = "empty" | "warm" | "active" | "hot";

export function piPortfolioSummary(matches: PipelinePiMatchRow[]): {
  headline: string;
  detail: string;
  tone: PiPortfolioTone;
} {
  const { sent, interested, total } = outreachCardSummary(matches);
  const shortlisted = matches.filter((m) => m.is_primary_target).length;
  const strong = matches.filter((m) => m.match_strength === "strong").length;

  if (total === 0) {
    return {
      headline: "No investigators linked",
      detail: "Link PIs from the roster or open the card to search the directory.",
      tone: "empty",
    };
  }

  const parts: string[] = [`${total} investigator${total === 1 ? "" : "s"}`];
  if (shortlisted) parts.push(`${shortlisted} shortlisted`);
  if (strong && strong !== total) parts.push(`${strong} strong fit`);

  const outreachBits: string[] = [];
  if (sent > 0) outreachBits.push(`${sent} contacted`);
  if (interested > 0) outreachBits.push(`${interested} interested`);

  const detail =
    outreachBits.length > 0 ? `${outreachBits.join(" · ")}` : "Outreach not logged yet — draft from the card when ready.";

  let tone: PiPortfolioTone = "warm";
  if (interested > 0) tone = "hot";
  else if (sent > 0 || matches.some((m) => m.outreach_status === "drafted")) tone = "active";

  return {
    headline: parts.join(" · "),
    detail,
    tone,
  };
}
