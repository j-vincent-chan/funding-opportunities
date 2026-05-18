export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--fo-paper-2)_92%,transparent)] px-8 py-14 text-center transition-colors duration-200 hover:border-[var(--fo-line-hover)] ${className}`}
    >
      <p className="text-[0.9375rem] font-medium text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
