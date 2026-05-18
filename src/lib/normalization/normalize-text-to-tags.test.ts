import { describe, expect, it } from "vitest";
import { mergeTagBuckets, normalizeTextToTags, preprocessText } from "./normalize-text-to-tags";

describe("preprocessText", () => {
  it("lowercases and strips noise", () => {
    expect(preprocessText("  Cancer, Immunology!  ")).toBe("cancer immunology");
  });
});

describe("normalizeTextToTags", () => {
  it("maps cancer immunology phrases to science/disease tags", () => {
    const t = normalizeTextToTags("cancer immunology and tumor microenvironment");
    expect(t.science).toContain("tumor_immunology");
    expect(t.disease.length).toBeGreaterThan(0);
  });

  it("normalizes single-cell variants", () => {
    const t = normalizeTextToTags("single-cell rna-seq profiling");
    expect(t.method).toContain("single_cell_genomics");
  });

  it("merges buckets", () => {
    const a = normalizeTextToTags("melanoma");
    const b = normalizeTextToTags("tumor immunology");
    const m = mergeTagBuckets(a, b);
    expect(m.disease.length + m.science.length).toBeGreaterThan(0);
  });
});
