import type { ReactNode } from "react";

export function PipelineSectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-stone-200/95 bg-white shadow-sm ring-1 ring-stone-950/[0.035] ${className}`}
    >
      <div className="flex flex-col gap-1 border-b border-stone-200/90 bg-stone-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-stone-500">{title}</h2>
          {subtitle ? <div className="mt-1 text-sm leading-snug text-stone-600">{subtitle}</div> : null}
        </div>
        {action ? <div className="mt-2 shrink-0 sm:mt-0">{action}</div> : null}
      </div>
      <div className={`px-5 py-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
