import { describe, expect, it } from "vitest";
import {
  fiscalYearToPublishedAt,
  prosperaCommunityItemId,
  prosperaPubmedCacheKey,
} from "@/lib/community/prospera-community-item-id";

describe("prospera-community-item-id", () => {
  it("generates stable UUIDs for the same key", () => {
    const a = prosperaCommunityItemId("pubmed", "pubmed:inv:123");
    const b = prosperaCommunityItemId("pubmed", "pubmed:inv:123");
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("builds pubmed cache keys", () => {
    expect(prosperaPubmedCacheKey("abc", "999")).toBe("pubmed:abc:999");
  });

  it("maps fiscal year to October publish date", () => {
    expect(fiscalYearToPublishedAt(2024)).toBe("2024-10-01T00:00:00.000Z");
  });
});
