import { describe, expect, it } from "vitest";
import { normalizeDepartmentSubId } from "./department-subcomponents";
import { buildDepartmentAgencyOrFilter } from "./agency-filter";

const ALL_DOD_SUBS = [
  "darpa",
  "dha",
  "dhaca",
  "onr",
  "afosr",
  "aro",
  "mda",
  "dtra",
  "dla",
  "disa",
] as const;

describe("buildDepartmentAgencyOrFilter DoD", () => {
  it("matches DHACA and CDMRP awarding-office agency text", () => {
    const filter = buildDepartmentAgencyOrFilter(["dod"], {
      dod: [...ALL_DOD_SUBS],
    });
    expect(filter).toBeTruthy();
    expect(filter).toContain("DHACA");
    expect(filter).toContain("CDMRP");
  });

  it("matches major service research offices", () => {
    const filter = buildDepartmentAgencyOrFilter(["dod"], { dod: ["onr", "afosr", "aro"] });
    expect(filter).toContain("Office of Naval Research");
    expect(filter).toContain("AFOSR");
    expect(filter).toContain("Army Research Office");
  });
});

describe("normalizeDepartmentSubId DoD legacy URLs", () => {
  it("maps retired sub-ids to the current taxonomy", () => {
    expect(normalizeDepartmentSubId("dod", "army")).toBe("aro");
    expect(normalizeDepartmentSubId("dod", "navy")).toBe("onr");
    expect(normalizeDepartmentSubId("dod", "cdmrp")).toBe("dhaca");
  });
});
