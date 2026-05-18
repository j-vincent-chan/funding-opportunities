import Link from "next/link";
import type { RankedOpportunityMatch, RankedPiMatch } from "@/lib/quick-match/engine";

export function QuickMatchInvestigatorList({ items }: { items: RankedPiMatch[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--fo-ink-muted)]">
        No AI-Assisted Matches overlap yet. Expand the shared taxonomy or add richer PI / opportunity text
        (research focal areas, disease focus, methods).
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <li
          key={row.pi.id}
          className="rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper-2)] p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <Link
                href={`/investigators/${row.pi.id}`}
                className="font-semibold text-[var(--fo-interaction)] hover:text-[var(--fo-title)] hover:underline"
              >
                {row.pi.full_name}
              </Link>
              <p className="text-xs text-[var(--fo-ink-muted)]">
                {row.pi.home_department ?? row.pi.division ?? "—"}
              </p>
            </div>
            <span
              className="rounded-full bg-[var(--fo-paper)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--fo-title)] ring-1 ring-[var(--fo-border)]"
              title="0–100 score from weighted tag overlap"
            >
              {row.totalScore}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fo-ink-body)]">{row.explanation}</p>
          <p className="mt-1 text-[0.7rem] text-[var(--fo-ink-muted)]">
            Weighted raw {row.breakdown.rawScore} / {row.breakdown.maxRaw} (see{" "}
            <code className="rounded bg-[var(--fo-paper)] px-1">scoring-weights.ts</code>)
          </p>
        </li>
      ))}
    </ul>
  );
}

export function QuickMatchOpportunityList({ items }: { items: RankedOpportunityMatch[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--fo-ink-muted)]">
        No AI-Assisted Matches overlap in the loaded opportunity set. Try broadening PI tags or syncing more
        notices.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <li
          key={row.opportunityId}
          className="rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper-2)] p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <Link
                href={`/funding-opportunities/${row.opportunityId}`}
                className="font-semibold text-[var(--fo-interaction)] hover:text-[var(--fo-title)] hover:underline"
              >
                {row.title}
              </Link>
              <p className="text-xs text-[var(--fo-ink-muted)]">{row.agency ?? "—"}</p>
            </div>
            <span className="rounded-full bg-[var(--fo-paper)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--fo-title)] ring-1 ring-[var(--fo-border)]">
              {row.totalScore}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fo-ink-body)]">{row.explanation}</p>
          <p className="mt-1 text-[0.7rem] text-[var(--fo-ink-muted)]">
            Weighted raw {row.breakdown.rawScore} / {row.breakdown.maxRaw}
          </p>
        </li>
      ))}
    </ul>
  );
}
