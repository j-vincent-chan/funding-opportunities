import { describe, expect, it } from "vitest";
import { resolvePubmedMaxResults } from "@/lib/community/pubmed-ingest";

describe("resolvePubmedMaxResults", () => {
  it("defaults to uncapped fetches", () => {
    expect(resolvePubmedMaxResults()).toBeNull();
  });

  it("ignores explicit opts max and remains uncapped", () => {
    expect(resolvePubmedMaxResults(999)).toBeNull();
    expect(resolvePubmedMaxResults(50)).toBeNull();
  });
});
