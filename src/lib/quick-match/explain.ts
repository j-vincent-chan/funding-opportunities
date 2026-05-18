import type { QuickMatchScoreBreakdown } from "./types";

function humanize(tag: string): string {
  return tag.replaceAll("_", " ");
}

/**
 * Deterministic copy from overlap buckets (no LLM).
 */
export function buildQuickMatchExplanation(b: QuickMatchScoreBreakdown, totalScore: number): string {
  const parts: string[] = [];

  if (b.primaryDiseaseHits.length) {
    parts.push(
      `primary disease area (${b.primaryDiseaseHits.map(humanize).join(", ")})`
    );
  }
  if (b.secondaryDiseaseHits.length) {
    parts.push(
      `disease focus (${b.secondaryDiseaseHits.map(humanize).join(", ")})`
    );
  }
  if (b.primaryResearchHits.length) {
    parts.push(
      `primary research focal area (${b.primaryResearchHits.map(humanize).join(", ")})`
    );
  }
  if (b.secondaryResearchHits.length) {
    parts.push(
      `research theme (${b.secondaryResearchHits.map(humanize).join(", ")})`
    );
  }
  if (b.technicalHits.length) {
    parts.push(`technical expertise (${b.technicalHits.map(humanize).join(", ")})`);
  }

  if (parts.length === 0) {
    return "No controlled-tag overlap between this profile and the opportunity text.";
  }

  const overlap = parts.join("; ");
  if (totalScore >= 70) return `Strong fit: overlap on ${overlap}.`;
  if (totalScore >= 35) return `Moderate fit: ${overlap}.`;
  return `Limited overlap: ${overlap}.`;
}
