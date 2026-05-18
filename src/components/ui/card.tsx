import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-soft ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-t-2xl border-b border-[var(--border)] bg-[var(--fo-paper-2)]/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
        {description ? (
          <div className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">{description}</div>
        ) : null}
      </div>
      {action ? <div className="mt-2 sm:mt-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
