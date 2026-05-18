"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/match/saved", label: "Opportunity pipeline" },
  { href: "/match/quick", label: "AI-Assisted Matches" },
] as const;

export function MatchSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Match types">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
