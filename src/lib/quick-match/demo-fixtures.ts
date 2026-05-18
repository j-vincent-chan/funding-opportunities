/**
 * In-memory demos for tests and documentation (not loaded into DB).
 * Shows strong, partial, and weak Quick Match scenarios.
 */

import type { PiQuickMatchProfile } from "./types";
import { extractOpportunityQuickTags } from "./tag-opportunity";
import { buildPiQuickMatchProfile } from "./normalize-pi";
import { rankInvestigatorsForOpportunity } from "./engine";

/** Minimal PI rows for demo ranking */
export const DEMO_INVESTIGATORS: PiQuickMatchProfile[] = [
  buildPiQuickMatchProfile(
    {
      id: "00000000-0000-4000-8000-000000000001",
      full_name: "Strong Match PI",
      home_department: "Medicine",
      division: null,
      raw_profile_json: {
        primary_research_area: "cancer immunotherapy and tumor microenvironment",
        secondary_research_areas: "translational immuno-oncology",
        primary_disease_focus: "lung cancer",
        secondary_disease_focuses: "solid tumors",
        technological_expertise: "single-cell RNA-seq and spatial transcriptomics",
      },
    },
    {
      science_tags: ["tumor_immunology"],
      disease_tags: ["lung_cancer"],
      method_tags: ["single_cell_genomics"],
      translational_tags: ["clinical_cohorts"],
    }
  ),
  buildPiQuickMatchProfile(
    {
      id: "00000000-0000-4000-8000-000000000002",
      full_name: "Partial Match PI",
      home_department: "Pediatrics",
      division: null,
      raw_profile_json: {
        primary_research_area: "infectious disease immunity",
        primary_disease_focus: "inflammatory bowel disease",
        technological_expertise: "flow cytometry",
      },
    },
    null
  ),
  buildPiQuickMatchProfile(
    {
      id: "00000000-0000-4000-8000-000000000003",
      full_name: "Weak Match PI",
      home_department: "Neurology",
      division: null,
      raw_profile_json: {
        primary_research_area: "circuit neuroscience",
        primary_disease_focus: "rare neurodegeneration",
        technological_expertise: "optogenetics",
      },
    },
    null
  ),
];

/** Opportunity text with rich immunotherapy + lung + scRNA vocabulary */
export const DEMO_OPPORTUNITY_STRONG = extractOpportunityQuickTags({
  title: "Lung cancer immunotherapy and single-cell transcriptomics in the tumor microenvironment",
  description:
    "This notice supports translational studies combining cancer immunotherapy with single-cell RNA-seq profiling of NSCLC cohorts.",
  agency: "National Cancer Institute",
  category: "Research project grant",
});

/** Run demo rank (used in vitest) */
export function runDemoRankStrongOpp() {
  return rankInvestigatorsForOpportunity(DEMO_OPPORTUNITY_STRONG, DEMO_INVESTIGATORS);
}
