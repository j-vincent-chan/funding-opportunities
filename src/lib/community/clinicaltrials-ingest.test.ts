import { describe, expect, it } from "vitest";
import {
  buildClinicalTrialsQuery,
  parseClinicalTrialStudy,
} from "@/lib/community/clinicaltrials-ingest";

describe("buildClinicalTrialsQuery", () => {
  it("uses override when set", () => {
    expect(
      buildClinicalTrialsQuery({
        fullName: "Jane Doe",
        clinicaltrialsQueryOverride: "AREA[Condition]asthma",
        affiliation: "UCSF",
      })
    ).toBe("AREA[Condition]asthma");
  });

  it("builds lead investigator + facility areas from name", () => {
    expect(
      buildClinicalTrialsQuery({
        fullName: "Wilson Liao",
        clinicaltrialsQueryOverride: null,
        affiliation: "UCSF",
      })
    ).toBe('AREA[LeadInvestigator]"Wilson Liao" AND AREA[LocationFacility]UCSF');
  });

  it("returns empty when no name and no override", () => {
    expect(
      buildClinicalTrialsQuery({
        fullName: "",
        clinicaltrialsQueryOverride: null,
      })
    ).toBe("");
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
