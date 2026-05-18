/** Structured tags used for Quick Match (canonical ids, e.g. tumor_immunology). */

export type QuickMatchBuckets = {
  research_focal_areas: string[];
  disease_areas: string[];
  technical_expertise: string[];
};

/** PI profile split so primary vs secondary fields get different weights in scoring. */
export type PiQuickMatchProfile = {
  id: string;
  full_name: string;
  home_department: string | null;
  division: string | null;
  researchPrimary: string[];
  researchSecondary: string[];
  diseasePrimary: string[];
  diseaseSecondary: string[];
  technical: string[];
};

export type QuickMatchScoreBreakdown = {
  primaryResearchHits: string[];
  secondaryResearchHits: string[];
  primaryDiseaseHits: string[];
  secondaryDiseaseHits: string[];
  technicalHits: string[];
  rawScore: number;
  maxRaw: number;
};

export type QuickMatchResult = {
  /** 0–100, scaled from raw vs maxRaw for this PI. */
  totalScore: number;
  breakdown: QuickMatchScoreBreakdown;
  explanation: string;
};
