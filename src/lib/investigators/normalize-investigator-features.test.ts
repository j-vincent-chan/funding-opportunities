import { describe, expect, it } from "vitest";
import { buildInvestigatorFeatureRow } from "./normalize-investigator-features";

describe("buildInvestigatorFeatureRow", () => {
  it("derives tags and readiness heuristics", () => {
    const row = buildInvestigatorFeatureRow({
      primary_research_area: "tumor immunology",
      primary_disease_focus: "melanoma",
      technological_expertise: "single-cell RNA-seq",
      clinical_samples: "human samples",
      small_grants: "R21 pilot award",
      large_grants: "R01 and U01",
    });
    expect(row.science_tags.length).toBeGreaterThan(0);
    expect(row.grant_readiness_small).not.toBe("unknown");
    expect(row.profile_summary_normalized.length).toBeGreaterThan(10);
  });
});
