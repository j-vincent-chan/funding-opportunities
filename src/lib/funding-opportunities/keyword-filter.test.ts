import { describe, expect, it } from "vitest";
import { applyFundingListOrFilters, type FundingListAgencySelection } from "./keyword-filter";

/** Minimal stand-in that records every `.or(...)` fragment applied to the query. */
function mockQuery() {
  const calls: string[] = [];
  const q = {
    calls,
    or(s: string) {
      calls.push(s);
      return q;
    },
  };
  return q;
}

const nihSelection: FundingListAgencySelection = {
  departments: ["hhs"],
  departmentSubs: { hhs: ["nih"] },
  legacyAgencies: [],
};

const emptySelection: FundingListAgencySelection = {
  departments: [],
  departmentSubs: {},
  legacyAgencies: [],
};

describe("applyFundingListOrFilters NIH IC handling", () => {
  it("AND-combines NIH institute tokens with the department filter", () => {
    const q = mockQuery();
    applyFundingListOrFilters(q, undefined, nihSelection, ["NCI", "NIAID", "NIDCD"]);
    expect(q.calls).toHaveLength(1);
    const filter = q.calls[0];
    // Structure: outer and(...) with the department or(...) group and the IC overlap as siblings.
    // (In the previous buggy version the IC clause sat *inside* the or(...) group, making it OR.)
    expect(filter).toMatch(/^and\(or\(.+\),nih_ic_tokens\.ov\.\{NCI,NIAID,NIDCD\}\)$/);
  });

  it("emits a bare overlap clause when only NIH institutes are selected", () => {
    const q = mockQuery();
    applyFundingListOrFilters(q, undefined, emptySelection, ["NCI"]);
    expect(q.calls).toEqual(["nih_ic_tokens.ov.{NCI}"]);
  });

  it("emits only the department filter when no institutes are selected", () => {
    const q = mockQuery();
    applyFundingListOrFilters(q, undefined, nihSelection, []);
    expect(q.calls).toHaveLength(1);
    expect(q.calls[0]).not.toContain("nih_ic_tokens");
    expect(q.calls[0]).not.toContain("and(");
  });

  it("AND-combines keyword, department, and institute groups together", () => {
    const q = mockQuery();
    applyFundingListOrFilters(q, "cancer", nihSelection, ["NCI"]);
    expect(q.calls).toHaveLength(1);
    const filter = q.calls[0];
    expect(filter.startsWith("and(")).toBe(true);
    expect(filter).toContain("title.ilike.");
    expect(filter).toContain("nih_ic_tokens.ov.{NCI}");
  });

  it("returns the query untouched when nothing is selected", () => {
    const q = mockQuery();
    applyFundingListOrFilters(q, "", emptySelection, []);
    expect(q.calls).toHaveLength(0);
  });
});
