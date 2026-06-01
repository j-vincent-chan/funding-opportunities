import { describe, expect, it } from "vitest";
import { AsyncRateLimiter } from "@/lib/utils/async-rate-limiter";

describe("AsyncRateLimiter", () => {
  it("spaces concurrent schedules by minIntervalMs", async () => {
    const limiter = new AsyncRateLimiter(50);
    const started: number[] = [];

    await Promise.all(
      Array.from({ length: 4 }, () =>
        limiter.schedule(async () => {
          started.push(Date.now());
        })
      )
    );

    for (let i = 1; i < started.length; i++) {
      expect(started[i]! - started[i - 1]!).toBeGreaterThanOrEqual(45);
    }
  });
});
