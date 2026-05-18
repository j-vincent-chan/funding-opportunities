export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones: Record<typeof tone, string> = {
    neutral: "bg-slate-100 text-slate-800 border-slate-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-red-50 text-red-900 border-red-200",
    info: "bg-sky-50 text-sky-900 border-sky-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
