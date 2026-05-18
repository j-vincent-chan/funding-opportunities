/**
 * Controlled vocabularies and synonym maps for deterministic PI/NOFO normalization.
 * Edit here to tune concepts without code changes elsewhere.
 */

/** Canonical science / biology theme tags */
export const SCIENCE_CANONICAL = [
  "tumor_immunology",
  "cancer_immunotherapy",
  "immunology",
  "autoimmunity",
  "transplant_immunology",
  "microbiome_immunity",
  "vaccine_immunology",
  "innate_immunity",
  "adaptive_immunity",
  "t_cell_biology",
  "myeloid_biology",
  "antigen_presentation",
  "checkpoint_immunotherapy",
  "computational_biology",
  "biomedical_imaging",
] as const;

/** Canonical disease / population tags */
export const DISEASE_CANONICAL = [
  "solid_tumor",
  "hematologic_malignancy",
  "melanoma",
  "lung_cancer",
  "breast_cancer",
  "gi_cancer",
  "brain_tumor",
  "inflammatory_disease",
  "infectious_disease",
  "rare_disease",
  "pulmonary_fibrosis",
  "lung_disease",
] as const;

/** Methods / platforms */
export const METHOD_CANONICAL = [
  "single_cell_genomics",
  "spatial_omics",
  "flow_cytometry",
  "mass_cytometry",
  "crispr_functional_genomics",
  "mouse_models",
  "human_samples",
  "clinical_trials_methods",
  "imaging",
  "proteomics",
  "bioinformatics",
  "machine_learning",
  "transcriptomics",
] as const;

/** Translational / asset tags */
export const TRANSLATIONAL_CANONICAL = [
  "biospecimens",
  "biobank_access",
  "clinical_cohorts",
  "patient_derived_models",
  "glp_gmp_transition",
  "early_phase_trial",
] as const;

export type ScienceTag = (typeof SCIENCE_CANONICAL)[number];
export type DiseaseTag = (typeof DISEASE_CANONICAL)[number];
export type MethodTag = (typeof METHOD_CANONICAL)[number];
export type TranslationalTag = (typeof TRANSLATIONAL_CANONICAL)[number];

/** phrase / token → canonical science tag */
export const SCIENCE_SYNONYMS: Record<string, ScienceTag> = {
  "cancer immunology": "tumor_immunology",
  "tumor immunology": "tumor_immunology",
  "tumor microenvironment": "tumor_immunology",
  "tme": "tumor_immunology",
  "cancer immunotherapy": "cancer_immunotherapy",
  "immuno-oncology": "cancer_immunotherapy",
  immunotherapy: "cancer_immunotherapy",
  immunology: "immunology",
  autoimmune: "autoimmunity",
  autoimmunity: "autoimmunity",
  transplant: "transplant_immunology",
  microbiome: "microbiome_immunity",
  vaccine: "vaccine_immunology",
  "innate immunity": "innate_immunity",
  "adaptive immunity": "adaptive_immunity",
  "t cell": "t_cell_biology",
  "t-cell": "t_cell_biology",
  "b cell": "adaptive_immunity",
  myeloid: "myeloid_biology",
  "antigen presentation": "antigen_presentation",
  "checkpoint": "checkpoint_immunotherapy",
  "pd-1": "checkpoint_immunotherapy",
  "pd-l1": "checkpoint_immunotherapy",
  ctla: "checkpoint_immunotherapy",
  "computational biology": "computational_biology",
  bioinformatics: "computational_biology",
  "systems biology": "computational_biology",
  "biomedical imaging": "biomedical_imaging",
  radiology: "biomedical_imaging",
  "medical imaging": "biomedical_imaging",
};

export const DISEASE_SYNONYMS: Record<string, DiseaseTag> = {
  cancer: "solid_tumor",
  oncology: "solid_tumor",
  tumor: "solid_tumor",
  carcinoma: "solid_tumor",
  melanoma: "melanoma",
  "lung cancer": "lung_cancer",
  nsclc: "lung_cancer",
  "breast cancer": "breast_cancer",
  "colorectal": "gi_cancer",
  "gi cancer": "gi_cancer",
  "hematologic": "hematologic_malignancy",
  leukemia: "hematologic_malignancy",
  lymphoma: "hematologic_malignancy",
  "brain tumor": "brain_tumor",
  glioma: "brain_tumor",
  inflammation: "inflammatory_disease",
  "inflammatory bowel": "inflammatory_disease",
  infection: "infectious_disease",
  pathogen: "infectious_disease",
  "rare disease": "rare_disease",
  "pulmonary fibrosis": "pulmonary_fibrosis",
  "lung fibrosis": "pulmonary_fibrosis",
  "idiopathic pulmonary fibrosis": "pulmonary_fibrosis",
  ipf: "pulmonary_fibrosis",
  fibrosis: "pulmonary_fibrosis",
  "lung disease": "lung_disease",
  "respiratory disease": "lung_disease",
  copd: "lung_disease",
};

export const METHOD_SYNONYMS: Record<string, MethodTag> = {
  "single-cell": "single_cell_genomics",
  "single cell": "single_cell_genomics",
  scrna: "single_cell_genomics",
  "scrna-seq": "single_cell_genomics",
  "single-cell rna": "single_cell_genomics",
  "single-cell sequencing": "single_cell_genomics",
  "single-cell rna-seq": "single_cell_genomics",
  "spatial transcript": "spatial_omics",
  "spatial omics": "spatial_omics",
  "flow cytometry": "flow_cytometry",
  cytof: "mass_cytometry",
  "mass cytometry": "mass_cytometry",
  crispr: "crispr_functional_genomics",
  "mouse model": "mouse_models",
  murine: "mouse_models",
  "human samples": "human_samples",
  "patient samples": "human_samples",
  "clinical specimens": "human_samples",
  biospecimen: "human_samples",
  biospecimens: "human_samples",
  "clinical trial": "clinical_trials_methods",
  imaging: "imaging",
  proteomic: "proteomics",
  proteomics: "proteomics",
  bioinformatic: "bioinformatics",
  bioinformatics: "bioinformatics",
  "machine learning": "machine_learning",
  "deep learning": "machine_learning",
  "artificial intelligence": "machine_learning",
  ai: "machine_learning",
  transcriptomics: "transcriptomics",
  "gene expression profiling": "transcriptomics",
  "bulk rna": "transcriptomics",
  "rna-seq": "transcriptomics",
  "rna sequencing": "transcriptomics",
};

export const TRANSLATIONAL_SYNONYMS: Record<string, TranslationalTag> = {
  "human samples": "biospecimens",
  "patient samples": "biospecimens",
  "clinical specimens": "biospecimens",
  biobank: "biobank_access",
  biobanks: "biobank_access",
  "tissue bank": "biobank_access",
  "clinical cohort": "clinical_cohorts",
  "patient cohort": "clinical_cohorts",
  "patient-derived": "patient_derived_models",
  pdx: "patient_derived_models",
  organoid: "patient_derived_models",
  "phase i": "early_phase_trial",
  "phase 1": "early_phase_trial",
  "early phase": "early_phase_trial",
};
