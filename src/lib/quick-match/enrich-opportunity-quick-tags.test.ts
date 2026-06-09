import { describe, expect, it } from "vitest";
import { enrichOpportunityQuickTags } from "@/lib/quick-match/enrich-opportunity-quick-tags";
import { buildOpportunityQuickTags } from "@/lib/quick-match/tag-opportunity";

describe("enrichOpportunityQuickTags", () => {
  it("adds pathway and IC tags when text extraction is sparse", () => {
    const enriched = enrichOpportunityQuickTags(
      { research_focal_areas: [], disease_areas: [], technical_expertise: [] },
      {
        nih_ic_tokens: ["NIDDK", "NHLBI"],
        rd_research_pathway: "clinical",
        clinical_trial_mode: "not_allowed",
        activity_families: ["U"],
      }
    );
    expect(enriched.research_focal_areas.length).toBeGreaterThan(0);
    expect(enriched.disease_areas).toEqual(
      expect.arrayContaining(["diabetes", "cardiovascular_disease"])
    );
    expect(enriched.technical_expertise).toEqual(
      expect.arrayContaining(["consortium_coordination"])
    );
  });
});

describe("buildOpportunityQuickTags", () => {
  it("fills all three buckets for a cardiovascular diabetes consortium notice", () => {
    const tags = buildOpportunityQuickTags(
      {
        title:
          "Continuation of the Cardiovascular Repository for Type 1 Diabetes (CARE-TID) Consortium U01 (Open Competition) - Research (U01, Clinical Trial Not Allowed)",
        description:
          "This cooperative agreement supports a multi-site registry and repository for type 1 diabetes cardiovascular outcomes research.",
        agency: "National Institutes of Health",
        opportunity_number: "RFA-HL-24-001",
      },
      {
        nih_ic_tokens: ["NHLBI", "NIDDK"],
        rd_research_pathway: "population",
        clinical_trial_mode: "not_allowed",
        activity_families: ["U"],
        category: "health",
      }
    );
    expect(tags.research_focal_areas.length).toBeGreaterThan(0);
    expect(tags.disease_areas.length).toBeGreaterThan(0);
    expect(tags.technical_expertise.length).toBeGreaterThan(0);
    expect(tags.disease_areas).toEqual(expect.arrayContaining(["type_1_diabetes", "cardiovascular_disease"]));
  });
});
