import { createHash } from "node:crypto";

/** Deterministic UUID for Prospera-derived community_source_items (stable upserts). */
export function prosperaCommunityItemId(namespace: string, key: string): string {
  const hash = createHash("sha256")
    .update(`prospera-community:${namespace}:${key}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function prosperaPubmedCacheKey(investigatorId: string, pmid: string): string {
  return `pubmed:${investigatorId}:${pmid}`;
}

export function prosperaReporterCacheKey(
  investigatorId: string,
  projectNum: string,
  fiscalYear: number
): string {
  return `reporter:${investigatorId}:${projectNum}:${fiscalYear}`;
}

export function prosperaClinicalTrialsCacheKey(investigatorId: string, nctId: string): string {
  return `clinicaltrials:${investigatorId}:${nctId.toUpperCase()}`;
}

export function fiscalYearToPublishedAt(fiscalYear: number): string {
  return `${fiscalYear}-10-01T00:00:00.000Z`;
}

export function dateToPublishedAt(date: string | null | undefined): string | null {
  if (!date?.trim()) return null;
  const d = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T00:00:00.000Z`;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
