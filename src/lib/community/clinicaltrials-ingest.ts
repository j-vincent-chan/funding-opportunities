/**
 * ClinicalTrials.gov ingestion via the public REST API v2.
 * Docs: https://clinicaltrials.gov/data-api/about-api
 *
 * Name-based investigator search is ambiguous; prefer clinicaltrials_query_override when possible.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AsyncRateLimiter } from "@/lib/utils/async-rate-limiter";

const API_BASE = "https://clinicaltrials.gov/api/v2";
const PAGE_SIZE = 100;
/** ~2 requests/second per NLM guidance. */
const MIN_INTERVAL_MS = Number(process.env.CLINICALTRIALS_MIN_INTERVAL_MS ?? 550);

const clinicalTrialsRateLimiter = new AsyncRateLimiter(MIN_INTERVAL_MS);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

async function fetchClinicalTrialsApi(url: string, opts?: { maxAttempts?: number }): Promise<Response> {
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 5);
  let lastRes: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await clinicalTrialsRateLimiter.schedule(() =>
      fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
    );
    lastRes = res;
    if (!isRetryableStatus(res.status)) return res;
    if (attempt >= maxAttempts) return res;
    await sleep(Math.min(60_000, 1500 * 2 ** (attempt - 1)));
  }
  return lastRes ?? new Response(null, { status: 503 });
}

export function resolveClinicalTrialsMaxResults(optsMax?: number): number {
  const env = process.env.CLINICALTRIALS_MAX_RESULTS?.trim();
  const fromEnv = env ? parseInt(env, 10) : NaN;
  const cap = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 500;
  if (optsMax != null && Number.isFinite(optsMax) && optsMax > 0) {
    return Math.min(cap, Math.floor(optsMax));
  }
  return cap;
}

/** Build API v2 `query.term` using search-area syntax. */
export function buildClinicalTrialsQuery(args: {
  fullName: string;
  clinicaltrialsQueryOverride: string | null;
  affiliation?: string | null;
}): string {
  if (args.clinicaltrialsQueryOverride?.trim()) return args.clinicaltrialsQueryOverride.trim();
  const name = args.fullName.trim();
  if (!name) return "";
  const escaped = name.replace(/"/g, "");
  const parts = [`AREA[LeadInvestigator]"${escaped}"`];
  const aff = args.affiliation?.trim();
  if (aff) parts.push(`AREA[LocationFacility]${aff}`);
  return parts.join(" AND ");
}

type DateStruct = { date?: string | null };

type StudyProtocol = {
  identificationModule?: {
    nctId?: string | null;
    briefTitle?: string | null;
    officialTitle?: string | null;
  };
  statusModule?: {
    overallStatus?: string | null;
    startDateStruct?: DateStruct | null;
    lastUpdatePostDateStruct?: DateStruct | null;
  };
  conditionsModule?: { conditions?: string[] | null };
  sponsorCollaboratorsModule?: { leadSponsor?: { name?: string | null } | null };
  descriptionModule?: { briefSummary?: string | null };
};

type StudyRecord = { protocolSection?: StudyProtocol | null };

type StudiesPage = {
  studies?: StudyRecord[] | null;
  nextPageToken?: string | null;
  totalCount?: number | null;
};

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const d = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function parseClinicalTrialStudy(study: StudyRecord): {
  nctId: string;
  title: string;
  overallStatus: string | null;
  conditions: string[];
  leadSponsor: string | null;
  startDate: string | null;
  lastUpdateDate: string | null;
  briefSummary: string | null;
} | null {
  const section = study.protocolSection;
  const ident = section?.identificationModule;
  const nctId = ident?.nctId?.trim().toUpperCase() ?? "";
  if (!/^NCT\d{8}$/.test(nctId)) return null;

  const title =
    (ident?.briefTitle ?? ident?.officialTitle ?? "").replace(/\s+/g, " ").trim() || nctId;
  const status = section?.statusModule;
  const conditions = (section?.conditionsModule?.conditions ?? [])
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);

  return {
    nctId,
    title,
    overallStatus: status?.overallStatus?.trim() || null,
    conditions,
    leadSponsor: section?.sponsorCollaboratorsModule?.leadSponsor?.name?.trim() || null,
    startDate: parseIsoDate(status?.startDateStruct?.date ?? null),
    lastUpdateDate: parseIsoDate(status?.lastUpdatePostDateStruct?.date ?? null),
    briefSummary: section?.descriptionModule?.briefSummary?.replace(/\s+/g, " ").trim() || null,
  };
}

export async function searchClinicalTrialsStudies(
  queryTerm: string,
  maxResults: number
): Promise<{ studies: StudyRecord[]; totalCount: number | null }> {
  const studies: StudyRecord[] = [];
  let pageToken: string | undefined;
  let totalCount: number | null = null;

  while (studies.length < maxResults) {
    const params = new URLSearchParams();
    params.set("query.term", queryTerm);
    params.set("pageSize", String(Math.min(PAGE_SIZE, maxResults - studies.length)));
    params.set("format", "json");
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${API_BASE}/studies?${params.toString()}`;
    const res = await fetchClinicalTrialsApi(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `ClinicalTrials.gov API ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`
      );
    }

    const page = (await res.json()) as StudiesPage;
    if (totalCount == null && typeof page.totalCount === "number") {
      totalCount = page.totalCount;
    }

    const batch = page.studies ?? [];
    studies.push(...batch);
    pageToken = page.nextPageToken?.trim() || undefined;
    if (!pageToken || batch.length === 0) break;
  }

  return { studies: studies.slice(0, maxResults), totalCount };
}

export type ClinicalTrialsIngestResult = {
  inserted: number;
  queryTerm: string;
  nctIds: string[];
  totalCount: number | null;
  warning?: string;
};

/**
 * Search ClinicalTrials.gov for studies tied to an investigator and upsert cache rows.
 */
export async function refreshInvestigatorClinicalTrials(
  supabase: SupabaseClient,
  investigatorId: string,
  opts: { max?: number } = {}
): Promise<ClinicalTrialsIngestResult> {
  const max = resolveClinicalTrialsMaxResults(opts.max);

  const { data: inv, error: invErr } = await supabase
    .from("investigators")
    .select("id, full_name, home_department, division, clinicaltrials_query_override")
    .eq("id", investigatorId)
    .maybeSingle();

  if (invErr || !inv) {
    throw new Error(invErr?.message ?? "Investigator not found");
  }

  const queryTerm = buildClinicalTrialsQuery({
    fullName: inv.full_name ?? "",
    clinicaltrialsQueryOverride: inv.clinicaltrials_query_override ?? null,
    affiliation: inv.home_department ?? inv.division ?? "UCSF",
  });
  if (!queryTerm) {
    throw new Error(
      "No ClinicalTrials.gov query — set full name or clinicaltrials_query_override on the investigator."
    );
  }

  const { studies, totalCount } = await searchClinicalTrialsStudies(queryTerm, max);
  if (studies.length === 0) {
    return {
      inserted: 0,
      queryTerm,
      nctIds: [],
      totalCount,
      warning: "No studies returned for this query.",
    };
  }

  let inserted = 0;
  const nctIds: string[] = [];

  for (const study of studies) {
    const parsed = parseClinicalTrialStudy(study);
    if (!parsed) continue;
    nctIds.push(parsed.nctId);

    const { error } = await supabase.from("investigator_clinical_trials").upsert(
      {
        investigator_id: investigatorId,
        nct_id: parsed.nctId,
        title: parsed.title,
        overall_status: parsed.overallStatus,
        conditions: parsed.conditions,
        lead_sponsor: parsed.leadSponsor,
        start_date: parsed.startDate,
        last_update_date: parsed.lastUpdateDate,
        brief_summary: parsed.briefSummary,
        source: "clinicaltrials_api_v2",
        raw_json: study as unknown as Record<string, unknown>,
        match_confidence: "medium",
        provenance_note: `query.term: ${queryTerm}`,
      },
      { onConflict: "investigator_id,nct_id" }
    );
    if (!error) inserted += 1;
  }

  return { inserted, queryTerm, nctIds, totalCount };
}

export function clinicalTrialsStudyUrl(nctId: string): string {
  return `https://clinicaltrials.gov/study/${nctId}`;
}
