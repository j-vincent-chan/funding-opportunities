import { describe, expect, it } from "vitest";
import { nihActivityCodeFromProjectNum } from "@/lib/community/nih-mechanism";

describe("nihActivityCodeFromProjectNum", () => {
  it("parses standard R-series project numbers", () => {
    expect(nihActivityCodeFromProjectNum("5R01GM123456")).toBe("R01");
    expect(nihActivityCodeFromProjectNum("1 R01 HL123456-01A1")).toBe("R01");
  });

  it("parses DP2-style NIH Director award project numbers", () => {
    expect(nihActivityCodeFromProjectNum("1DP2CA259649")).toBe("DP2");
    expect(nihActivityCodeFromProjectNum("1DP2CA259649-01")).toBe("DP2");
    expect(nihActivityCodeFromProjectNum("1DP1HD123456")).toBe("DP1");
  });
});
