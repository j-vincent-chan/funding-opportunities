"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { signOut } from "@/app/actions/auth";
import { PoweredByOcr } from "@/components/layout/powered-by-ocr";
import {
  SidebarIconCommunity,
  SidebarIconDashboard,
  SidebarIconInvestigators,
  SidebarIconMatch,
  SidebarIconPanelClose,
  SidebarIconPanelOpen,
  SidebarIconSearch,
  SidebarIconSettings,
  SidebarIconSignOut,
} from "@/components/layout/sidebar-nav-icons";

const SIDEBAR_COLLAPSED_KEY = "pursuit-queue-sidebar-collapsed";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  href: string;
  label: string;
  Icon: Icon;
  isActive: (pathname: string) => boolean;
};

const sections: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Start",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        Icon: SidebarIconDashboard,
        isActive: (p) => p === "/dashboard" || p === "/",
      },
    ],
  },
  {
    heading: "Opportunities",
    items: [
      {
        href: "/funding-opportunities",
        label: "Search",
        Icon: SidebarIconSearch,
        isActive: (p) => p.startsWith("/funding-opportunities"),
      },
    ],
  },
  {
    heading: "Matching",
    items: [
      {
        href: "/match/saved",
        label: "Match",
        Icon: SidebarIconMatch,
        isActive: (p) => p === "/match" || p.startsWith("/match/"),
      },
    ],
  },
  {
    heading: "Community",
    items: [
      {
        href: "/pi-community",
        label: "Community Snapshot",
        Icon: SidebarIconCommunity,
        isActive: (p) => p.startsWith("/pi-community"),
      },
    ],
  },
  {
    heading: "People",
    items: [
      {
        href: "/investigators",
        label: "Investigators",
        Icon: SidebarIconInvestigators,
        isActive: (p) => p.startsWith("/investigators"),
      },
    ],
  },
];

const navLinkBase =
  "group flex min-w-0 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium tracking-tight transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fo-sidebar-surface)]";

function NavRow({
  item,
  pathname,
  collapsedDesktop,
}: {
  item: NavItem;
  pathname: string;
  collapsedDesktop: boolean;
}) {
  const active = item.isActive(pathname);
  const Icon = item.Icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={`${navLinkBase} ${
        collapsedDesktop ? "md:justify-center md:gap-0 md:px-2 md:py-2.5" : ""
      } ${
        active
          ? "border-l-[3px] border-l-[var(--fo-interaction)] bg-[var(--fo-nav-active-bg)] font-semibold text-[var(--fo-nav-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_18%,var(--fo-sidebar-border))]"
          : "border-l-[3px] border-l-transparent text-[var(--fo-nav-inactive-fg)] hover:border-l-[var(--fo-border)] hover:bg-[var(--fo-nav-hover-bg)] hover:text-[var(--fo-title)]"
      }`}
    >
      <Icon
        className={`h-5 w-5 shrink-0 transition-colors duration-200 ${
          active ? "text-[var(--fo-interaction)]" : "text-[var(--fo-ink-muted)] group-hover:text-[var(--fo-interaction)]"
        }`}
      />
      <span className={`min-w-0 leading-snug ${collapsedDesktop ? "md:sr-only" : ""}`}>{item.label}</span>
    </Link>
  );
}

export function AppShellSidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, mounted]);

  const collapsedDesktop = mounted && collapsed;
  const mobileItems = sections.flatMap((s) => s.items);

  return (
    <aside
      className={`flex w-full shrink-0 flex-col border-b border-[var(--fo-sidebar-border)] bg-[var(--fo-sidebar-surface)] md:min-h-screen md:border-b-0 md:border-r md:py-6 md:transition-[width] md:duration-300 md:ease-out ${
        collapsedDesktop ? "md:w-[4.5rem]" : "md:w-[min(100%,17.5rem)]"
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="hidden justify-end px-2 pb-1 pt-0 md:flex">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-xl p-2 text-[var(--fo-ink-muted)] transition-colors hover:bg-[var(--fo-nav-hover-bg)] hover:text-[var(--fo-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)]"
            aria-expanded={!collapsedDesktop}
            aria-controls="app-sidebar-primary"
            title={collapsedDesktop ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsedDesktop ? (
              <SidebarIconPanelOpen className="h-5 w-5" aria-hidden />
            ) : (
              <SidebarIconPanelClose className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        <div className={`px-3 pb-2 pt-1 md:px-4 md:pb-4 ${collapsedDesktop ? "md:px-2" : ""}`}>
          <Link
            href="/dashboard"
            title="Research intelligence — home"
            className={`block rounded-2xl border border-[var(--fo-sidebar-border)] bg-[var(--fo-sidebar-surface-elevated)] shadow-md ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_6%,transparent)] transition-[box-shadow,border-color] duration-200 hover:border-[var(--fo-line-hover)] hover:shadow-lg ${
              collapsedDesktop ? "md:px-2 md:py-3" : "px-4 py-3.5"
            }`}
          >
            {collapsedDesktop ? (
              <>
                <span className="hidden text-xs font-bold tracking-tight text-[var(--fo-interaction)] md:flex md:h-10 md:w-full md:items-center md:justify-center md:rounded-xl md:bg-[var(--fo-paper-2)]">
                  RI
                </span>
                <span className="md:hidden">
                  <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--fo-sidebar-heading)]">
                    Workspace
                  </span>
                  <span className="mt-1.5 block text-base font-semibold leading-snug tracking-tight text-[var(--fo-sidebar-fg)]">
                    Research intelligence
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--fo-sidebar-heading)]">
                  Workspace
                </span>
                <span className="mt-1.5 block text-base font-semibold leading-snug tracking-tight text-[var(--fo-sidebar-fg)]">
                  Research intelligence
                </span>
                <span className="mt-1.5 hidden text-xs font-normal leading-relaxed text-[var(--fo-sidebar-fg-muted)] md:block">
                  Funding, matching, and investigator portfolio
                </span>
              </>
            )}
          </Link>
        </div>

        <nav
          className="flex flex-row gap-1.5 overflow-x-auto overflow-y-hidden px-2 pb-3 pt-1 [-webkit-overflow-scrolling:touch] md:hidden"
          aria-label="Primary"
        >
          {mobileItems.map((item) => (
            <NavRow key={item.href} item={item} pathname={pathname} collapsedDesktop={false} />
          ))}
        </nav>

        <nav
          id="app-sidebar-primary"
          className="hidden min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 pb-2 md:flex"
          aria-label="Primary"
        >
          {sections.map((section, sectionIndex) => (
            <div key={section.heading} className={`space-y-2 ${sectionIndex > 0 ? "pt-6" : ""}`}>
              <h2
                className={`px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--fo-sidebar-heading)] ${
                  collapsedDesktop ? "md:hidden" : ""
                }`}
              >
                {section.heading}
              </h2>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavRow item={item} pathname={pathname} collapsedDesktop={collapsedDesktop} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={`mt-auto border-t border-[var(--fo-sidebar-border)] px-3 py-4 md:px-4 ${collapsedDesktop ? "md:px-2" : ""}`}>
          <Link
            href="/settings"
            title="Settings"
            aria-current={settingsActive ? "page" : undefined}
            className={`${navLinkBase} mb-3 ${
              collapsedDesktop ? "md:mb-2 md:justify-center md:gap-0 md:px-2 md:py-2.5" : ""
            } ${
              settingsActive
                ? "border-l-[3px] border-l-[var(--fo-interaction)] bg-[var(--fo-nav-active-bg)] font-semibold text-[var(--fo-nav-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_18%,var(--fo-sidebar-border))]"
                : "border-l-[3px] border-l-transparent text-[var(--fo-nav-inactive-fg)] hover:border-l-[var(--fo-border)] hover:bg-[var(--fo-nav-hover-bg)] hover:text-[var(--fo-title)]"
            }`}
          >
            <SidebarIconSettings
              className={`h-5 w-5 shrink-0 ${
                settingsActive ? "text-[var(--fo-interaction)]" : "text-[var(--fo-ink-muted)] group-hover:text-[var(--fo-interaction)]"
              }`}
            />
            <span className={collapsedDesktop ? "md:sr-only" : ""}>Settings</span>
          </Link>

          {userEmail ? (
            <p
              className={`truncate px-3 text-xs font-medium leading-relaxed text-[var(--fo-sidebar-fg-muted)] ${
                collapsedDesktop ? "md:hidden" : ""
              }`}
              title={userEmail}
            >
              {userEmail}
            </p>
          ) : null}

          <form action={signOut} className="mt-2">
            <button
              type="submit"
              title="Sign out"
              className={`${navLinkBase} w-full text-left text-[var(--fo-nav-inactive-fg)] hover:bg-[var(--fo-nav-hover-bg)] hover:text-[var(--fo-title)] ${
                collapsedDesktop ? "md:justify-center md:px-2 md:py-2.5" : ""
              }`}
            >
              <SidebarIconSignOut className="h-5 w-5 shrink-0 text-[var(--fo-ink-muted)] group-hover:text-[var(--fo-interaction)]" />
              <span className={collapsedDesktop ? "md:sr-only" : ""}>Sign out</span>
            </button>
          </form>

          <PoweredByOcr variant={collapsedDesktop ? "sidebar-collapsed" : "sidebar"} />
        </div>
      </div>
    </aside>
  );
}
