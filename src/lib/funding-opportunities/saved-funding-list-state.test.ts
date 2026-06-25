import { describe, expect, it } from "vitest";
import { fundingListHref } from "./funding-list-url";
import {
  savedSearchMatchesCurrentState,
  savedSearchStillActive,
} from "./saved-funding-list-state";
import { parseRdListFilters } from "./rd-list-filters";

const emptyRd = parseRdListFilters({});

function baseState() {
  return {
    q: "cancer",
    scope: "all" as const,
    tabs: [] as const,
    sort: "posted_date",
    order: "desc" as const,
    page: 1,
    perPage: 50 as const,
    departments: ["hhs"],
    departmentSubs: { hhs: ["nih"] },
    legacyAgencies: [] as string[],
    allDepartments: false,
    noDepartmentsSelected: false,
    rd: emptyRd,
  };
}

describe("savedSearchStillActive", () => {
  it("stays active when extra quick filters are stacked on a saved search", () => {
    const saved = baseState();
    const href = fundingListHref(saved);
    const current = { ...saved, tabs: ["esi_career"] as typeof saved.tabs };

    expect(savedSearchMatchesCurrentState(current, href)).toBe(false);
    expect(savedSearchStillActive(current, href)).toBe(true);
  });

  it("stays active via saved-search URL pin even when sidebar filters were reset", () => {
    const saved = {
      ...baseState(),
      rd: { ...emptyRd, activityFamilies: ["cancer"] },
    };
    const href = fundingListHref(saved);
    const cancerId = "11111111-1111-4111-8111-111111111111";
    const current = {
      ...baseState(),
      tabs: ["esi_career"] as const,
      savedSearchId: cancerId,
      rd: emptyRd,
    };

    expect(savedSearchStillActive(current, href)).toBe(false);
    expect(savedSearchStillActive(current, href, cancerId)).toBe(true);
  });

  it("is inactive when core filters diverge from the saved search", () => {
    const saved = baseState();
    const href = fundingListHref(saved);
    const current = { ...saved, q: "genomics" };

    expect(savedSearchStillActive(current, href)).toBe(false);
  });

  it("is inactive when a saved quick filter tab is removed", () => {
    const saved = { ...baseState(), tabs: ["esi_career"] as const };
    const href = fundingListHref(saved);
    const current = { ...saved, tabs: [] as typeof saved.tabs };

    expect(savedSearchStillActive(current, href)).toBe(false);
  });
});
