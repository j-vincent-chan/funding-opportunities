import { clinicalTrialsStudyUrl } from "@/lib/community/clinicaltrials-ingest";

type SignalLinkInput = {
  sourceUrl?: string | null;
  source_type?: string | null;
  category?: string | null;
  nih_project_num?: string | null;
  title?: string | null;
};

function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function extractPubMedPmid(value: string): string | null {
  const fromUrl = value.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)?.[1];
  if (fromUrl) return fromUrl;
  const fromPath = value.match(/^\/(\d{5,})\/?$/);
  if (fromPath?.[1]) return fromPath[1];
  return null;
}

function extractNctId(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const match = (value ?? "").match(/\b(NCT\d{8})\b/i);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

/** Best-effort external URL for a portfolio/community signal row. */
export function resolveSignalSourceUrl(item: SignalLinkInput): string | null {
  const direct = normalizeHttpUrl(item.sourceUrl ?? "");
  if (direct) {
    const pmid = extractPubMedPmid(direct);
    if (pmid && /pubmed\.ncbi\.nlm\.nih\.gov\/?$/i.test(direct)) {
      return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    }
    return direct;
  }

  const sourceType = (item.source_type ?? "").toLowerCase();
  const category = (item.category ?? "").toLowerCase();

  if (sourceType === "pubmed" || category === "paper") {
    const pmid = extractPubMedPmid(item.sourceUrl ?? "");
    if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  }

  const projectNum = (item.nih_project_num ?? "").trim();
  if (projectNum && (sourceType === "reporter" || category === "funding")) {
    return `https://reporter.nih.gov/search/projects?projectNum=${encodeURIComponent(projectNum)}`;
  }

  if (sourceType.includes("trial") || category.includes("trial")) {
    const nctId = extractNctId(item.title, item.sourceUrl);
    if (nctId) return clinicalTrialsStudyUrl(nctId);
  }

  return null;
}
