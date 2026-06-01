import { DotSphereIcon } from "@/components/ui/dot-sphere-icon";

type PageLoadingVariant = "light" | "terminal";

export function PageLoadingState({
  message = "Scanning…",
  detail,
  variant = "light",
  className = "",
}: {
  message?: string;
  detail?: string;
  variant?: PageLoadingVariant;
  className?: string;
}) {
  const isTerminal = variant === "terminal";

  return (
    <div
      className={`flex min-h-[min(52vh,28rem)] w-full flex-col items-center justify-center px-6 py-16 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <DotSphereIcon variant={variant} size={112} />
      <p
        className={`mt-8 text-sm font-medium tracking-wide ${
          isTerminal ? "text-[#94a3b8]" : "text-[var(--fo-ink-muted)]"
        }`}
      >
        {message}
      </p>
      {detail ? (
        <p className={`mt-2 max-w-sm text-center text-xs ${isTerminal ? "text-[#64748b]" : "text-[var(--fo-ink-muted)]/80"}`}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

