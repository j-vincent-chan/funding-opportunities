import { describe, expect, it } from "vitest";
import { extractOpportunityFeatures } from "./extract-opportunity-features";

describe("extractOpportunityFeatures", () => {
  it("tags immunology language", () => {
    const f = extractOpportunityFeatures({
      title: "Cancer immunotherapy trial",
      description: "Patient-derived samples and single-cell profiling required.",
    });
    expect(
      f.science_tags.length + f.method_tags.length + f.translational_tags.length
    ).toBeGreaterThan(0);
  });
});
