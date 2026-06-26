import { describe, expect, it } from "vitest";
import {
  applyFundingListOrFilters,
  buildKeywordOrFilter,
  keywordSearchVariants,
  significantSearchTokens,
  type FundingListAgencySelection,
} from "./keyword-filter";

const PUBLIC_HEALTH_TITLE =
  "Strengthening Public Health Systems and Services through National Partnerships to Improve and Protect the Nation's Health";

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

describe("keywordSearchVariants", () => {
  it("includes possessive-stripped variants for short terms", () => {
    expect(keywordSearchVariants("Parkinson's")).toEqual(
      expect.arrayContaining(["Parkinson's", "Parkinson", "Parkinsons"])
    );
  });

  it("keeps plain keywords unchanged", () => {
    expect(keywordSearchVariants("Parkinson")).toEqual(["Parkinson"]);
  });

  it("normalizes curly apostrophes", () => {
    expect(keywordSearchVariants("Parkinson\u2019s")).toEqual(
      expect.arrayContaining(["Parkinson's", "Parkinson"])
    );
  });
});

describe("significantSearchTokens", () => {
  it("extracts long-phrase tokens for fallback matching", () => {
    const tokens = significantSearchTokens(PUBLIC_HEALTH_TITLE);
    expect(tokens).toContain("strengthening");
    expect(tokens).toContain("partnerships");
    expect(tokens).toContain("health");
    expect(tokens).not.toContain("the");
  });

  it("extracts tokens from informal CEGS-style queries", () => {
    expect(significantSearchTokens("Center of Excellence Genomics")).toEqual([
      "center",
      "excellence",
      "genomics",
    ]);
  });

  it("includes NIH mechanism codes shorter than four characters", () => {
    expect(significantSearchTokens("NCBIB P41")).toEqual(["ncbib", "p41"]);
    expect(significantSearchTokens("R01")).toEqual(["r01"]);
  });
});

describe("buildKeywordOrFilter", () => {
  it("never emits apostrophes inside PostgREST quoted ilike patterns", () => {
    const filter = buildKeywordOrFilter("Parkinson's");
    expect(filter).toBeTruthy();
    expect(filter).toContain("Parkinson_s");
    expect(filter).not.toMatch(/%Parkinson's%/);
  });

  it("uses underscore wildcards so Nation_s matches Nation's in titles", () => {
    const filter = buildKeywordOrFilter(PUBLIC_HEALTH_TITLE);
    expect(filter).toBeTruthy();
    expect(filter).toContain("Nation_s");
    expect(filter).not.toContain("Nation's");
  });

  it("matches Nation's titles when the query omits the apostrophe (Nations)", () => {
    const nationsQuery = PUBLIC_HEALTH_TITLE.replace("Nation's", "Nations");
    const filter = buildKeywordOrFilter(nationsQuery);
    expect(filter).toBeTruthy();
    expect(filter).toContain("Nation_s");
  });

  it("adds an all-tokens clause for long phrases missing middle words", () => {
    const withoutPossessive = PUBLIC_HEALTH_TITLE.replace("Nation's ", "");
    const filter = buildKeywordOrFilter(withoutPossessive);
    expect(filter).toContain("and(or(title.ilike.");
    expect(filter).toContain("strengthening");
    expect(filter).toContain("partnerships");
  });

  it("matches CEGS when the query omits pluralization and middle words", () => {
    const filter = buildKeywordOrFilter("Center of Excellence Genomics");
    expect(filter).toBeTruthy();
    expect(filter).toContain("and(or(title.ilike.");
    expect(filter).toContain("center");
    expect(filter).toContain("excellence");
    expect(filter).toContain("genomic");
  });

  it("matches NCBIB P41 when tokens are not contiguous in the title", () => {
    const filter = buildKeywordOrFilter("NCBIB P41");
    expect(filter).toBeTruthy();
    expect(filter).toContain("and(or(title.ilike.");
    expect(filter).toContain("ncbib");
    expect(filter).toContain("p41");
  });

  it("returns null for blank input", () => {
    expect(buildKeywordOrFilter("   ")).toBeNull();
  });
});

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

  it("returns no rows when every department was explicitly cleared", () => {
    const q = mockQuery();
    applyFundingListOrFilters(
      q,
      "parkinson",
      { departments: [], departmentSubs: {}, legacyAgencies: [], noDepartmentsSelected: true },
      []
    );
    expect(q.calls).toHaveLength(1);
    expect(q.calls[0]).toMatch(/^id\.eq\./);
  });

  it("returns the query untouched when nothing is selected", () => {
    const q = mockQuery();
    applyFundingListOrFilters(q, "", emptySelection, []);
    expect(q.calls).toHaveLength(0);
  });
});
