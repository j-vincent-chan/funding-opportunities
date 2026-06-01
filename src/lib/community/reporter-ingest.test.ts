import { describe, expect, it } from "vitest";
import { isNihNewGrantByProjectNum } from "@/lib/community/signal-nih-funding";

describe("RePORTER new-grant filter", () => {
  it("accepts type-1 (new) project numbers", () => {
    expect(isNihNewGrantByProjectNum("1R01AI123456")).toBe(true);
    expect(isNihNewGrantByProjectNum("1 U01 DK099999 01")).toBe(true);
  });

  it("rejects continuing / non-type-1 project numbers", () => {
    expect(isNihNewGrantByProjectNum("5R01AI123456")).toBe(false);
    expect(isNihNewGrantByProjectNum("3U01DK099999")).toBe(false);
  });
});
