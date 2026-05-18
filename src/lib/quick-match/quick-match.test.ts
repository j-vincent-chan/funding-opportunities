import { describe, expect, it } from "vitest";
import { extractOpportunityQuickTags } from "./tag-opportunity";
import { scorePiAgainstOpportunity } from "./score";
import { DEMO_INVESTIGATORS, runDemoRankStrongOpp } from "./demo-fixtures";

describe("AI-Assisted Matches", () => {
  it("extracts tags from opportunity text", () => {
    const t = extractOpportunityQuickTags({
      title: "AI and machine learning for biomedical imaging biomarkers",
      description: "Computational approaches including deep learning.",
      agency: "NIH",
    });
    expect(t.technical_expertise).toContain("machine_learning");
    expect(t.research_focal_areas.length + t.disease_areas.length + t.technical_expertise.length).toBeGreaterThan(
      0
    );
  });

  it("ranks strong PI above weak for immunotherapy lung scRNA notice", () => {
    const ranked = runDemoRankStrongOpp();
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    expect(ranked[0]!.pi.full_name).toBe("Strong Match PI");
    expect(ranked[0]!.totalScore).toBeGreaterThan(50);
  });

  it("returns zero score when there is no overlap", () => {
    const pi = DEMO_INVESTIGATORS[2]!;
    const opp = extractOpportunityQuickTags({
      title: "Oceanography sediment core analysis",
      description: "Marine geology only.",
    });
    const s = scorePiAgainstOpportunity(pi, opp);
    expect(s.breakdown.rawScore).toBe(0);
  });
});
