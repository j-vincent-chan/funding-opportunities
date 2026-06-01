import { describe, expect, it } from "vitest";
import {
  buildMonthlySeries,
  communityItemsMonthSpan,
  dedupeCommunitySourceItems,
  effectiveMonthKey,
  filterCommunityItemsByInvestigators,
  formatMonthSpanLabel,
  sumMonthlyKpis,
} from "@/lib/community/signal-dashboard-analytics";
import { nihFundingDashboardBucket } from "@/lib/community/signal-nih-funding";

describe("signal-dashboard-analytics", () => {
  it("buckets items by publication month and category", () => {
    const items = [
      {
        id: "1",
        title: "Paper A",
        category: "paper",
        source_type: "pubmed",
        status: "approved",
        published_at: "2026-03-15T00:00:00Z",
        found_at: null,
        raw_summary: "Nature · authors",
        nih_project_num: null,
        source_domain: null,
      },
      {
        id: "2",
        title: "Grant B",
        category: "funding",
        source_type: "reporter",
        status: "approved",
        published_at: "2026-03-20T00:00:00Z",
        found_at: null,
        raw_summary: "NCI · R01",
        nih_project_num: "1R01CA123456-01A1",
        source_domain: "reporter.nih.gov",
      },
    ];

    const monthly = buildMonthlySeries(items);
    expect(monthly).toHaveLength(1);
    expect(monthly[0]?.month).toBe("2026-03");
    expect(monthly[0]?.paper).toBe(1);
    expect(monthly[0]?.newFunding).toBe(1);

    const totals = sumMonthlyKpis(monthly);
    expect(totals.total).toBe(2);
    expect(totals.approved).toBe(2);
  });

  it("reports earliest and latest months in the dataset", () => {
    const span = communityItemsMonthSpan([
      {
        id: "1",
        title: "Old",
        category: "paper",
        source_type: "pubmed",
        status: "approved",
        published_at: "2018-06-01T00:00:00Z",
        found_at: null,
        raw_summary: null,
        nih_project_num: null,
        source_domain: null,
      },
      {
        id: "2",
        title: "New",
        category: "paper",
        source_type: "pubmed",
        status: "approved",
        published_at: "2026-01-01T00:00:00Z",
        found_at: null,
        raw_summary: null,
        nih_project_num: null,
        source_domain: null,
      },
    ]);
    expect(span).toEqual({ earliest: "2018-06", latest: "2026-01" });
    expect(formatMonthSpanLabel(span!)).toMatch(/Jun.*18/);
  });

  it("falls back to found_at for month key", () => {
    expect(
      effectiveMonthKey({
        id: "x",
        title: null,
        category: null,
        source_type: null,
        status: null,
        published_at: null,
        found_at: "2025-11-02T00:00:00Z",
        raw_summary: null,
        nih_project_num: null,
        source_domain: null,
      })
    ).toBe("2025-11");
  });
});

describe("filterCommunityItemsByInvestigators", () => {
  const roster = [
    { id: "inv-a", name: "Alice", entityIds: ["inv-a", "signal-a"] },
    { id: "inv-b", name: "Bob", entityIds: ["inv-b"] },
  ];

  const items = [
    {
      id: "1",
      title: "Alice paper",
      category: "paper",
      source_type: "pubmed",
      status: "approved",
      published_at: "2024-01-01T00:00:00Z",
      found_at: null,
      raw_summary: null,
      nih_project_num: null,
      source_domain: null,
      tracked_entity_ids: ["signal-a"],
    },
    {
      id: "2",
      title: "Bob paper",
      category: "paper",
      source_type: "pubmed",
      status: "approved",
      published_at: "2024-02-01T00:00:00Z",
      found_at: null,
      raw_summary: null,
      nih_project_num: null,
      source_domain: null,
      tracked_entity_ids: ["inv-b"],
    },
  ];

  it("returns all items when no investigators are selected", () => {
    expect(filterCommunityItemsByInvestigators(items, roster, [])).toHaveLength(2);
    expect(filterCommunityItemsByInvestigators(items, roster, null)).toHaveLength(2);
  });

  it("keeps items linked via Signal or Prospera entity ids", () => {
    const filtered = filterCommunityItemsByInvestigators(items, roster, ["inv-a"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("Alice paper");
  });
});

describe("dedupeCommunitySourceItems", () => {
  it("collapses rows with the same source URL", () => {
    const base = {
      category: "paper",
      source_type: "pubmed",
      status: "approved",
      published_at: "2026-04-01T00:00:00Z",
      found_at: null,
      raw_summary: null,
      nih_project_num: null,
      source_domain: null,
      signal_tracked_entity_id: "entity-1",
      tracked_entity_ids: ["entity-1"],
    };
    const { items } = dedupeCommunitySourceItems([
      {
        id: "a",
        title: "Title A",
        source_url: "https://pubmed.ncbi.nlm.nih.gov/123/",
        ...base,
      },
      {
        id: "b",
        title: "Title B",
        source_url: "https://pubmed.ncbi.nlm.nih.gov/123/",
        ...base,
      },
    ]);
    expect(items).toHaveLength(1);
  });

  it("collapses rows with the same title and month", () => {
    const base = {
      category: "paper",
      source_type: "pubmed",
      status: "approved",
      published_at: "2026-04-01T00:00:00Z",
      found_at: null,
      raw_summary: null,
      nih_project_num: null,
      source_domain: null,
      signal_tracked_entity_id: "entity-1",
      tracked_entity_ids: ["entity-1"],
    };
    const { items, removedDuplicateIds } = dedupeCommunitySourceItems([
      { id: "a", title: "Same Paper", ...base },
      { id: "b", title: "Same Paper", ...base },
    ]);
    expect(items).toHaveLength(1);
    expect(removedDuplicateIds).toBe(1);
  });
});

describe("signal-nih-funding", () => {
  it("classifies type-1 year-1 as new funding", () => {
    expect(
      nihFundingDashboardBucket({
        category: "funding",
        source_type: "reporter",
        nih_project_num: "1R01CA123456-01A1",
        title: null,
      })
    ).toBe("new_funding");
  });
});
