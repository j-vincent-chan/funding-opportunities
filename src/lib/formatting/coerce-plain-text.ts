/**
 * Simpler.Grants.gov (and other APIs) sometimes return rich objects instead of a string
 * for summary/description. React will render objects as "[object Object]" unless coerced.
 */
export function coercePlainTextFromUnknown(value: unknown, maxLen = 500_000): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, maxLen).trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => coercePlainTextFromUnknown(v, maxLen))
      .filter((s) => s.length > 0);
    return parts.join("\n\n").slice(0, maxLen);
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = [
      "text",
      "plain_text",
      "plainText",
      "body",
      "summary_description",
      "description",
      "content",
      "markdown",
      "html",
      "value",
      "message",
      "label",
    ];
    for (const k of keys) {
      const inner = o[k];
      if (typeof inner === "string" && inner.trim()) {
        return inner.slice(0, maxLen);
      }
    }
    if ("summary" in o) {
      const nested = coercePlainTextFromUnknown(o.summary, maxLen);
      if (nested) return nested;
    }
    try {
      return JSON.stringify(o, null, 2).slice(0, maxLen);
    } catch {
      return "";
    }
  }
  return String(value).slice(0, maxLen);
}

/** Safe YYYY-MM-DD for Postgres `date` columns, or null from API oddities. */
export function coerceDateString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const ymd = t.match(/^(\d{4}-\d{2}-\d{2})/);
    if (ymd) return ymd[1];
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return coerceDateString((value as { value: unknown }).value);
  }
  if (typeof value === "object" && value !== null && "date" in value) {
    return coerceDateString((value as { date: unknown }).date);
  }
  return null;
}
