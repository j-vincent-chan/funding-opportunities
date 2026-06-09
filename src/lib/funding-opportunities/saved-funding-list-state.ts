import { z } from "zod";
import {
  DEFAULT_FUNDING_LIST_PER_PAGE,
  DEFAULT_FUNDING_LIST_PAGE,
  FUNDING_LIST_PAGE_SIZES,
  type FundingListClientState,
  type FundingListPageSize,
  type FundingListScope,
  type FundingListViewTab,
} from "@/lib/funding-opportunities/funding-list-url";
import type { ClinicalTrialMode } from "@/lib/funding-opportunities/rd-signals";
import type { RdListFilterState } from "@/lib/funding-opportunities/rd-list-filters";

const SCOPES = new Set<FundingListScope>(["any", "all", "open", "forecasted", "closed"]);
const TABS = new Set<FundingListViewTab>([
  "all",
  "recommended",
  "closing_soon",
  "new_this_week",
  "large_awards",
  "esi_career",
  "investigator_initiated",
  "foundations",
  "saved",
  "immunology_translational",
]);

const trialEnum = z.enum(["unknown", "required", "allowed", "not_allowed"]);

function normalizeClinicalTrialMode(v: unknown): ClinicalTrialMode | null {
  if (v == null || v === "") return null;
  const s = String(v);
  return trialEnum.safeParse(s).success ? (s as ClinicalTrialMode) : null;
}

function normalizePerPage(v: unknown): FundingListPageSize {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (Number.isFinite(n) && (FUNDING_LIST_PAGE_SIZES as readonly number[]).includes(n)) {
    return n as FundingListPageSize;
  }
  return DEFAULT_FUNDING_LIST_PER_PAGE;
}

function normalizeScope(v: unknown): FundingListScope {
  if (typeof v === "string" && SCOPES.has(v as FundingListScope)) return v as FundingListScope;
  return "all";
}

function normalizeTab(v: unknown): FundingListViewTab {
  if (typeof v === "string" && TABS.has(v as FundingListViewTab)) return v as FundingListViewTab;
  return "all";
}

const rdListFilterStateSchema: z.ZodType<RdListFilterState> = z
  .object({
    activityFamilies: z.array(z.string()).catch([]),
    clinicalTrialMode: z.any().transform(normalizeClinicalTrialMode),
    nihIc: z.array(z.string()).catch([]),
    announcement: z.array(z.string()).catch([]),
    pathway: z.array(z.string()).catch([]),
    investigatorTags: z.array(z.string()).catch([]),
    mechanismTypes: z.array(z.string()).catch([]),
    collaborations: z.array(z.string()).catch([]),
    humanSubjects: z.array(z.string()).catch([]),
  })
  .partial()
  .transform((partial) => ({
    activityFamilies: partial.activityFamilies ?? [],
    clinicalTrialMode: partial.clinicalTrialMode ?? null,
    nihIc: partial.nihIc ?? [],
    announcement: partial.announcement ?? [],
    pathway: partial.pathway ?? [],
    investigatorTags: partial.investigatorTags ?? [],
    mechanismTypes: partial.mechanismTypes ?? [],
    collaborations: partial.collaborations ?? [],
    humanSubjects: partial.humanSubjects ?? [],
  }));

const departmentSubsSchema = z
  .record(z.string(), z.unknown())
  .catch({})
  .transform((rec) => {
    const out: FundingListClientState["departmentSubs"] = {};
    for (const [k, v] of Object.entries(rec)) {
      if (!k) continue;
      if (!Array.isArray(v)) continue;
      const arr = v.filter((x): x is string => typeof x === "string" && x.length > 0);
      if (arr.length) out[k] = arr;
    }
    return out;
  });

const fundingListClientStateSchema = z
  .object({
    q: z.string().catch(""),
    scope: z.unknown().transform(normalizeScope),
    tab: z.unknown().transform(normalizeTab).optional(),
    closingDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional(),
    postedDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
    sort: z.string().catch("posted_date"),
    order: z.enum(["asc", "desc"]).catch("desc"),
    page: z.number().int().positive().optional().catch(DEFAULT_FUNDING_LIST_PAGE),
    perPage: z.unknown().transform(normalizePerPage),
    departments: z.array(z.string()).catch([]),
    departmentSubs: departmentSubsSchema,
    legacyAgencies: z.array(z.string()).catch([]),
    rd: z.unknown().transform((raw) => rdListFilterStateSchema.parse(raw)),
  })
  .partial()
  .transform((partial) => {
    const rd = partial.rd ?? rdListFilterStateSchema.parse({});
    return {
      q: partial.q ?? "",
      scope: typeof partial.scope === "string" ? normalizeScope(partial.scope) : normalizeScope(undefined),
      tab: normalizeTab(partial.tab),
      closingDays:
        partial.closingDays === 30 || partial.closingDays === 60 || partial.closingDays === 90
          ? partial.closingDays
          : undefined,
      postedDays:
        partial.postedDays === 7 || partial.postedDays === 30 || partial.postedDays === 90
          ? partial.postedDays
          : undefined,
      sort: partial.sort ?? "posted_date",
      order: partial.order === "asc" || partial.order === "desc" ? partial.order : "desc",
      page: DEFAULT_FUNDING_LIST_PAGE,
      perPage: normalizePerPage(partial.perPage),
      departments: partial.departments ?? [],
      departmentSubs: partial.departmentSubs ?? {},
      legacyAgencies: partial.legacyAgencies ?? [],
      rd,
    } satisfies FundingListClientState;
  });

/** Parse JSON from DB or client; returns null if the payload cannot be coerced safely. */
export function parseSavedFundingListState(value: unknown): FundingListClientState | null {
  const r = fundingListClientStateSchema.safeParse(value);
  return r.success ? r.data : null;
}

/** Strip pagination when persisting (restored searches open on page 1). */
export function fundingListStateForBookmark(state: FundingListClientState): FundingListClientState {
  return {
    ...state,
    page: DEFAULT_FUNDING_LIST_PAGE,
  };
}
