"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: {
  href: string;
  label: string;
  disabled: boolean;
  disabledTitle?: string;
}[] = [
  { href: "/match/saved", label: "Opportunity pipeline", disabled: false },
  {
    href: "/match/quick",
    label: "AI-Assisted Matches",
    disabled: true,
    disabledTitle: "Not available yet — use Opportunity pipeline",
  },
];

export function MatchSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Match types">
      {links.map(({ href, label, disabled, disabledTitle }) => {
        const active = !disabled && (pathname === href || pathname.startsWith(`${href}/`));

        if (disabled) {
          return (
            <span
              key={href}
              aria-disabled="true"
              title={disabledTitle}
              className="cursor-not-allowed rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-[var(--fo-ink-faint)] opacity-50"
            >
              {label}
            </span>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              active
                ? "bg-[var(--fo-interaction)] text-[var(--fo-on-accent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_35%,transparent)]"
                : "border border-transparent text-[var(--fo-ink-body)] hover:border-[var(--fo-border)] hover:bg-[var(--fo-panel)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
