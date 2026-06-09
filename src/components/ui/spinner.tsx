const SIZE_CLASS = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
} as const;

export function Spinner({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-[var(--fo-border)] border-t-[var(--fo-interaction)] ${SIZE_CLASS[size]} ${className}`}
      aria-hidden
    />
  );
}
