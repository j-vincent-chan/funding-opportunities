import { describe, expect, it } from "vitest";
import type { Investigator, PortfolioSignalItem } from "@/lib/portfolio-intelligence/mock-data";
import { buildInvestigatorProfileInsights } from "./investigator-profile-insights";

function baseInvestigator(overrides: Partial<Investigator> = {}): Investigator {
  return {
    id: "inv-1",
    name: "Alexander Marson, MD",
    title: "Faculty",
    department: "Microbiology & Immunology",
    affiliation: "UCSF · Gladstone Institutes",
    keyThemes: ["T-cell engineering", "CRISPR", "Immune therapy", "Autoimmunity"],
    recentSignals: 24,
    collaborationIndex: 82,
    matchStrength: 40,
    matchBand: "medium",
    lastUpdated: "Jun 9, 2026",
    portfolioStats: {
      publications: 12,
      grants: 2,
      news: 1,
      honors: 0,
      trials: 0,
      social: "1.2K",
    },
    activitySeries: [
      { month: "Jan 2026", monthKey: "2026-01", publications: 1, grants: 0, news: 0, other: 0 },
      { month: "Feb 2026", monthKey: "2026-02", publications: 2, grants: 1, news: 0, other: 0 },
      { month: "Mar 2026", monthKey: "2026-03", publications: 3, grants: 0, news: 0, other: 0 },
      { month: "Apr 2026", monthKey: "2026-04", publications: 2, grants: 1, news: 1, other: 0 },
    ],
    ...overrides,
  };
}

describe("buildInvestigatorProfileInsights", () => {
  it("includes funding runway and dynamic narrative for Marson", () => {
    const investigator = baseInvestigator();
    const signals: PortfolioSignalItem[] = [
      {
        id: "s1",
        monthKey: "2026-04",
        title: "CRISPR perturbation screen publication",
        occurredAt: "2026-04-19T00:00:00.000Z",
        category: "paper",
        source_type: "pubmed",
        nih_project_num: null,
        investigatorIds: [investigator.id],
      },
      {
        id: "s2",
        monthKey: "2026-02",
        title: "Active NIH R01 grant",
        occurredAt: "2026-02-08T00:00:00.000Z",
        category: "funding",
        source_type: "reporter",
        nih_project_num: "R01-TEST",
        investigatorIds: [investigator.id],
      },
    ];

    const insights = buildInvestigatorProfileInsights({
      investigator,
      signals,
      activitySeries: investigator.activitySeries,
      fundingMatches: [
        {
          id: "m1",
          title: "NIH R01 — Immune Regulation",
          agency: "NIH",
          mechanism: "R01",
          dueDate: "Jun 5, 2026",
          matchScore: 87,
          whyMatch: "Fit",
        },
      ],
      collaborators: [],
    });

    expect(insights.kpis.some((k) => k.id === "funding-runway" && k.value.includes("14"))).toBe(true);
    expect(insights.narrative.toLowerCase()).toContain("crispr");
    expect(insights.consultationQuestions.length).toBeGreaterThan(0);
    expect(insights.grantReadiness[0]?.value).toMatch(/\d+/);
    expect(insights.topicClusters.some((c) => c.role === "primary")).toBe(true);
  });
});
