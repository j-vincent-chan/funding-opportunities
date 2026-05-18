import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition-[border-color,box-shadow] duration-200 hover:border-[var(--fo-line-hover)] focus:border-[var(--fo-focus-border)] focus:ring-[3px] focus:ring-[var(--fo-focus-ring)] ${className}`}
      {...rest}
    />
  );
}
