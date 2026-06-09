export function isExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Open a validated external funding URL without routing through the Next.js app. */
export function openExternalFundingUrl(url: string): void {
  if (!isExternalHttpUrl(url)) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export type FundingSourceLinkInput = {
  raw_payload_json?: unknown;
  source_system?: string | null;
  source_opportunity_id?: string | null;
};

const URL_KEY_HINTS = [
  "opportunity_url",
  "url",
  "link",
  "source_url",
  "detail_url",
  "application_url",
  "agency_url",
  "forecast_url",
  "opportunity_link",
  "listing_url",
  "public_url",
  "grants_gov_url",
  "synopsis_url",
  "synopsisUrl",
];

const OPPORTUNITY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function findHttpUrlDeep(value: unknown, depth = 0, seen = new WeakSet<object>()): string | null {
  if (depth > 8 || value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isExternalHttpUrl(trimmed)) return trimmed;
    const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
    if (match && isExternalHttpUrl(match[0])) return match[0];
    return null;
  }

  if (typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHttpUrlDeep(item, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of URL_KEY_HINTS) {
    if (key in record) {
      const found = findHttpUrlDeep(record[key], depth + 1, seen);
      if (found) return found;
    }
  }
  for (const nested of Object.values(record)) {
    const found = findHttpUrlDeep(nested, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function fallbackFundingSourceUrl(
  sourceSystem: string | null | undefined,
  sourceOpportunityId: string | null | undefined
): string | null {
  const id = sourceOpportunityId?.trim();
  if (!id) return null;

  const system = sourceSystem?.trim().toLowerCase() ?? "";
  if (system === "simpler_grants" || OPPORTUNITY_UUID_RE.test(id)) {
    return `https://simpler.grants.gov/opportunity/${encodeURIComponent(id)}`;
  }
  if (/^\d+$/.test(id)) {
    return `https://www.grants.gov/search-results-detail/${id}`;
  }
  return `https://www.grants.gov/web/grants/view-opportunity.html?oppId=${encodeURIComponent(id)}`;
}

/** Best-effort external agency URL from stored payload and source identifiers. */
export function resolveFundingSourceUrl(input: FundingSourceLinkInput | unknown): string | null {
  const record: FundingSourceLinkInput =
    input != null && typeof input === "object" && ("raw_payload_json" in input || "source_opportunity_id" in input)
      ? (input as FundingSourceLinkInput)
      : { raw_payload_json: input };

  const fromPayload = findHttpUrlDeep(record.raw_payload_json);
  if (fromPayload) return fromPayload;

  return fallbackFundingSourceUrl(record.source_system, record.source_opportunity_id);
}
