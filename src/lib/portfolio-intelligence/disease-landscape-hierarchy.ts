export type DiseaseLandscapeEntry = {
  label: string;
  count: number;
};

export type DiseaseLandscapeChild = {
  id: string;
  label: string;
  count: number;
};

export type DiseaseLandscapeCategory = {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
  children: DiseaseLandscapeChild[];
};

const LANDSCAPE_COLORS = [
  "#1f6f8a",
  "#2d8ea4",
  "#4e7bb8",
  "#5e8f88",
  "#7a80b8",
  "#6f8cb7",
  "#8e9cb4",
  "#c45c26",
  "#6b4c9a",
];

export const DISEASE_DOMAIN_IDS = [
  "infectious",
  "cancer",
  "autoimmune",
  "neuro",
  "cardiometabolic",
  "respiratory",
  "mental",
  "musculoskeletal",
  "dermatology",
  "other",
] as const;

export type DiseaseDomainId = (typeof DISEASE_DOMAIN_IDS)[number];

export const DISEASE_DOMAIN_DISPLAY_NAMES: Record<DiseaseDomainId, string> = {
  infectious: "Infectious diseases",
  cancer: "Cancer & oncology",
  autoimmune: "Autoimmunity & immune-mediated",
  neuro: "Neurodegeneration & neurology",
  cardiometabolic: "Cardiovascular & metabolic",
  respiratory: "Respiratory & allergy",
  mental: "Mental health & psychiatry",
  musculoskeletal: "Musculoskeletal & pain",
  dermatology: "Dermatology & skin",
  other: "Other & unclassified",
};

export function isDiseaseLandscapeDomain(
  category: DiseaseLandscapeCategory
): category is DiseaseLandscapeCategory & { id: DiseaseDomainId } {
  return (
    isDiseaseDomainId(category.id) &&
    category.name === DISEASE_DOMAIN_DISPLAY_NAMES[category.id]
  );
}

export function isDiseaseDomainId(id: string): id is DiseaseDomainId {
  return (DISEASE_DOMAIN_IDS as readonly string[]).includes(id);
}

export function normalizeDiseaseLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[''']/g, "'")
    .replace(/\s+/g, " ");
}

/** Merge duplicate annotation labels (e.g. "Chronic Hepatitis B" vs "chronic hepatitis B"). */
export function mergeDiseaseLandscapeEntries(
  entries: DiseaseLandscapeEntry[]
): DiseaseLandscapeEntry[] {
  const merged = new Map<string, { label: string; count: number }>();
  for (const entry of entries) {
    const key = normalizeDiseaseLabel(entry.label);
    if (!key) continue;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { label: entry.label.trim(), count: entry.count });
      continue;
    }
    prev.count += entry.count;
    if (entry.count > prev.count) {
      prev.label = entry.label.trim();
    }
  }
  return Array.from(merged.values());
}

type CategoryRule = {
  id: DiseaseDomainId;
  name: string;
  test: (normalized: string) => boolean;
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    id: "infectious",
    name: "Infectious diseases",
    test: (n) =>
      /\b(covid|long covid|long-covid|sars-cov|coronavirus|mers|influenza|\bflu\b|hiv|aids|tuberculosis|\btb\b|malaria|sepsis|bacterial|viral|pathogen|hepatitis|hep b|hep c|hep a|dengue|zika|mpox|monkeypox|ebola|cholera|typhoid|pertussis|measles|mumps|rubella|herpes|hpv|papillomavirus|streptococcus|staphylococcus|pneumonia|infectious|rsv|norovirus|meningitis|encephalitis|syphilis|gonorrhea|chlamydia|latent tb)\b/.test(
        n
      ),
  },
  {
    id: "cancer",
    name: "Cancer & oncology",
    test: (n) =>
      /\b(cancer|carcinoma|sarcoma|lymphoma|leukemia|leukaemia|lymphoblastic|myeloma|glioblastoma|melanoma|oncolog|tumor|tumour|neoplasm|metastatic|metastasis|nsclc|sclc|triple-negative|triple negative|ductal carcinoma|lobular carcinoma|myelodysplas|blastoma|mesothelioma|seminoma|germinoma)\b/.test(
        n
      ),
  },
  {
    id: "autoimmune",
    name: "Autoimmunity & immune-mediated",
    test: (n) =>
      /\b(autoimmune|autoimmunity|lupus|sle\b|rheumatoid|psoriasis|multiple sclerosis|\bms\b|crohn|colitis|ibd|celiac|scleroderma|vasculitis|myasthenia|graves|hashimoto|sjogren|ankylosing|transplant rejection|immune-mediated)\b/.test(
        n
      ),
  },
  {
    id: "neuro",
    name: "Neurodegeneration & neurology",
    test: (n) =>
      /\b(alzheimer|parkinson|dementia|epilepsy|neurodegenerat|als\b|amyotrophic|huntington|neuropathy|neurolog|stroke|migraine|seizure|brain injury|tbi\b)\b/.test(
        n
      ) && !/\b(cancer|carcinoma|glioblastoma)\b/.test(n),
  },
  {
    id: "cardiometabolic",
    name: "Cardiovascular & metabolic",
    test: (n) =>
      /\b(cardiovascular|heart disease|cardiac|hypertension|diabetes|obesity|metabolic|atherosclerosis|hyperlipidemia|dyslipidemia|nafld|fatty liver|kidney disease|renal failure|ckd\b|nephropathy)\b/.test(
        n
      ),
  },
  {
    id: "respiratory",
    name: "Respiratory & allergy",
    test: (n) =>
      /\b(asthma|copd|pulmonary|respiratory|lung disease|allergy|allergic|rhinitis|sinusitis|fibrosis|ild\b|interstitial lung)\b/.test(n) &&
      !/\b(cancer|carcinoma)\b/.test(n),
  },
  {
    id: "mental",
    name: "Mental health & psychiatry",
    test: (n) =>
      /\b(depression|anxiety|psychiatric|schizophrenia|bipolar|mental health|ptsd|substance use|addiction|suicid)\b/.test(
        n
      ),
  },
  {
    id: "musculoskeletal",
    name: "Musculoskeletal & pain",
    test: (n) =>
      /\b(osteoarthritis|arthritis|osteoporosis|fracture|musculoskeletal|back pain|fibromyalgia|gout)\b/.test(n) &&
      !/\b(rheumatoid|autoimmune)\b/.test(n),
  },
  {
    id: "dermatology",
    name: "Dermatology & skin",
    test: (n) =>
      /\b(psoriasis|eczema|atopic dermatitis|acne|skin disease|dermatitis|vitiligo)\b/.test(n) &&
      !/\b(cancer|carcinoma|melanoma)\b/.test(n),
  },
];

function classifyDiseaseCategory(normalized: string): DiseaseDomainId {
  for (const rule of CATEGORY_RULES) {
    if (rule.test(normalized)) return rule.id;
  }
  return "other";
}

function childId(categoryId: string, label: string): string {
  return `${categoryId}-${normalizeDiseaseLabel(label).replace(/[^a-z0-9]+/g, "-")}`;
}

function pickDisplayLabel(existing: string, incoming: string): string {
  if (existing.length >= incoming.length) return existing;
  return incoming;
}

function addChild(
  buckets: Map<string, Map<string, DiseaseLandscapeChild>>,
  categoryId: DiseaseDomainId,
  label: string,
  count: number
) {
  const bucket = buckets.get(categoryId) ?? new Map<string, DiseaseLandscapeChild>();
  const key = normalizeDiseaseLabel(label);
  const prev = bucket.get(key);
  if (!prev) {
    bucket.set(key, { id: childId(categoryId, label), label, count });
  } else {
    prev.count += count;
    prev.label = pickDisplayLabel(prev.label, label);
  }
  buckets.set(categoryId, bucket);
}

/** Re-run classification on "other" leftovers — catches labels missed on first pass. */
function reclassifyOtherBucket(buckets: Map<string, Map<string, DiseaseLandscapeChild>>) {
  const otherBucket = buckets.get("other");
  if (!otherBucket?.size) return;
  for (const [key, child] of Array.from(otherBucket.entries())) {
    const target = classifyDiseaseCategory(key);
    if (target === "other") continue;
    otherBucket.delete(key);
    addChild(buckets, target, child.label, child.count);
  }
}

export function buildDiseaseLandscapeCategories(
  entries: DiseaseLandscapeEntry[]
): DiseaseLandscapeCategory[] {
  const mergedEntries = mergeDiseaseLandscapeEntries(entries);
  const buckets = new Map<string, Map<string, DiseaseLandscapeChild>>();
  for (const id of DISEASE_DOMAIN_IDS) {
    buckets.set(id, new Map());
  }

  for (const entry of mergedEntries) {
    const label = entry.label.trim();
    if (!label) continue;
    const categoryId = classifyDiseaseCategory(normalizeDiseaseLabel(label));
    addChild(buckets, categoryId, label, entry.count);
  }

  reclassifyOtherBucket(buckets);

  const total = mergedEntries.reduce((acc, row) => acc + row.count, 0) || 1;
  const domainMap = new Map<DiseaseDomainId, DiseaseLandscapeCategory>();

  for (const [index, rule] of CATEGORY_RULES.entries()) {
    const children = Array.from(buckets.get(rule.id)?.values() ?? []).sort(
      (a, b) => b.count - a.count
    );
    const count = children.reduce((acc, child) => acc + child.count, 0);
    if (count <= 0) continue;
    domainMap.set(rule.id, {
      id: rule.id,
      name: DISEASE_DOMAIN_DISPLAY_NAMES[rule.id],
      color: LANDSCAPE_COLORS[index] ?? "#8e9cb4",
      count,
      percentage: Math.max(1, Math.round((count / total) * 100)),
      children,
    });
  }

  const otherChildren = Array.from(buckets.get("other")?.values() ?? []).sort(
    (a, b) => b.count - a.count
  );
  const otherCount = otherChildren.reduce((acc, child) => acc + child.count, 0);
  if (otherCount > 0) {
    domainMap.set("other", {
      id: "other",
      name: DISEASE_DOMAIN_DISPLAY_NAMES.other,
      color: LANDSCAPE_COLORS[CATEGORY_RULES.length] ?? "#8e9cb4",
      count: otherCount,
      percentage: Math.max(1, Math.round((otherCount / total) * 100)),
      children: otherChildren,
    });
  }

  return Array.from(domainMap.values()).sort((a, b) => b.count - a.count);
}

export function diseaseDomainPreview(children: DiseaseLandscapeChild[], limit = 3): string {
  if (children.length === 0) return "";
  const names = children.slice(0, limit).map((child) => child.label);
  const remaining = children.length - names.length;
  if (remaining <= 0) return names.join(", ");
  return `${names.join(", ")} +${remaining} more`;
}

/** Canonical domain list for the root landscape view (exactly one tile per domain). */
export function buildDiseaseLandscapeDomains(
  entries: DiseaseLandscapeEntry[]
): DiseaseLandscapeCategory[] {
  const categories = buildDiseaseLandscapeCategories(entries);
  const byId = new Map<DiseaseDomainId, DiseaseLandscapeCategory>();
  for (const category of categories) {
    if (!isDiseaseLandscapeDomain(category)) continue;
    byId.set(category.id, category);
  }
  return Array.from(byId.values()).sort((a, b) => b.count - a.count);
}
