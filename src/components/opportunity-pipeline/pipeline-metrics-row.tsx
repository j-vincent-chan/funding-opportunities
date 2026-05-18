"use client";

export function PipelineMetricsRow({
  total,
  shortlisted,
  contacted,
  interested,
  declined,
  activeNextSteps,
}: {
  total: number;
  shortlisted: number;
  contacted: number;
  interested: number;
  declined: number;
  activeNextSteps: number;
}) {
  const cells = [
    { label: "Candidates", value: total },
    { label: "Shortlisted", value: shortlisted },
    { label: "Contacted", value: contacted },
    { label: "Interested", value: interested },
    { label: "Passed", value: declined },
    { label: "Active next steps", value: activeNextSteps },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-stone-200/90 bg-white px-3 py-3 shadow-sm ring-1 ring-stone-950/[0.03]"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-stone-900">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
