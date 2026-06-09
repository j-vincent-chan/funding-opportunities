"use client";

import { openExternalFundingUrl } from "@/lib/funding-opportunities/source-url";

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        d="M6 2.5H3.5A1 1 0 0 0 2.5 3.5v9A1 1 0 0 0 3.5 13.5h9a1 1 0 0 0 1-1V11M9 2.5h4.5V7M7 9l6.5-6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FundingSourceLinkIconButton({
  sourceUrl,
  compact = false,
  title = "Open source on agency site",
}: {
  sourceUrl: string | null | undefined;
  /** Matches peek panel header icon size (8×8, rounded-lg). */
  compact?: boolean;
  title?: string;
}) {
  if (!sourceUrl) return null;

  return (
    <button
      type="button"
      onClick={() => openExternalFundingUrl(sourceUrl)}
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center justify-center border border-[var(--fo-border)] bg-white text-[var(--fo-interaction)] transition-colors hover:border-[var(--fo-interaction)] hover:bg-[var(--fo-select-tint)] hover:text-[var(--fo-interaction)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
        compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-full"
      }`}
    >
      <ExternalLinkIcon className={compact ? "h-4 w-4" : "h-[1.15rem] w-[1.15rem]"} />
    </button>
  );
}
