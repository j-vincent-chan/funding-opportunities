/**
 * Strip leading org / catalog codes some APIs prepend to agency names
 * (e.g. "69A345 Office of the Under Secretary for Policy" → "Office of the Under Secretary for Policy").
 * Requires the first token to contain a digit so we do not strip codes like "NIH".
 */
export function normalizeAgencyDisplayName(agency: string | null | undefined): string | null {
  if (agency == null || typeof agency !== "string") return null;
  const t = agency.trim();
  if (!t) return null;
  const m = t.match(/^([A-Z0-9]{4,})\s+(.+)$/i);
  if (!m) return t;
  const code = m[1];
  if (!/\d/.test(code)) return t;
  const rest = m[2].trim();
  return rest.length >= 4 ? rest : t;
}
