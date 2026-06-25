import { describe, expect, it } from "vitest";
import {
  resolveEstimatedOpenDate,
  resolveEstimatedOpenDateFromPayload,
  resolveListPostedDate,
  resolveLastUpdatedDateFromPayload,
  resolveListLastUpdatedDate,
  isNewWithinDays,
  newWithinDaysSortKey,
} from "./funding-opportunity-dates";

describe("funding-opportunity-dates", () => {
  it("reads forecasted post date from payload", () => {
    expect(
      resolveEstimatedOpenDateFromPayload({
        forecasted_post_date: "2026-08-15",
      })
    ).toBe("2026-08-15");
  });

  it("shows estimated open under forecasted status", () => {
    expect(
      resolveEstimatedOpenDate({
        statusBucket: "forecasted",
        postedDate: "2026-07-01",
        rawPayload: { forecasted_post_date: "2026-08-15" },
      })
    ).toBe("2026-08-15");
  });

  it("keeps posted date for open notices", () => {
    expect(
      resolveListPostedDate({
        statusBucket: "open",
        postedDate: "2026-04-01",
        rawPayload: { forecasted_post_date: "2026-08-15" },
      })
    ).toBe("2026-04-01");
  });

  it("does not use forecast fields as posted date for forecasted notices", () => {
    expect(
      resolveListPostedDate({
        statusBucket: "forecasted",
        postedDate: "2026-08-15",
        rawPayload: { forecasted_post_date: "2026-08-15", post_date: "2026-03-01" },
      })
    ).toBe("2026-03-01");
  });

  it("reads opportunity-level last updated from Simpler payload (CEGS)", () => {
    const cegsPayload = {
      updated_at: "2026-05-13T17:06:48.196234+00:00",
      summary: {
        updated_at: "2026-03-26T15:07:08.896590+00:00",
        post_date: "2025-09-23",
      },
    };
    expect(resolveLastUpdatedDateFromPayload(cegsPayload)).toBe("2026-05-13");
    expect(
      resolveListLastUpdatedDate({
        dbUpdatedAt: "2026-06-24T12:00:00.000Z",
        rawPayload: cegsPayload,
      })
    ).toBe("2026-05-13");
  });

  it("counts forecasted notices as new when recently updated", () => {
    const today = new Date(new Date().toDateString());
    const withinDays = (iso: string | null, days: number) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= new Date(today.getTime() - days * 24 * 60 * 60 * 1000) && d <= today;
    };
    const recentUpdated = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    expect(
      isNewWithinDays(
        {
          statusBucket: "forecasted",
          postedDate: "2020-01-01",
          updatedAt: recentUpdated,
        },
        7,
        withinDays
      )
    ).toBe(true);
    expect(
      isNewWithinDays(
        {
          statusBucket: "open",
          postedDate: "2020-01-01",
          updatedAt: recentUpdated,
        },
        7,
        withinDays
      )
    ).toBe(false);
  });

  it("sorts forecasted notices by the latest posted or updated date", () => {
    expect(
      newWithinDaysSortKey({
        statusBucket: "forecasted",
        postedDate: "2026-01-01",
        updatedAt: "2026-03-01T12:00:00.000Z",
      })
    ).toBe(new Date("2026-03-01T12:00:00.000Z").getTime());
  });
});
