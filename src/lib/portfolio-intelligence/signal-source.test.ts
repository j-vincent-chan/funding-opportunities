import { describe, expect, it } from "vitest";
import type { PortfolioSignalItem } from "@/lib/portfolio-intelligence/mock-data";
import { grantTimelineSegmentFromItem } from "./signal-source";

function grantItem(overrides: Partial<PortfolioSignalItem> = {}): PortfolioSignalItem {
  return {
    id: "g1",
    title: "Grant",
    category: "funding",
    source_type: "reporter",
    monthKey: "2025-01",
    occurredAt: "2025-01-01T00:00:00.000Z",
    nih_project_num: null,
    investigatorIds: [],
    ...overrides,
  };
}

describe("grantTimelineSegmentFromItem", () => {
  it("classifies project numbers starting with 1 as new grants", () => {
    expect(
      grantTimelineSegmentFromItem(grantItem({ nih_project_num: "1R01AI123456" }))
    ).toBe("new_grants");
  });

  it("classifies other project numbers as continuing grants", () => {
    expect(
      grantTimelineSegmentFromItem(grantItem({ nih_project_num: "5R01AI123456" }))
    ).toBe("continuing_grants");
  });
});
