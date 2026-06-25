import { describe, expect, it } from "vitest";
import { fundingListRowScope } from "./funding-list-row-scope";

describe("fundingListRowScope", () => {
  const today = new Date(new Date().toDateString());

  it("keeps forecasted notices forecasted when estimated close is today", () => {
    const closeToday = today.toISOString().slice(0, 10);
    expect(
      fundingListRowScope(
        {
          status: "forecasted",
          close_date: closeToday,
          forecasted: true,
        },
        today
      )
    ).toBe("forecasted");
  });

  it("keeps forecasted notices forecasted when estimated close is in the past", () => {
    const past = new Date(today);
    past.setDate(past.getDate() - 30);
    expect(
      fundingListRowScope(
        {
          status: "forecasted",
          close_date: past.toISOString().slice(0, 10),
          forecasted: true,
        },
        today
      )
    ).toBe("forecasted");
  });

  it("marks posted notices closed after close date", () => {
    const past = new Date(today);
    past.setDate(past.getDate() - 1);
    expect(
      fundingListRowScope(
        {
          status: "posted",
          close_date: past.toISOString().slice(0, 10),
          forecasted: false,
        },
        today
      )
    ).toBe("closed");
  });
});
