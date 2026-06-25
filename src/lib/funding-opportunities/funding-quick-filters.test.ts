import { describe, expect, it } from "vitest";
import {
  applyFundingQuickFilters,
  isFundingListQuickFilterTab,
  quickFiltersFromSearchParams,
} from "./funding-quick-filters";
import { fundingListHref, searchParamsToFundingListState } from "./funding-list-url";

describe("quickFiltersFromSearchParams", () => {
  it("parses a single tab param", () => {
    expect(quickFiltersFromSearchParams({ tab: "esi_career" })).toEqual(["esi_career"]);
  });

  it("parses stacked tab params", () => {
    expect(
      quickFiltersFromSearchParams({ tab: ["esi_career", "large_awards", "esi_career"] })
    ).toEqual(["esi_career", "large_awards"]);
  });

  it("ignores all and unknown tabs", () => {
    expect(quickFiltersFromSearchParams({ tab: ["all", "nope", "saved"] })).toEqual([]);
  });
});

describe("fundingListHref stacked tabs", () => {
  it("serializes multiple tab params", () => {
    const href = fundingListHref({
      q: "",
      scope: "all",
      tabs: ["esi_career", "investigator_initiated"],
      sort: "posted_date",
      order: "desc",
      page: 1,
      perPage: 50,
      departments: ["hhs"],
      departmentSubs: { hhs: ["nih"] },
      legacyAgencies: [],
      allDepartments: false,
      rd: {
        activityFamilies: [],
        clinicalTrialMode: null,
        nihIc: [],
        announcement: [],
        pathway: [],
        investigatorTags: [],
        mechanismTypes: [],
        collaborations: [],
        humanSubjects: [],
      },
    });
    expect(href).toContain("tab=esi_career");
    expect(href).toContain("tab=investigator_initiated");
  });

  it("round-trips stacked tabs through searchParamsToFundingListState", () => {
    const href =
      "/funding-opportunities?scope=all&sort=posted_date&order=desc&tab=esi_career&tab=closing_soon&closing_days=60&dept=hhs&sub=hhs:nih";
    const query = href.split("?")[1] ?? "";
    const params = new URLSearchParams(query);
    const record: Record<string, string | string[]> = {};
    for (const key of new Set(params.keys())) {
      const all = params.getAll(key);
      record[key] = all.length === 1 ? all[0]! : all;
    }
    const state = searchParamsToFundingListState(record);
    expect(state.tabs).toEqual(["esi_career", "closing_soon"]);
    expect(state.closingDays).toBe(60);
  });
});

describe("applyFundingQuickFilters", () => {
  const today = new Date(new Date().toDateString());
  const inDays = (iso: string | null, days: number) => {
    if (!iso) return false;
    const d = new Date(iso);
    const end = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    return d >= today && d <= end;
  };
  const postedWithinDays = () => true;

  it("AND-combines stacked filters", () => {
    const rows = [
      { title: "K99 Pathway award", funding_instrument: "K99", close_date: "2099-01-01", posted_date: null, agency: null, agency_code: null, status: "open", forecasted: false },
      { title: "R01 research project", funding_instrument: "R01", close_date: "2099-01-01", posted_date: null, agency: null, agency_code: null, status: "open", forecasted: false },
    ];
    const result = applyFundingQuickFilters(rows, ["esi_career", "investigator_initiated"], {
      today,
      inDays,
      postedWithinDays,
      closingDays: 30,
      postedDays: 7,
    });
    expect(result).toHaveLength(0);
    expect(applyFundingQuickFilters(rows, ["esi_career"], { today, inDays, postedWithinDays, closingDays: 30, postedDays: 7 })).toHaveLength(1);
  });
});

describe("isFundingListQuickFilterTab", () => {
  it("accepts stackable tabs only", () => {
    expect(isFundingListQuickFilterTab("esi_career")).toBe(true);
    expect(isFundingListQuickFilterTab("all")).toBe(false);
    expect(isFundingListQuickFilterTab("immunology_translational")).toBe(false);
  });
});
