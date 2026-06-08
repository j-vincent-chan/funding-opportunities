import { describe, expect, it } from "vitest";
import {
  buildClinicalTrialsQuery,
  buildClinicalTrialsSearch,
  parseClinicalTrialStudy,
  studyMatchesInvestigatorName,
} from "@/lib/community/clinicaltrials-ingest";
import { buildClinicalTrialsStudiesUrl } from "@/lib/community/clinicaltrials-api-client";

describe("buildClinicalTrialsSearch", () => {
  it("uses override when set", () => {
    expect(
      buildClinicalTrialsSearch({
        fullName: "Jane Doe",
        clinicaltrialsQueryOverride: "AREA[Condition]asthma",
        affiliation: "UCSF",
      })
    ).toEqual({ queryTerm: "AREA[Condition]asthma" });
  });

  it("uses quoted name in query.term and facility in filter.advanced", () => {
    expect(
      buildClinicalTrialsSearch({
        fullName: "Wilson Liao",
        clinicaltrialsQueryOverride: null,
        affiliation: "UCSF",
      })
    ).toEqual({
      queryTerm: '"Wilson Liao"',
      filterAdvanced: "AREA[LocationFacility]UCSF",
    });
  });

  it("returns empty queryTerm when no name and no override", () => {
    expect(
      buildClinicalTrialsSearch({
        fullName: "",
        clinicaltrialsQueryOverride: null,
      })
    ).toEqual({ queryTerm: "" });
  });
});

describe("buildClinicalTrialsQuery", () => {
  it("joins term and filter for display", () => {
    expect(
      buildClinicalTrialsQuery({
        fullName: "Wilson Liao",
        clinicaltrialsQueryOverride: null,
        affiliation: "UCSF",
      })
    ).toBe('"Wilson Liao" AND AREA[LocationFacility]UCSF');
  });
});

describe("buildClinicalTrialsStudiesUrl", () => {
  it("sets query.term and filter.advanced separately", () => {
    const url = buildClinicalTrialsStudiesUrl({
      queryTerm: '"Wilson Liao"',
      filterAdvanced: "AREA[LocationFacility]UCSF",
      pageSize: 10,
      countTotal: true,
    });
    expect(url).toContain("query.term=%22Wilson+Liao%22");
    expect(url).toContain("filter.advanced=AREA%5BLocationFacility%5DUCSF");
    expect(url).toContain("countTotal=true");
  });
});

describe("parseClinicalTrialStudy", () => {
  it("extracts core fields from protocolSection", () => {
    const parsed = parseClinicalTrialStudy({
      protocolSection: {
        identificationModule: {
          nctId: "NCT12345678",
          briefTitle: "A Phase 2 Study",
        },
        statusModule: {
          overallStatus: "RECRUITING",
          startDateStruct: { date: "2020-03-01" },
          lastUpdatePostDateStruct: { date: "2024-06-15" },
        },
        conditionsModule: { conditions: ["Asthma", "COPD"] },
        sponsorCollaboratorsModule: { leadSponsor: { name: "University of California, San Francisco" } },
        descriptionModule: { briefSummary: "This study evaluates a new therapy." },
      },
    });
    expect(parsed?.nctId).toBe("NCT12345678");
    expect(parsed?.title).toBe("A Phase 2 Study");
    expect(parsed?.overallStatus).toBe("RECRUITING");
    expect(parsed?.conditions).toEqual(["Asthma", "COPD"]);
    expect(parsed?.leadSponsor).toContain("California");
    expect(parsed?.startDate).toBe("2020-03-01");
    expect(parsed?.lastUpdateDate).toBe("2024-06-15");
    expect(parsed?.briefSummary).toContain("new therapy");
  });

  it("returns null for invalid NCT id", () => {
    expect(
      parseClinicalTrialStudy({
        protocolSection: { identificationModule: { nctId: "BAD" } },
      })
    ).toBeNull();
  });
});

describe("studyMatchesInvestigatorName", () => {
  it("accepts studies without officials data", () => {
    expect(
      studyMatchesInvestigatorName(
        { protocolSection: { identificationModule: { nctId: "NCT12345678" } } },
        "Wilson Liao"
      )
    ).toBe(true);
  });

  it("requires name match when officials are listed", () => {
    expect(
      studyMatchesInvestigatorName(
        {
          protocolSection: {
            contactsLocationsModule: {
              overallOfficials: [{ name: "Wilson Liao, MD", affiliation: "UCSF" }],
            },
          },
        },
        "Wilson Liao"
      )
    ).toBe(true);
    expect(
      studyMatchesInvestigatorName(
        {
          protocolSection: {
            contactsLocationsModule: {
              overallOfficials: [{ name: "Other Person", affiliation: "UCSF" }],
            },
          },
        },
        "Wilson Liao"
      )
    ).toBe(false);
  });
});
