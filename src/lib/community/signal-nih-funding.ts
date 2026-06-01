/** NIH RePORTER project-number helpers (ported from Signal dashboard logic). */

function normalizeProjectNum(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function resolveNihProjectNumForItem(item: {
  nih_project_num?: string | null;
  title?: string | null;
}): string | null {
  const direct = item.nih_project_num?.trim();
  if (direct) return normalizeProjectNum(direct);
  const title = (item.title ?? "").trim();
  const m = /\(([0-9][0-9A-Z]{4,}-[0-9]{2}[A-Z0-9,]*)\)\s*$/i.exec(title);
  return m?.[1] ? normalizeProjectNum(m[1]) : null;
}

export function isNihNewGrantByProjectNum(projectNum: string): boolean {
  const normalized = normalizeProjectNum(projectNum);
  return normalized.startsWith("1");
}

export function isNihFundingForDigestActiveDrafts(item: {
  category?: string | null;
  source_type?: string | null;
  nih_project_num?: string | null;
  title?: string | null;
}): boolean {
  if (item.category !== "funding" || item.source_type !== "reporter") return true;
  const projectNum = resolveNihProjectNumForItem(item);
  if (!projectNum) return false;
  return isNihNewGrantByProjectNum(projectNum);
}

export type NihFundingDashboardBucket = "new_funding" | "active_grant";

export function nihFundingDashboardBucket(item: {
  category?: string | null;
  source_type?: string | null;
  nih_project_num?: string | null;
  title?: string | null;
}): NihFundingDashboardBucket | null {
  if (item.category !== "funding") return null;
  if (item.source_type !== "reporter") return "new_funding";
  return isNihFundingForDigestActiveDrafts(item) ? "new_funding" : "active_grant";
}
