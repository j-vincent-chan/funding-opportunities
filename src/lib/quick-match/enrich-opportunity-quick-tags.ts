import type { ClinicalTrialMode, RdResearchPathway } from "@/lib/funding-opportunities/rd-signals";
import type { QuickMatchBuckets } from "@/lib/quick-match/types";

function uniqSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

export type OpportunityTagSignals = {
  nih_ic_tokens?: string[] | null;
  rd_research_pathway?: RdResearchPathway | string | null;
  clinical_trial_mode?: ClinicalTrialMode | string | null;
  activity_families?: string[] | null;
  category?: string | null;
};

const NIH_IC_SCIENCE: Record<string, string[]> = {
  NCI: ["tumor_immunology"],
  NHLBI: ["cardiovascular_biology"],
  NIAID: ["immunology"],
  NINDS: ["neuroscience"],
  NIDDK: ["metabolic_disease"],
  NICHD: ["pediatric_research"],
  NIMH: ["mental_health_research"],
  NIA: ["aging_research"],
  NEI: ["biomedical_imaging"],
  NIEHS: ["environmental_health"],
  NHGRI: ["genetics_genomics"],
  NIBIB: ["biomedical_imaging"],
  NCATS: ["translational_research"],
  NIAMS: ["musculoskeletal_research"],
};

const NIH_IC_DISEASE: Record<string, string[]> = {
  NCI: ["solid_tumor"],
  NHLBI: ["cardiovascular_disease", "lung_disease"],
  NIAID: ["infectious_disease", "inflammatory_disease"],
  NINDS: ["neurodegenerative_disease", "stroke"],
  NIDDK: ["diabetes", "kidney_disease", "liver_disease", "obesity"],
  NICHD: ["rare_disease"],
};

const PATHWAY_SCIENCE: Record<string, string[]> = {
  basic: ["basic_research"],
  translational: ["translational_research"],
  clinical: ["clinical_research"],
  population: ["population_health"],
  health_services: ["health_services_research"],
  computational: ["computational_biology", "genetics_genomics"],
  mixed: ["translational_research"],
};

const PATHWAY_METHOD: Record<string, string[]> = {
  clinical: ["clinical_trials_methods"],
  population: ["epidemiology", "cohort_studies"],
  health_services: ["implementation_science", "health_outcomes_research"],
  computational: ["bioinformatics", "machine_learning"],
};

const CATEGORY_SCIENCE: Record<string, string[]> = {
  health: ["clinical_research"],
  education: ["health_services_research"],
  environment: ["environmental_health"],
  science: ["basic_research"],
  energy: ["basic_research"],
};

const ACTIVITY_SCIENCE: Record<string, string[]> = {
  K: ["career_development"],
  F: ["basic_research"],
  T: ["translational_research"],
};

const ACTIVITY_METHOD: Record<string, string[]> = {
  U: ["consortium_coordination"],
  P: ["consortium_coordination"],
};

/** Infer additional display tags from stored NIH triage signals and metadata. */
export function enrichOpportunityQuickTags(
  base: QuickMatchBuckets,
  signals: OpportunityTagSignals
): QuickMatchBuckets {
  const science = new Set(base.research_focal_areas);
  const disease = new Set(base.disease_areas);
  const method = new Set(base.technical_expertise);

  for (const ic of signals.nih_ic_tokens ?? []) {
    for (const tag of NIH_IC_SCIENCE[ic] ?? []) science.add(tag);
    for (const tag of NIH_IC_DISEASE[ic] ?? []) disease.add(tag);
  }

  const pathway = signals.rd_research_pathway;
  const trialMode = signals.clinical_trial_mode;
  if (pathway && pathway !== "unknown") {
    for (const tag of PATHWAY_SCIENCE[pathway] ?? []) science.add(tag);
    for (const tag of PATHWAY_METHOD[pathway] ?? []) {
      if (tag === "clinical_trials_methods" && trialMode === "not_allowed") continue;
      method.add(tag);
    }
  }

  if (trialMode === "required" || trialMode === "allowed") {
    method.add("clinical_trials_methods");
    science.add("clinical_research");
  }

  const categoryKey = (signals.category ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (categoryKey) {
    for (const tag of CATEGORY_SCIENCE[categoryKey] ?? []) science.add(tag);
  }

  for (const family of signals.activity_families ?? []) {
    const key = family.toUpperCase();
    for (const tag of ACTIVITY_SCIENCE[key] ?? []) science.add(tag);
    for (const tag of ACTIVITY_METHOD[key] ?? []) method.add(tag);
  }

  return {
    research_focal_areas: uniqSorted(Array.from(science)),
    disease_areas: uniqSorted(Array.from(disease)),
    technical_expertise: uniqSorted(Array.from(method)),
  };
}
