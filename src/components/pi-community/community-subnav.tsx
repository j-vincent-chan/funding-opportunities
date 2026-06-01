"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/portfolio-intelligence", label: "Overview" },
  { href: "/portfolio-intelligence/data-sources", label: "Data sources" },
  { href: "/portfolio-intelligence/engagements", label: "Engagements" },
];

export function CommunitySubnav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
      {items.map((item) => {
        const active =
          item.href === "/portfolio-intelligence"
            ? pathname === "/portfolio-intelligence"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active
                ? "bg-[var(--fo-interaction)] text-white"
                : "text-[var(--fo-ink-muted)] hover:bg-[var(--fo-paper-2)] hover:text-[var(--fo-title)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
