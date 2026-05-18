type Variant = "sidebar" | "sidebar-collapsed" | "centered";

const attribution = "Powered by the Office of Collaborative Research";
const copyright = "© 2026 Office of Collaborative Research";

export function PoweredByOcr({ variant }: { variant: Variant }) {
  if (variant === "sidebar-collapsed") {
    return (
      <div className="mt-4 px-0.5 text-center md:px-1">
        <p className="text-[0.6rem] font-semibold leading-snug text-[var(--fo-ink-muted)] [overflow-wrap:anywhere] md:text-[0.65rem]">
          {attribution}
        </p>
        <p className="mt-1 text-[0.55rem] font-medium tabular-nums text-[var(--fo-ink-muted)] md:text-[0.6rem]">{copyright}</p>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div className="mt-8 max-w-md text-center">
        <p className="text-sm font-semibold leading-snug text-[var(--fo-display)]">{attribution}</p>
        <p className="mt-2 text-xs font-medium text-[var(--fo-ink-muted)]">{copyright}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--fo-sidebar-border)] bg-[color-mix(in_srgb,var(--fo-paper)_35%,var(--fo-sidebar-surface))] px-3 py-2.5">
      <p className="text-[0.6875rem] font-semibold leading-snug text-[var(--fo-display)] sm:text-xs">{attribution}</p>
      <p className="mt-1.5 text-[0.65rem] font-medium text-[var(--fo-ink-muted)]">{copyright}</p>
    </div>
  );
}
