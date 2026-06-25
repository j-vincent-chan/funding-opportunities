import type { SearchParams } from "@/lib/funding-opportunities/rd-list-filters";
import { fundingListRowScope } from "@/lib/funding-opportunities/funding-list-row-scope";
import {
  isNewWithinDays,
  newWithinDaysSortKey,
  resolveRowLastUpdatedAt,
} from "@/lib/funding-opportunities/funding-opportunity-dates";
import {
  isEsiCareerDevelopment,
  isFoundationOpportunity,
  isInvestigatorInitiated,
  isRecommendedMatch,
  looksLargeCollaborativeGrant,
  recommendationScore,
  type FundingQuickFilterRow,
} from "@/lib/funding-opportunities/funding-quick-filter-heuristics";
import type { ClosingSoonDays, FundingListViewTab, PostedWithinDays } from "@/lib/funding-opportunities/funding-list-url";

/** Quick-filter tabs that can be stacked (excludes view modes `all` and hidden tabs). */
export type FundingListQuickFilterTab = Exclude<FundingListViewTab, "all" | "immunology_translational">;

const QUICK_FILTER_TAB_SET = new Set<FundingListQuickFilterTab>([
  "recommended",
  "closing_soon",
  "new_this_week",
  "large_awards",
  "esi_career",
  "investigator_initiated",
  "foundations",
]);

export function isFundingListQuickFilterTab(value: string): value is FundingListQuickFilterTab {
  return QUICK_FILTER_TAB_SET.has(value as FundingListQuickFilterTab);
}

/** Parse repeatable `tab=` URL params into a de-duplicated quick-filter stack. */
export function quickFiltersFromSearchParams(searchParams: SearchParams): FundingListQuickFilterTab[] {
  const raw = searchParams.tab;
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const out: FundingListQuickFilterTab[] = [];
  for (const item of list) {
    if (typeof item !== "string" || !item.trim()) continue;
    const id = item.trim();
    if (id === "all") continue;
    if (!isFundingListQuickFilterTab(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function isQuickFilterActive(
  tabs: FundingListQuickFilterTab[],
  tab: FundingListQuickFilterTab
): boolean {
  return tabs.includes(tab);
}

type ApplyQuickFiltersContext = {
  today: Date;
  inDays: (iso: string | null, days: number) => boolean;
  postedWithinDays: (iso: string | null, days: number) => boolean;
  closingDays: ClosingSoonDays;
  postedDays: PostedWithinDays;
};

/**
 * Apply stacked quick filters with AND semantics (a row must satisfy every active filter).
 * When only "recommended" is active, results are sorted by recommendation score.
 */
export function applyFundingQuickFilters<T extends FundingQuickFilterRow>(
  rows: T[],
  tabs: FundingListQuickFilterTab[],
  ctx: ApplyQuickFiltersContext
): T[] {
  if (tabs.length === 0) return rows;

  let result = rows;
  for (const tab of tabs) {
    switch (tab) {
      case "recommended":
        result = result.filter((row) => isRecommendedMatch(row, ctx.inDays));
        break;
      case "closing_soon":
        result = result.filter((row) => ctx.inDays(row.close_date, ctx.closingDays));
        break;
      case "new_this_week":
        result = result.filter((row) =>
          isNewWithinDays(
            {
              statusBucket: fundingListRowScope(row, ctx.today),
              postedDate: row.posted_date,
              updatedAt: resolveRowLastUpdatedAt(row),
            },
            ctx.postedDays,
            ctx.postedWithinDays
          )
        );
        break;
      case "large_awards":
        result = result.filter((row) => looksLargeCollaborativeGrant(row));
        break;
      case "esi_career":
        result = result.filter((row) => isEsiCareerDevelopment(row));
        break;
      case "investigator_initiated":
        result = result.filter((row) => isInvestigatorInitiated(row));
        break;
      case "foundations":
        result = result.filter((row) => isFoundationOpportunity(row));
        break;
      default:
        break;
    }
  }

  if (tabs.length === 1 && tabs[0] === "recommended") {
    return [...result].sort(
      (a, b) => recommendationScore(b, ctx.inDays) - recommendationScore(a, ctx.inDays)
    );
  }

  if (tabs.length === 1 && tabs[0] === "new_this_week") {
    return [...result].sort((a, b) => {
      const ad = newWithinDaysSortKey({
        statusBucket: fundingListRowScope(a, ctx.today),
        postedDate: a.posted_date,
        updatedAt: resolveRowLastUpdatedAt(a),
      });
      const bd = newWithinDaysSortKey({
        statusBucket: fundingListRowScope(b, ctx.today),
        postedDate: b.posted_date,
        updatedAt: resolveRowLastUpdatedAt(b),
      });
      return bd - ad;
    });
  }

  return result;
}
