import { describe, expect, it } from "vitest";
import { normalizeAgencyDisplayName } from "./agency-display";

describe("normalizeAgencyDisplayName", () => {
  it("strips leading org codes with digits before office names", () => {
    expect(
      normalizeAgencyDisplayName("69A345 Office of the Under Secretary for Policy")
    ).toBe("Office of the Under Secretary for Policy");
  });

  it("does not strip NIH-style tokens without digits", () => {
    expect(normalizeAgencyDisplayName("National Institutes of Health")).toBe(
      "National Institutes of Health"
    );
  });
});
