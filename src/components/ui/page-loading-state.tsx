import { Spinner } from "@/components/ui/spinner";

type PageLoadingVariant = "light" | "terminal";

export function PageLoadingState({
  message = "Loading…",
  detail,
  variant = "light",
  compact = false,
  fill = false,
  className = "",
}: {
  message?: string;
  detail?: string;
  variant?: PageLoadingVariant;
  /** Smaller padding for Suspense fallbacks and inline panels. */
  compact?: boolean;
  /** Fill available height (peek panel, flex children). */
  fill?: boolean;
  className?: string;
}) {
  const isTerminal = variant === "terminal";
  const spinnerClass = isTerminal ? "border-slate-600 border-t-cyan-400" : "";

  const layout = fill
    ? "flex flex-1 flex-col items-center justify-center gap-3 text-center"
    : compact
      ? "flex flex-col items-center justify-center gap-3 py-8 text-center"
      : "flex min-h-[min(52vh,28rem)] w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center";

  return (
    <div className={`${layout} ${className}`} role="status" aria-live="polite" aria-busy="true">
      <Spinner size={compact || fill ? "md" : "lg"} className={spinnerClass} />
      <p
        className={`text-sm font-medium ${
          isTerminal ? "text-[#94a3b8]" : "text-[var(--fo-ink-muted)]"
        }`}
      >
        {message}
      </p>
      {detail ? (
        <p
          className={`max-w-sm text-xs ${
            isTerminal ? "text-[#64748b]" : "text-[var(--fo-ink-muted)]/80"
          }`}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}
