/** Best-effort external URL from Simpler / stored raw payload (keys vary by record). */
export function resolveFundingSourceUrl(rawPayloadJson: unknown): string | null {
  if (!rawPayloadJson || typeof rawPayloadJson !== "object") return null;
  const r = rawPayloadJson as Record<string, unknown>;
  const keys = [
    "opportunity_url",
    "url",
    "link",
    "source_url",
    "detail_url",
    "application_url",
    "agency_url",
    "forecast_url",
  ];
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.startsWith("http://") || t.startsWith("https://")) return t;
    }
  }
  return null;
}
