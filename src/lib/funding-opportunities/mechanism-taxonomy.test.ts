import { describe, expect, it } from "vitest";
import {
  classifyMechanismSimilarity,
  extractActivityCodesFromText,
  lookupMechanismTaxonomy,
  resetUnmatchedMechanismLogsForTests,
  resolveFundingOpportunityActivityCode,
} from "./mechanism-taxonomy";

describe("mechanism taxonomy", () => {
  it("resolves P41 from a parent notice title", () => {
    expect(
      resolveFundingOpportunityActivityCode({
        title: "National Centers for Biomedical Imaging and Bioengineering (NCBIB) (P41 Clinical Trials Optional)",
      })
    ).toBe("P41");
  });

  it("resolves DP2 from a New Innovator notice title", () => {
    expect(
      resolveFundingOpportunityActivityCode({
        title: "NIH Director's New Innovator Award Program (DP2 Clinical Trial Optional)",
        opportunity_number: "RFA-RM-26-002",
      })
    ).toBe("DP2");
  });

  it("maps DP Director award attributes", () => {
    expect(lookupMechanismTaxonomy("DP2")).toMatchObject({
      family: "research_project",
      scale: "individual",
      purposes: ["research"],
      governance: "grant",
      similarity_group: "exploratory_research",
    });
  });

  it("maps curated example attributes", () => {
    expect(lookupMechanismTaxonomy("P41")).toMatchObject({
      family: "resource",
      scale: "national_resource",
      purposes: ["technology_resource"],
      governance: "grant",
      similarity_group: "national_resource_center",
    });
    expect(lookupMechanismTaxonomy("U24")).toMatchObject({
      family: "resource",
      scale: "national_resource",
      purposes: ["data_resource", "technology_resource"],
      governance: "cooperative_agreement",
      similarity_group: "national_resource_center",
    });
    expect(lookupMechanismTaxonomy("P30")).toMatchObject({
      similarity_group: "institutional_core_center",
    });
    expect(lookupMechanismTaxonomy("U54")).toMatchObject({
      similarity_group: "specialized_research_center",
    });
    expect(lookupMechanismTaxonomy("P50")).toMatchObject({
      similarity_group: "specialized_research_center",
    });
  });
});

describe("classifyMechanismSimilarity", () => {
  it("returns exact for the same activity code", () => {
    expect(classifyMechanismSimilarity("P41", "P41")).toBe("exact");
  });

  it("returns very high for P41 and U24 (same group, scale, overlapping purpose)", () => {
    expect(classifyMechanismSimilarity("P41", "U24")).toBe("very_high");
    expect(classifyMechanismSimilarity("U24", "P41")).toBe("very_high");
  });

  it("does not match P30 with U54 (different similarity groups)", () => {
    expect(classifyMechanismSimilarity("P30", "U54")).toBeNull();
  });

  it("does not match R01 with P41", () => {
    expect(classifyMechanismSimilarity("R01", "P41")).toBeNull();
  });

  it("returns only exact matches when a code is missing from the taxonomy", () => {
    resetUnmatchedMechanismLogsForTests();
    expect(classifyMechanismSimilarity("X99", "X99")).toBe("exact");
    expect(classifyMechanismSimilarity("X99", "P41")).toBeNull();
    expect(classifyMechanismSimilarity("P41", "X99")).toBeNull();
  });

  it("can classify high similarity within specialized research centers", () => {
    const level = classifyMechanismSimilarity("U54", "P50");
    expect(level === "very_high" || level === "high").toBe(true);
  });

  it("returns very high for DP1 and DP2 (same exploratory group)", () => {
    expect(classifyMechanismSimilarity("DP2", "DP1")).toBe("very_high");
  });
});

describe("extractActivityCodesFromText", () => {
  it("extracts multiple codes from free text", () => {
    expect(extractActivityCodesFromText("PAR-24-123 (P41) and companion U24")).toEqual(["P41", "U24"]);
  });

  it("extracts DP codes from notice text", () => {
    expect(extractActivityCodesFromText("New Innovator Award Program (DP2 Clinical Trial Optional)")).toEqual([
      "DP2",
    ]);
  });
});
