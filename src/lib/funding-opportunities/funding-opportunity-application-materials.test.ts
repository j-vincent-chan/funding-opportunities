import { describe, expect, it } from "vitest";
import {
  formatApplicationDocumentSize,
  isNihFundingOpportunity,
} from "@/lib/funding-opportunities/funding-opportunity-application-materials";

describe("isNihFundingOpportunity", () => {
  it("detects NIH from agency name", () => {
    expect(isNihFundingOpportunity({ agency: "National Institutes of Health" })).toBe(true);
  });

  it("detects NIH from opportunity number prefix", () => {
    expect(isNihFundingOpportunity({ opportunityNumber: "PAR-26-116" })).toBe(true);
  });

  it("returns false for EPA opportunities", () => {
    expect(
      isNihFundingOpportunity({
        agency: "Environmental Protection Agency",
        opportunityNumber: "EPA-R9-SFUND-23-003",
      })
    ).toBe(false);
  });
});

describe("formatApplicationDocumentSize", () => {
  it("formats kilobytes and megabytes", () => {
    expect(formatApplicationDocumentSize(890)).toBe("890 B");
    expect(formatApplicationDocumentSize(147_084)).toBe("144 KB");
    expect(formatApplicationDocumentSize(2_400_000)).toBe("2.3 MB");
  });
});
