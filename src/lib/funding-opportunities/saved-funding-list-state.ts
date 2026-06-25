import { z } from "zod";
import { TOP_LEVEL_DEPARTMENTS } from "@/lib/funding-opportunities/agency-taxonomy";
import type { FundingListQuickFilterTab } from "@/lib/funding-opportunities/funding-quick-filters";
import {
  DEFAULT_FUNDING_LIST_PER_PAGE,
  DEFAULT_FUNDING_LIST_PAGE,
  FUNDING_LIST_PAGE_SIZES,
  fundingListHref,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
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

function normalizeQuickFilterTabs(v: unknown, legacyTab?: unknown): FundingListQuickFilterTab[] {
  const out: FundingListQuickFilterTab[] = [];
  const add = (raw: unknown) => {
    if (typeof raw !== "string" || !raw.trim()) return;
    const id = raw.trim();
    if (id === "all" || !TABS.has(id as FundingListViewTab)) return;
    if (id === "immunology_translational") return;
    const tab = id as FundingListQuickFilterTab;
    if (!out.includes(tab)) out.push(tab);
  };
  if (Array.isArray(v)) {
    for (const item of v) add(item);
  } else if (typeof v === "string") {
    add(v);
  }
  if (out.length === 0 && legacyTab !== undefined) {
    add(legacyTab);
  }
  return out;
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
    tabs: z.array(z.string()).optional(),
    tab: z.unknown().optional(),
    closingDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional(),
    postedDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
    sort: z.string().catch("posted_date"),
    order: z.enum(["asc", "desc"]).catch("desc"),
    page: z.number().int().positive().optional().catch(DEFAULT_FUNDING_LIST_PAGE),
    perPage: z.unknown().transform(normalizePerPage),
    departments: z.array(z.string()).catch([]),
    departmentSubs: departmentSubsSchema,
    legacyAgencies: z.array(z.string()).catch([]),
    allDepartments: z.boolean().optional(),
    noDepartmentsSelected: z.boolean().optional(),
    rd: z.unknown().transform((raw) => rdListFilterStateSchema.parse(raw)),
  })
  .partial()
  .transform((partial) => {
    const rd = partial.rd ?? rdListFilterStateSchema.parse({});
    return {
      q: partial.q ?? "",
      scope: typeof partial.scope === "string" ? normalizeScope(partial.scope) : normalizeScope(undefined),
      tabs: normalizeQuickFilterTabs(partial.tabs, partial.tab),
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
      allDepartments: partial.allDepartments,
      noDepartmentsSelected: partial.noDepartmentsSelected,
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

const TAB_LABELS: Partial<Record<FundingListViewTab, string>> = {
  recommended: "Matched to me",
  closing_soon: "Closing soon",
  new_this_week: "New this week",
  large_awards: "Large awards",
  esi_career: "ESI career",
  investigator_initiated: "Investigator-initiated",
  foundations: "Foundations",
  immunology_translational: "Immunology translational",
};

/** Default chip name when saving the current list filters. */
export function suggestSavedSearchName(state: FundingListClientState): string {
  if (state.q.trim()) {
    return state.q.trim().slice(0, 72);
  }
  const parts: string[] = [];
  if (state.tabs.length > 0) {
    for (const tab of state.tabs) {
      parts.push(TAB_LABELS[tab] ?? tab);
    }
  }
  if (state.departments.includes("hhs") && (state.departmentSubs.hhs ?? []).includes("nih")) {
    parts.push("NIH");
  } else if (state.departments.length > 0) {
    parts.push(state.departments.map((d) => d.toUpperCase()).join(", "));
  }
  if (state.scope === "open") parts.push("Open only");
  else if (state.scope === "forecasted") parts.push("Forecasted only");
  else if (state.scope === "closed") parts.push("Closed");
  return parts.length > 0 ? parts.join(" · ") : "My funding search";
}

const SCOPE_LABELS: Record<FundingListScope, string> = {
  all: "Open & forecasted",
  any: "All statuses",
  open: "Open only",
  forecasted: "Forecasted only",
  closed: "Closed",
};

const SUB_SHORT_LABELS: Record<string, string> = {
  nih: "NIH",
  cdc: "CDC",
  fda: "FDA",
  cms: "CMS",
  hrsa: "HRSA",
  samhsa: "SAMHSA",
  ahrq: "AHRQ",
  ihs: "IHS",
  acl: "ACL",
  aspe: "ASPE",
};

function departmentFilterSummary(state: FundingListClientState): string | null {
  if (
    state.noDepartmentsSelected &&
    state.departments.length === 0 &&
    Object.keys(state.departmentSubs).length === 0 &&
    state.legacyAgencies.length === 0
  ) {
    return "No departments";
  }

  if (
    state.allDepartments &&
    state.departments.length === 0 &&
    Object.keys(state.departmentSubs).length === 0 &&
    state.legacyAgencies.length === 0
  ) {
    return "All departments";
  }

  const deptParts: string[] = [];
  for (const deptId of state.departments) {
    const subs = state.departmentSubs[deptId] ?? [];
    if (subs.length === 0) {
      const dept = TOP_LEVEL_DEPARTMENTS.find((d) => d.id === deptId);
      deptParts.push(dept?.label.split(" ").slice(-1)[0] ?? deptId.toUpperCase());
      continue;
    }
    if (deptId === "hhs" && subs.length === 1 && subs[0] === "nih") {
      deptParts.push("NIH");
      continue;
    }
    for (const subId of subs) {
      deptParts.push(SUB_SHORT_LABELS[subId] ?? subId.toUpperCase());
    }
  }

  if (deptParts.length === 0 && state.legacyAgencies.length > 0) {
    return state.legacyAgencies.join(", ");
  }

  return deptParts.length > 0 ? deptParts.join(", ") : null;
}

/** Human-readable filter line for saved-search flyouts. */
export function formatSavedSearchFilterSummary(state: FundingListClientState): string {
  const parts: string[] = [];

  const dept = departmentFilterSummary(state);
  if (dept) parts.push(dept);

  parts.push(SCOPE_LABELS[state.scope] ?? SCOPE_LABELS.all);

  if (state.tabs.length > 0) {
    for (const tab of state.tabs) {
      parts.push(TAB_LABELS[tab] ?? tab);
    }
  }

  if (state.rd.activityFamilies.length > 0) {
    parts.push(...state.rd.activityFamilies);
  }

  if (state.rd.nihIc.length > 0) {
    parts.push(...state.rd.nihIc);
  }

  if (state.q.trim()) {
    parts.push(`Keyword: ${state.q.trim()}`);
  }

  if (state.sort !== "posted_date" || state.order !== "desc") {
    const sortLabels: Record<string, string> = {
      title: "Title",
      agency: "Agency",
      status: "Status",
      posted_date: "Posted date",
      close_date: "Close date",
      funding_instrument: "Instrument",
    };
    const sortLabel = sortLabels[state.sort] ?? state.sort;
    parts.push(`Sort: ${sortLabel} ${state.order === "asc" ? "↑" : "↓"}`);
  }

  if (state.perPage !== DEFAULT_FUNDING_LIST_PER_PAGE) {
    parts.push(`${state.perPage} per page`);
  }

  return parts.join(" · ");
}

/** True when the current list URL matches a saved search link. */
export function savedSearchMatchesCurrentState(
  current: FundingListClientState,
  savedHref: string
): boolean {
  const queryString = savedHref.includes("?") ? (savedHref.split("?")[1] ?? "") : "";
  const savedState = fundingListStateForBookmark(
    searchParamsToFundingListState(urlSearchParamsToRecord(new URLSearchParams(queryString)))
  );
  const bookmarked = fundingListStateForBookmark(current);
  return fundingListHref(savedState) === fundingListHref(bookmarked);
}
