import { describe, expect, it } from "vitest";
import {
  inferCollaborationComplexity,
  inferMechanismType,
  inferHumanSubjectsRelevance,
} from "./mechanism-heuristics";

describe("mechanism heuristics", () => {
  it("detects training grants", () => {
    expect(inferMechanismType("T32 training grant", "")).toBe("training");
  });

  it("detects center-like language", () => {
    expect(inferCollaborationComplexity("P30 core resource", "multi-project")).toBe("center_like");
  });

  it("flags human subjects language", () => {
    expect(inferHumanSubjectsRelevance("", "IRB-approved clinical trial")).toBe("true");
  });
});
