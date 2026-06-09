function parseExpectedAwardsCount(value: unknown): number | null {
  if (value == null || value === "" || value === "--") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value);
  }
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "--") return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function summaryFromRaw(raw: Record<string, unknown>): Record<string, unknown> | null {
  const summary = raw.summary;
  if (summary && typeof summary === "object" && !Array.isArray(summary)) {
    return summary as Record<string, unknown>;
  }
  return null;
}

/** Best-effort expected award count from Simpler / stored raw payload. */
export function resolveExpectedNumberOfAwards(rawPayloadJson: unknown): number | null {
  if (!rawPayloadJson || typeof rawPayloadJson !== "object") return null;
  const raw = rawPayloadJson as Record<string, unknown>;
  const summary = summaryFromRaw(raw);

  const candidates: unknown[] = [
    summary?.expected_number_of_awards,
    summary?.expectedNumberOfAwards,
    summary?.number_of_awards,
    summary?.numberOfAwards,
    raw.expected_number_of_awards,
    raw.expectedNumberOfAwards,
    raw.number_of_awards,
    raw.numberOfAwards,
    raw.expected_awards,
    raw.expectedAwards,
  ];

  for (const candidate of candidates) {
    const parsed = parseExpectedAwardsCount(candidate);
    if (parsed != null) return parsed;
  }

  const inner = raw.opportunity ?? raw.data ?? raw.opportunity_details ?? raw.opportunityDetails;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const nested = inner as Record<string, unknown>;
    return (
      parseExpectedAwardsCount(nested.expected_number_of_awards) ??
      parseExpectedAwardsCount(nested.expectedNumberOfAwards) ??
      parseExpectedAwardsCount(nested.number_of_awards) ??
      parseExpectedAwardsCount(nested.numberOfAwards)
    );
  }

  return null;
}
