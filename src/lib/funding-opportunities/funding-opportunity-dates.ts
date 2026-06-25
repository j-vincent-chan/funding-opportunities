import { coerceDateString } from "@/lib/formatting/coerce-plain-text";
import type { FundingListRowBucket } from "@/lib/funding-opportunities/funding-list-row-scope";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function opportunitySummary(raw: Record<string, unknown>): Record<string, unknown> | null {
  const s = raw.summary;
  if (s && typeof s === "object" && !Array.isArray(s)) {
    return s as Record<string, unknown>;
  }
  return null;
}

function firstDate(candidates: unknown[]): string | null {
  for (const c of candidates) {
    const d = coerceDateString(c);
    if (d) return d;
  }
  return null;
}

/** Forecasted / anticipated posting date from a Simpler or Grants.gov payload. */
export function resolveEstimatedOpenDateFromPayload(rawPayload: unknown): string | null {
  if (!isPlainRecord(rawPayload)) return null;
  const sm = opportunitySummary(rawPayload);
  const dates = isPlainRecord(rawPayload.dates) ? rawPayload.dates : undefined;
  return firstDate([
    sm?.forecasted_post_date,
    sm?.forecastedPostDate,
    rawPayload.forecasted_post_date,
    rawPayload.forecastedPostDate,
    rawPayload.anticipated_post_date,
    rawPayload.anticipatedPostDate,
    rawPayload.estimated_post_date,
    rawPayload.estimatedPostDate,
    dates?.forecasted_post_date,
    dates?.anticipated_post_date,
    dates?.open_date,
  ]);
}

/** Actual posted / release date (excludes forecast-only fields). */
export function resolveActualPostedDateFromPayload(rawPayload: unknown): string | null {
  if (!isPlainRecord(rawPayload)) return null;
  const sm = opportunitySummary(rawPayload);
  const dates = isPlainRecord(rawPayload.dates) ? rawPayload.dates : undefined;
  return firstDate([
    sm?.post_date,
    sm?.postDate,
    sm?.posted_date,
    rawPayload.post_date,
    rawPayload.postDate,
    rawPayload.posted_date,
    rawPayload.postedDate,
    rawPayload.release_date,
    rawPayload.releaseDate,
    rawPayload.publish_date,
    rawPayload.published_date,
    rawPayload.synopsis_posted_date,
    dates?.post_date,
    dates?.posted_date,
    dates?.release_date,
    dates?.synopsis_posted_date,
  ]);
}

export function resolveEstimatedOpenDate(input: {
  statusBucket: "open" | "forecasted" | "closed";
  postedDate: string | null;
  rawPayload?: unknown;
}): string | null {
  if (input.statusBucket !== "forecasted") return null;
  return resolveEstimatedOpenDateFromPayload(input.rawPayload) ?? input.postedDate;
}

export function resolveListPostedDate(input: {
  statusBucket: "open" | "forecasted" | "closed";
  postedDate: string | null;
  rawPayload?: unknown;
}): string | null {
  if (input.statusBucket === "forecasted") {
    return resolveActualPostedDateFromPayload(input.rawPayload);
  }
  return input.postedDate;
}

/** Source "last updated" from a Simpler or Grants.gov payload (not DB sync time). */
export function resolveLastUpdatedDateFromPayload(rawPayload: unknown): string | null {
  if (!isPlainRecord(rawPayload)) return null;
  const sm = opportunitySummary(rawPayload);
  const dates = isPlainRecord(rawPayload.dates) ? rawPayload.dates : undefined;
  return firstDate([
    rawPayload.updated_at,
    rawPayload.updatedAt,
    rawPayload.last_modified_at,
    rawPayload.lastModifiedAt,
    rawPayload.last_updated,
    rawPayload.lastUpdated,
    rawPayload.last_updated_date,
    rawPayload.lastUpdatedDate,
    rawPayload.last_updated_timestamp,
    rawPayload.lastUpdatedTimestamp,
    rawPayload.opp_fct_syn_last_updated_timestamp,
    rawPayload.oppFctSynLastUpdatedTimestamp,
    sm?.updated_at,
    sm?.updatedAt,
    dates?.updated_at,
    dates?.last_updated,
  ]);
}

/** Display / filter last-updated: prefer source payload, then DB row timestamp. */
export function resolveListLastUpdatedDate(input: {
  dbUpdatedAt: string | null;
  rawPayload?: unknown;
}): string | null {
  return resolveLastUpdatedDateFromPayload(input.rawPayload) ?? input.dbUpdatedAt;
}

export function resolveRowLastUpdatedAt(row: {
  updated_at?: string | null;
  raw_payload_json?: unknown;
}): string | null {
  return resolveListLastUpdatedDate({
    dbUpdatedAt: row.updated_at ?? null,
    rawPayload: row.raw_payload_json,
  });
}

export type NewWithinDaysRowInput = {
  statusBucket: FundingListRowBucket;
  postedDate: string | null;
  updatedAt: string | null;
};

/** Whether a list row counts as "new" for week/month/quarter filters. */
export function isNewWithinDays(
  row: NewWithinDaysRowInput,
  days: number,
  withinDays: (iso: string | null, days: number) => boolean
): boolean {
  if (row.statusBucket === "forecasted") {
    return withinDays(row.updatedAt, days) || withinDays(row.postedDate, days);
  }
  return withinDays(row.postedDate, days);
}

/** Sort key for "new" filters — most recent posted or updated date. */
export function newWithinDaysSortKey(row: NewWithinDaysRowInput): number {
  if (row.statusBucket === "forecasted") {
    const updated = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    const posted = row.postedDate ? new Date(row.postedDate).getTime() : 0;
    return Math.max(updated, posted);
  }
  return row.postedDate ? new Date(row.postedDate).getTime() : 0;
}
