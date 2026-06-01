import { describe, expect, it } from "vitest";
import {
  ANNOTATION_CONCURRENCY_PRESETS,
  annotationDedupeKey,
  resolveAnnotationConcurrency,
} from "@/lib/portfolio-intelligence/annotate-source-documents";

describe("annotationDedupeKey", () => {
  it("is stable per document and model", () => {
    expect(annotationDedupeKey("gpt-4o-mini", "abc-123")).toBe("annotation:gpt-4o-mini:abc-123");
  });
});

describe("resolveAnnotationConcurrency", () => {
  it("allows presets 1, 6, and 32 only", () => {
    expect(ANNOTATION_CONCURRENCY_PRESETS).toEqual([1, 6, 32]);
    expect(resolveAnnotationConcurrency(1)).toBe(1);
    expect(resolveAnnotationConcurrency(6)).toBe(6);
    expect(resolveAnnotationConcurrency(32)).toBe(32);
    expect(resolveAnnotationConcurrency(12)).toBe(6);
    expect(resolveAnnotationConcurrency()).toBe(6);
  });
});
