"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/pi-community", label: "Overview" },
  { href: "/pi-community/engagements", label: "Engagements" },
];

export function CommunitySubnav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {items.map((item) => {
        const active =
          item.href === "/pi-community"
            ? pathname === "/pi-community"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
