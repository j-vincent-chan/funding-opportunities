"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_FUNDING_LIST_PAGE,
  defaultSidebarFilterPatch,
  fundingListHref,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
  type FundingListClientState,
} from "@/lib/funding-opportunities/funding-list-url";
import {
  isQuickFilterActive,
  type FundingListQuickFilterTab,
} from "@/lib/funding-opportunities/funding-quick-filters";

export type FundingQuickFiltersCounts = {
  matched: number;
  closing: { d30: number; d60: number; d90: number };
  scope: { all: number; open: number; forecasted: number };
  new: { week: number; month: number; quarter: number };
  esi: number;
  collaborative: number;
  investigatorInitiated: number;
  foundations: number;
};

type PillTone = "violet" | "teal" | "red" | "neutral";

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className ?? "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FunnelIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2 3.5h12L9 9v4l-2 1V9L2 3.5z" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
      <path d="M8 1.5l.9 2.8L11.7 5l-2.8.9L8 8.7 7.1 5.9 4.3 5l2.8-.9L8 1.5zm4.5 7.2.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8zM3.5 9.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="5.25" />
      <path d="M8 5.5V8l2 1.25" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="5.25" />
      <circle cx="8" cy="8" r="2.25" />
      <circle cx="8" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 2.5a3.25 3.25 0 0 1 3.25 3.25v2.5l1 2H3.75l1-2V5.75A3.25 3.25 0 0 1 8 2.5z" strokeLinejoin="round" />
      <path d="M6.75 12.25a1.25 1.25 0 0 0 2.5 0" strokeLinecap="round" />
    </svg>
  );
}

function pillClasses(tone: PillTone, active: boolean): string {
  const base =
    "inline-flex items-center gap-2 rounded-[22px] border px-3 py-1.5 text-[14px] font-medium leading-snug transition-colors";

  if (tone === "red") {
    return active
      ? `${base} border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)] text-[var(--fo-warn-text)] shadow-[var(--fo-shadow-sm)]`
      : `${base} border-[color-mix(in_srgb,var(--fo-warn-border)_55%,var(--fo-border))] bg-[var(--fo-warn-bg)] text-[var(--fo-warn-text)] hover:border-[var(--fo-warn-border)]`;
  }
  if (tone === "teal") {
    return active
      ? `${base} border-[var(--fo-brand)] bg-[var(--fo-brand)] text-white shadow-[var(--fo-shadow-sm)]`
      : `${base} border-[color-mix(in_srgb,var(--fo-brand)_35%,var(--fo-border))] bg-[var(--fo-sage-soft)] text-[var(--fo-success-text)] hover:border-[var(--fo-brand)]`;
  }
  if (tone === "neutral") {
    return active
      ? `${base} border-[var(--fo-brand)] bg-[var(--fo-brand)] text-white shadow-[var(--fo-shadow-sm)]`
      : `${base} border-[var(--fo-border-strong)] bg-[var(--fo-mineral)] text-[var(--fo-ink-body)] hover:border-[var(--fo-brand)] hover:bg-[var(--fo-control-hover)]`;
  }
  return active
    ? `${base} border-[var(--fo-brand)] bg-[var(--fo-brand)] text-white shadow-[var(--fo-shadow-sm)]`
    : `${base} border-[color-mix(in_srgb,var(--fo-accent)_45%,var(--fo-border))] bg-[var(--fo-select-tint)] text-[var(--fo-interaction)] hover:border-[var(--fo-brand)]`;
}

function PillCount({
  count,
  active,
  tone = "default",
}: {
  count: number;
  active?: boolean;
  tone?: "default" | "red" | "teal" | "brand";
}) {
  return (
    <span
      className={`tabular-nums text-[13px] ${
        active
          ? "text-white/90"
          : tone === "red"
            ? "text-[var(--fo-warn-text)]"
            : tone === "teal"
              ? "text-[var(--fo-success-text)]"
              : tone === "brand"
                ? "text-[var(--fo-interaction)]"
                : "text-[var(--fo-ink-muted)]"
      }`}
    >
      ({count.toLocaleString()})
    </span>
  );
}

function PillDivider() {
  return <span className="mx-1 hidden h-6 w-px shrink-0 bg-[var(--fo-border)] sm:inline-block" aria-hidden />;
}

function DropdownMenu({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="absolute left-0 top-[calc(100%+4px)] z-[100] min-w-[11.5rem] overflow-hidden rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] py-1"
      role="menu"
    >
      {children}
    </div>
  );
}

function DropdownItem({
  label,
  count,
  countClassName,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  countClassName?: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] font-medium transition-colors hover:bg-[var(--fo-row-hover)] ${
        selected ? "bg-[var(--fo-select-tint)] text-[var(--fo-title)]" : "text-[var(--fo-ink-body)]"
      }`}
    >
      <span>{label}</span>
      <span className={`tabular-nums text-[12px] font-semibold ${countClassName ?? "text-[var(--fo-ink-muted)]"}`}>
        {count.toLocaleString()}
      </span>
    </button>
  );
}

function toggleQuickFilterTab(
  tabs: FundingListQuickFilterTab[],
  tab: FundingListQuickFilterTab
): FundingListQuickFilterTab[] {
  if (tabs.includes(tab)) return tabs.filter((t) => t !== tab);
  return [...tabs, tab];
}

function addQuickFilterTab(
  tabs: FundingListQuickFilterTab[],
  tab: FundingListQuickFilterTab
): FundingListQuickFilterTab[] {
  if (tabs.includes(tab)) return tabs;
  return [...tabs, tab];
}

export function FundingQuickFiltersBar({
  counts,
  variant = "standalone",
}: {
  counts: FundingQuickFiltersCounts;
  variant?: "standalone" | "embedded";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<"closing" | "scope" | "new" | null>(null);

  const state = searchParamsToFundingListState(urlSearchParamsToRecord(searchParams));
  const activeTabs = state.tabs;
  const scope = state.scope;
  const closingDays = state.closingDays ?? 30;
  const postedDays = state.postedDays ?? 7;

  const navigate = useCallback(
    (patch: Partial<FundingListClientState>, options?: { resetSidebar?: boolean }) => {
      router.push(
        fundingListHref({
          ...state,
          ...(options?.resetSidebar && !state.savedSearchId ? defaultSidebarFilterPatch() : {}),
          ...patch,
          page: DEFAULT_FUNDING_LIST_PAGE,
        })
      );
      setOpenMenu(null);
    },
    [router, state]
  );

  const toggleQuickFilter = useCallback(
    (tab: FundingListQuickFilterTab) => {
      const turningOff = activeTabs.includes(tab);
      navigate(
        { tabs: toggleQuickFilterTab(activeTabs, tab) },
        { resetSidebar: !turningOff }
      );
    },
    [activeTabs, navigate]
  );

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const closingLabel =
    closingDays === 30 ? "30 days" : closingDays === 60 ? "60 days" : "90 days";
  const closingCount =
    closingDays === 30 ? counts.closing.d30 : closingDays === 60 ? counts.closing.d60 : counts.closing.d90;

  const scopeLabel =
    scope === "open" ? "Open only" : scope === "forecasted" ? "Forecasted only" : "Open & forecasted";
  const scopeCount =
    scope === "open" ? counts.scope.open : scope === "forecasted" ? counts.scope.forecasted : counts.scope.all;

  const newLabel =
    postedDays === 7 ? "This week" : postedDays === 30 ? "This month" : "This quarter";
  const newCount =
    postedDays === 7 ? counts.new.week : postedDays === 30 ? counts.new.month : counts.new.quarter;

  const matchedActive = isQuickFilterActive(activeTabs, "recommended");
  const closingActive = isQuickFilterActive(activeTabs, "closing_soon") || openMenu === "closing";
  const scopeMenuOpen = openMenu === "scope";
  const scopeActive = scope !== "all" || scopeMenuOpen;
  const scopeMenuActive = scopeMenuOpen || scope !== "closed";
  const newActive = isQuickFilterActive(activeTabs, "new_this_week") || openMenu === "new";
  const esiActive = isQuickFilterActive(activeTabs, "esi_career");
  const collaborativeActive = isQuickFilterActive(activeTabs, "large_awards");
  const investigatorActive = isQuickFilterActive(activeTabs, "investigator_initiated");
  const foundationsActive = isQuickFilterActive(activeTabs, "foundations");

  const shellClass =
    variant === "embedded"
      ? "min-w-0"
      : "border-y border-[var(--fo-divider)] bg-[var(--fo-paper-2)] px-5 py-3 sm:px-6";

  return (
    <div ref={rootRef} className={shellClass}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-0.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--fo-interaction)]">
          <FunnelIcon />
          Quick Filters
        </span>

        <button
          type="button"
          onClick={() => toggleQuickFilter("recommended")}
          className={pillClasses("violet", matchedActive)}
        >
          <SparkleIcon />
          <span>Matched to me</span>
          <PillCount count={counts.matched} active={matchedActive} tone="brand" />
        </button>

        <PillDivider />

        <div className="relative">
          <button
            type="button"
            aria-expanded={openMenu === "closing"}
            onClick={() => setOpenMenu((m) => (m === "closing" ? null : "closing"))}
            className={pillClasses("red", closingActive)}
          >
            <ClockIcon />
            <span>{isQuickFilterActive(activeTabs, "closing_soon") ? `Closing in ${closingLabel}` : "Closing soon"}</span>
            <PillCount
              count={isQuickFilterActive(activeTabs, "closing_soon") ? closingCount : counts.closing.d30}
              active={closingActive}
              tone="red"
            />
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
          <DropdownMenu open={openMenu === "closing"}>
            <DropdownItem
              label="30 days"
              count={counts.closing.d30}
              countClassName="text-red-700"
              selected={isQuickFilterActive(activeTabs, "closing_soon") && closingDays === 30}
              onSelect={() => {
                if (isQuickFilterActive(activeTabs, "closing_soon") && closingDays === 30) {
                  navigate({ tabs: toggleQuickFilterTab(activeTabs, "closing_soon") });
                  return;
                }
                navigate(
                  {
                    tabs: addQuickFilterTab(activeTabs, "closing_soon"),
                    closingDays: 30,
                  },
                  { resetSidebar: true }
                );
              }}
            />
            <DropdownItem
              label="60 days"
              count={counts.closing.d60}
              countClassName="text-amber-700"
              selected={isQuickFilterActive(activeTabs, "closing_soon") && closingDays === 60}
              onSelect={() => {
                if (isQuickFilterActive(activeTabs, "closing_soon") && closingDays === 60) {
                  navigate({ tabs: toggleQuickFilterTab(activeTabs, "closing_soon") });
                  return;
                }
                navigate(
                  {
                    tabs: addQuickFilterTab(activeTabs, "closing_soon"),
                    closingDays: 60,
                  },
                  { resetSidebar: true }
                );
              }}
            />
            <DropdownItem
              label="90 days"
              count={counts.closing.d90}
              countClassName="text-sky-700"
              selected={isQuickFilterActive(activeTabs, "closing_soon") && closingDays === 90}
              onSelect={() => {
                if (isQuickFilterActive(activeTabs, "closing_soon") && closingDays === 90) {
                  navigate({ tabs: toggleQuickFilterTab(activeTabs, "closing_soon") });
                  return;
                }
                navigate(
                  {
                    tabs: addQuickFilterTab(activeTabs, "closing_soon"),
                    closingDays: 90,
                  },
                  { resetSidebar: true }
                );
              }}
            />
          </DropdownMenu>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-expanded={openMenu === "scope"}
            onClick={() => {
              if (scope !== "all" && !scopeMenuOpen) {
                navigate({ scope: "all" }, { resetSidebar: true });
                return;
              }
              setOpenMenu((m) => (m === "scope" ? null : "scope"));
            }}
            className={pillClasses("neutral", scopeActive || scopeMenuOpen)}
          >
            <TargetIcon />
            <span>{scopeLabel}</span>
            <PillCount count={scopeCount} active={scopeActive || scopeMenuOpen} />
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
          <DropdownMenu open={scopeMenuOpen}>
            <DropdownItem
              label="Open & forecasted"
              count={counts.scope.all}
              selected={scopeMenuActive && scope === "all"}
              onSelect={() => navigate({ scope: "all" }, { resetSidebar: true })}
            />
            <DropdownItem
              label="Open only"
              count={counts.scope.open}
              selected={scopeMenuActive && scope === "open"}
              onSelect={() => navigate({ scope: "open" }, { resetSidebar: true })}
            />
            <DropdownItem
              label="Forecasted only"
              count={counts.scope.forecasted}
              selected={scopeMenuActive && scope === "forecasted"}
              onSelect={() => navigate({ scope: "forecasted" }, { resetSidebar: true })}
            />
          </DropdownMenu>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-expanded={openMenu === "new"}
            onClick={() => setOpenMenu((m) => (m === "new" ? null : "new"))}
            className={pillClasses("neutral", newActive)}
          >
            <BellIcon />
            <span>{isQuickFilterActive(activeTabs, "new_this_week") ? newLabel : "New this week"}</span>
            <PillCount
              count={isQuickFilterActive(activeTabs, "new_this_week") ? newCount : counts.new.week}
              active={newActive}
            />
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
          <DropdownMenu open={openMenu === "new"}>
            <DropdownItem
              label="This week"
              count={counts.new.week}
              selected={isQuickFilterActive(activeTabs, "new_this_week") && postedDays === 7}
              onSelect={() => {
                if (isQuickFilterActive(activeTabs, "new_this_week") && postedDays === 7) {
                  navigate({ tabs: toggleQuickFilterTab(activeTabs, "new_this_week") });
                  return;
                }
                navigate(
                  {
                    tabs: addQuickFilterTab(activeTabs, "new_this_week"),
                    postedDays: 7,
                  },
                  { resetSidebar: true }
                );
              }}
            />
            <DropdownItem
              label="This month"
              count={counts.new.month}
              selected={isQuickFilterActive(activeTabs, "new_this_week") && postedDays === 30}
              onSelect={() => {
                if (isQuickFilterActive(activeTabs, "new_this_week") && postedDays === 30) {
                  navigate({ tabs: toggleQuickFilterTab(activeTabs, "new_this_week") });
                  return;
                }
                navigate(
                  {
                    tabs: addQuickFilterTab(activeTabs, "new_this_week"),
                    postedDays: 30,
                  },
                  { resetSidebar: true }
                );
              }}
            />
            <DropdownItem
              label="This quarter"
              count={counts.new.quarter}
              selected={isQuickFilterActive(activeTabs, "new_this_week") && postedDays === 90}
              onSelect={() => {
                if (isQuickFilterActive(activeTabs, "new_this_week") && postedDays === 90) {
                  navigate({ tabs: toggleQuickFilterTab(activeTabs, "new_this_week") });
                  return;
                }
                navigate(
                  {
                    tabs: addQuickFilterTab(activeTabs, "new_this_week"),
                    postedDays: 90,
                  },
                  { resetSidebar: true }
                );
              }}
            />
          </DropdownMenu>
        </div>

        <PillDivider />

        <button type="button" onClick={() => toggleQuickFilter("esi_career")} className={pillClasses("neutral", esiActive)}>
          <span>Early career / ESI</span>
          <PillCount count={counts.esi} active={esiActive} />
        </button>

        <button
          type="button"
          onClick={() => toggleQuickFilter("large_awards")}
          className={pillClasses("neutral", collaborativeActive)}
        >
          <span>Collaborative</span>
          <PillCount count={counts.collaborative} active={collaborativeActive} />
        </button>

        <button
          type="button"
          onClick={() => toggleQuickFilter("investigator_initiated")}
          className={pillClasses("neutral", investigatorActive)}
        >
          <span>Investigator-initiated</span>
          <PillCount count={counts.investigatorInitiated} active={investigatorActive} />
        </button>

        <button
          type="button"
          onClick={() => toggleQuickFilter("foundations")}
          className={pillClasses("neutral", foundationsActive)}
        >
          <span>Foundations</span>
          <PillCount count={counts.foundations} active={foundationsActive} />
        </button>
      </div>
    </div>
  );
}
