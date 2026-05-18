/**
 * NIH RePORTER API often returns agency / IC fields as nested objects.
 * Normalize to a short human-readable label for storage and UI.
 */

/** Prefer abbreviation + full name when both exist. */
export function normalizeReporterAgencyField(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    if (t.startsWith("{")) {
      try {
        return normalizeReporterAgencyField(JSON.parse(t) as Record<string, unknown>);
      } catch {
        return t;
      }
    }
    return t;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const abbr =
      typeof o.abbreviation === "string"
        ? o.abbreviation.trim()
        : typeof o.code === "string"
          ? o.code.trim()
          : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (abbr && name) return `${abbr} — ${name}`;
    if (name) return name;
    if (abbr) return abbr;
  }

  const s = String(value).trim();
  return s || null;
}

export function normalizeReporterOrgName(value: unknown): string | null {
  return normalizeReporterAgencyField(value);
}

/** Title field names used across RePORTER Project API v2 payloads. */
export function pickReporterProjectTitle(row: Record<string, unknown>): string {
  const keys = ["project_title", "title", "project_title_text", "ProjectTitle"];
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}
