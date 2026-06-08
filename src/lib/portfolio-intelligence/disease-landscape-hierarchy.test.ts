import { describe, expect, it } from "vitest";
import {
  buildDiseaseLandscapeCategories,
  buildDiseaseLandscapeDomains,
  mergeDiseaseLandscapeEntries,
  normalizeDiseaseLabel,
  diseaseDomainPreview,
} from "./disease-landscape-hierarchy";

// Re-export for tests — classify is internal; test via build output
function classify(label: string) {
  const cats = buildDiseaseLandscapeCategories([{ label, count: 1 }]);
  return cats[0]?.id ?? "other";
}

describe("normalizeDiseaseLabel", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeDiseaseLabel("  Alzheimer's   Disease ")).toBe("alzheimer's disease");
  });
});

describe("buildDiseaseLandscapeCategories", () => {
  it("groups cancer subtypes under cancer", () => {
    const categories = buildDiseaseLandscapeCategories([
      { label: "cancer", count: 343 },
      { label: "breast cancer", count: 94 },
      { label: "prostate cancer", count: 55 },
      { label: "COVID-19", count: 488 },
    ]);
    const cancer = categories.find((c) => c.id === "cancer");
    expect(cancer).toBeDefined();
    expect(cancer?.count).toBe(343 + 94 + 55);
    expect(cancer?.children.map((c) => c.label)).toEqual(
      expect.arrayContaining(["cancer", "breast cancer", "prostate cancer"])
    );
    const infectious = categories.find((c) => c.id === "infectious");
    expect(infectious?.count).toBe(488);
  });

  it("puts HIV and COVID in infectious, not other", () => {
    expect(classify("HIV")).toBe("infectious");
    expect(classify("HIV/AIDS")).toBe("infectious");
    expect(classify("COVID-19")).toBe("infectious");
  });

  it("merges cardiovascular synonyms in cardiometabolic", () => {
    const categories = buildDiseaseLandscapeCategories([
      { label: "cardiovascular disease", count: 44 },
      { label: "heart disease", count: 39 },
    ]);
    const cardio = categories.find((c) => c.id === "cardiometabolic");
    expect(cardio?.count).toBe(83);
  });

  it("groups common infectious diseases under infectious domain", () => {
    const categories = buildDiseaseLandscapeCategories([
      { label: "tuberculosis", count: 9 },
      { label: "hepatitis B", count: 2 },
      { label: "Flu", count: 1 },
      { label: "Chronic Hepatitis B", count: 1 },
      { label: "long COVID", count: 1 },
      { label: "chronic hepatitis B", count: 1 },
    ]);
    const infectious = categories.find((c) => c.id === "infectious");
    expect(infectious?.count).toBe(15);
    expect(infectious?.children.map((c) => normalizeDiseaseLabel(c.label))).toEqual(
      expect.arrayContaining([
        "tuberculosis",
        "hepatitis b",
        "chronic hepatitis b",
        "flu",
        "long covid",
      ])
    );
    expect(infectious?.children).toHaveLength(5);
  });

  it("deduplicates labels before grouping", () => {
    expect(
      mergeDiseaseLandscapeEntries([
        { label: "Chronic Hepatitis B", count: 1 },
        { label: "chronic hepatitis B", count: 1 },
      ])
    ).toEqual([{ label: "Chronic Hepatitis B", count: 2 }]);
  });

  it("builds domain preview text", () => {
    expect(
      diseaseDomainPreview([
        { id: "1", label: "tuberculosis", count: 9 },
        { id: "2", label: "hepatitis B", count: 2 },
        { id: "3", label: "Flu", count: 1 },
        { id: "4", label: "long COVID", count: 1 },
      ])
    ).toBe("tuberculosis, hepatitis B, Flu +1 more");
  });

  it("returns only canonical domain tiles at root", () => {
    const domains = buildDiseaseLandscapeDomains([
      { label: "non-small cell lung cancer", count: 14 },
      { label: "triple-negative breast cancer", count: 7 },
      { label: "cancer", count: 400 },
      { label: "COVID-19", count: 100 },
    ]);
    expect(domains).toHaveLength(2);
    expect(domains.map((d) => d.name)).toEqual(["Cancer & oncology", "Infectious diseases"]);
    expect(domains.find((d) => d.id === "cancer")?.children.map((c) => c.label)).toEqual(
      expect.arrayContaining(["cancer", "non-small cell lung cancer", "triple-negative breast cancer"])
    );
  });
});
