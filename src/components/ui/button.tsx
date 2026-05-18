import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--fo-on-accent)] shadow-sm hover:bg-[var(--fo-accent-emphasis)] border border-transparent hover:shadow-md active:scale-[0.98]",
  secondary:
    "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--fo-paper-2)] hover:border-[var(--fo-line-hover)] active:scale-[0.98]",
  ghost:
    "bg-transparent text-[var(--foreground)] hover:bg-[var(--fo-paper-2)] border border-transparent",
  danger: "bg-red-600/95 text-white hover:bg-red-700 border border-transparent shadow-sm active:scale-[0.98]",
};

export function Button({
  variant = "primary",
  type = "button",
  className = "",
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
