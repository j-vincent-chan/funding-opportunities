import type { DepartmentSubsSelection } from "@/lib/funding-opportunities/agency-filter";
import { isKnownDepartmentId } from "@/lib/funding-opportunities/agency-taxonomy";
import { isKnownDepartmentSubId } from "@/lib/funding-opportunities/department-subcomponents";
import type { SearchParams } from "@/lib/funding-opportunities/rd-list-filters";
import {
  appendRdListFiltersToUrlSearchParams,
  parseRdListFilters,
  type RdListFilterState,
} from "@/lib/funding-opportunities/rd-list-filters";

export type FundingListScope = "any" | "all" | "open" | "forecasted" | "closed";

/** Allowed results-per-page values for the funding list. */
export const FUNDING_LIST_PAGE_SIZES = [50, 100, 250, 500, 1000] as const;
export type FundingListPageSize = (typeof FUNDING_LIST_PAGE_SIZES)[number];

export const DEFAULT_FUNDING_LIST_PAGE = 1;
export const DEFAULT_FUNDING_LIST_PER_PAGE = 100;

export type FundingListSortKey =
  | "title"
  | "agency"
  | "status"
  | "posted_date"
  | "close_date"
  | "funding_instrument";

export type FundingListClientState = {
  q: string;
  scope: FundingListScope;
  sort: string;
  order: "asc" | "desc";
  /** 1-based page index (URL `page`). */
  page: number;
  /** Rows per page (URL `per`). */
  perPage: number;
  /** Cabinet / department slugs, e.g. `hhs`, `dol`. */
  departments: string[];
  /** Selected sub-agency ids per department, e.g. `{ hhs: ["nih"], dol: ["osha"] }`. URL `sub=dept:subId`. */
  departmentSubs: DepartmentSubsSelection;
  /** Legacy `?agency=` tokens; used only when no department filters are present. */
  legacyAgencies: string[];
  rd: RdListFilterState;
};

export function urlSearchParamsToRecord(sp: URLSearchParams): SearchParams {
  const out: SearchParams = {};
  const keys = Array.from(new Set(Array.from(sp.keys())));
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]!;
    const all = sp.getAll(key);
    if (all.length === 0) continue;
    out[key] = all.length === 1 ? all[0]! : all;
  }
  return out;
}

export function firstStringParam(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const x = v.find((i) => typeof i === "string" && i.length > 0);
    return typeof x === "string" ? x : "";
  }
  return "";
}

export function agenciesFromSearchParams(searchParams: SearchParams): string[] {
  const raw = searchParams.agency;
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string" || !item.trim()) continue;
    out.push(item.trim());
  }
  return Array.from(new Set(out));
}

export function departmentsFromSearchParams(searchParams: SearchParams): string[] {
  const raw = searchParams.dept;
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string" || !item.trim()) continue;
    const id = item.trim();
    if (isKnownDepartmentId(id)) out.push(id);
  }
  return Array.from(new Set(out));
}

function mergeDepartmentSubs(
  dest: DepartmentSubsSelection,
  deptId: string,
  subIds: string[]
): void {
  if (subIds.length === 0) return;
  const cur = dest[deptId] ?? [];
  dest[deptId] = Array.from(new Set([...cur, ...subIds]));
}

/** Legacy `?hhs=` tokens merged into `departmentSubs.hhs`. */
function legacyHhsFromSearchParams(searchParams: SearchParams): string[] {
  const raw = searchParams.hhs;
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string" || !item.trim()) continue;
    const id = item.trim();
    if (isKnownDepartmentSubId("hhs", id)) out.push(id);
  }
  return Array.from(new Set(out));
}

/** Parse `sub=dept:subId` and legacy `hhs=` into a department → sub-ids map. */
export function departmentSubsFromSearchParams(searchParams: SearchParams): DepartmentSubsSelection {
  const out: DepartmentSubsSelection = {};
  const rawSub = searchParams.sub;
  const subList = rawSub === undefined ? [] : Array.isArray(rawSub) ? rawSub : [rawSub];
  for (const item of subList) {
    if (typeof item !== "string" || !item.trim()) continue;
    const colon = item.indexOf(":");
    if (colon <= 0) continue;
    const dept = item.slice(0, colon).trim();
    const sid = item.slice(colon + 1).trim();
    if (!dept || !sid || !isKnownDepartmentId(dept)) continue;
    if (!isKnownDepartmentSubId(dept, sid)) continue;
    mergeDepartmentSubs(out, dept, [sid]);
  }
  const legacy = legacyHhsFromSearchParams(searchParams);
  if (legacy.length > 0) mergeDepartmentSubs(out, "hhs", legacy);
  return out;
}

export function isDepartmentSubsEmpty(subs: DepartmentSubsSelection | undefined): boolean {
  if (!subs) return true;
  for (const v of Object.values(subs)) {
    if (v && v.length > 0) return false;
  }
  return true;
}

export function parseFundingListPagination(searchParams: SearchParams): {
  page: number;
  perPage: FundingListPageSize;
} {
  const rawPage = typeof searchParams.page === "string" ? searchParams.page.trim() : "";
  const rawPer = typeof searchParams.per === "string" ? searchParams.per.trim() : "";
  let page = parseInt(rawPage, 10);
  if (!Number.isFinite(page) || page < 1) page = DEFAULT_FUNDING_LIST_PAGE;
  const perNum = parseInt(rawPer, 10);
  const allowed = FUNDING_LIST_PAGE_SIZES as readonly number[];
  const perPage = allowed.includes(perNum) ? (perNum as FundingListPageSize) : DEFAULT_FUNDING_LIST_PER_PAGE;
  return { page, perPage };
}

export function resolveListScope(searchParams: SearchParams): FundingListScope {
  const raw = typeof searchParams.scope === "string" ? searchParams.scope : "";
  if (raw === "any" || raw === "all" || raw === "open" || raw === "forecasted" || raw === "closed") {
    return raw;
  }
  if (typeof searchParams.active === "string" && searchParams.active === "0") return "closed";
  return "all";
}

export function defaultSortDirForKey(key: FundingListSortKey): "asc" | "desc" {
  if (key === "posted_date") return "desc";
  return "asc";
}

export function parseListSort(searchParams: SearchParams): {
  key: FundingListSortKey;
  dir: "asc" | "desc";
} {
  const raw = typeof searchParams.sort === "string" ? searchParams.sort.trim() : "";
  const orderRaw = typeof searchParams.order === "string" ? searchParams.order.trim() : "";

  const legacy: Record<string, { key: FundingListSortKey; dir: "asc" | "desc" }> = {
    close_date: { key: "close_date", dir: "asc" },
    posted_date: { key: "posted_date", dir: "desc" },
  };

  const keyAliases: Record<string, FundingListSortKey> = {
    close_date: "close_date",
    posted_date: "posted_date",
    title: "title",
    agency: "agency",
    status: "status",
    funding_instrument: "funding_instrument",
    instrument: "funding_instrument",
  };

  const key = keyAliases[raw] ?? "posted_date";
  const order = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : null;

  if (order) {
    return { key, dir: order };
  }
  if (raw && legacy[raw]) {
    return legacy[raw];
  }
  return { key, dir: defaultSortDirForKey(key) };
}

export function sortParamForKey(key: FundingListSortKey): string {
  return key;
}

export function nextColumnSort(
  column: FundingListSortKey,
  current: { key: FundingListSortKey; dir: "asc" | "desc" }
): { sort: string; order: "asc" | "desc" } {
  if (current.key === column) {
    return { sort: sortParamForKey(column), order: current.dir === "asc" ? "desc" : "asc" };
  }
  return { sort: sortParamForKey(column), order: defaultSortDirForKey(column) };
}

export function searchParamsToFundingListState(searchParams: SearchParams): FundingListClientState {
  const sort = parseListSort(searchParams);
  const { page, perPage } = parseFundingListPagination(searchParams);
  return {
    q: firstStringParam(searchParams.q),
    scope: resolveListScope(searchParams),
    sort: sortParamForKey(sort.key),
    order: sort.dir,
    page,
    perPage,
    departments: departmentsFromSearchParams(searchParams),
    departmentSubs: departmentSubsFromSearchParams(searchParams),
    legacyAgencies: agenciesFromSearchParams(searchParams),
    rd: parseRdListFilters(searchParams),
  };
}

export function fundingListHref(state: FundingListClientState): string {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q.trim());
  p.set("scope", state.scope);
  p.set("sort", state.sort);
  p.set("order", state.order);
  if (state.page > DEFAULT_FUNDING_LIST_PAGE) p.set("page", String(state.page));
  if (state.perPage !== DEFAULT_FUNDING_LIST_PER_PAGE) p.set("per", String(state.perPage));
  for (const d of state.departments) {
    p.append("dept", d);
  }
  for (const [dept, subs] of Object.entries(state.departmentSubs)) {
    if (!subs || subs.length === 0) continue;
    for (const sid of subs) {
      p.append("sub", `${dept}:${sid}`);
    }
  }
  for (const a of state.legacyAgencies) {
    p.append("agency", a);
  }
  appendRdListFiltersToUrlSearchParams(p, state.rd);
  const s = p.toString();
  return s ? `/funding-opportunities?${s}` : "/funding-opportunities";
}

export function fundingListHrefWithSortOverride(
  searchParams: SearchParams,
  sort: string,
  order: "asc" | "desc"
): string {
  const base = searchParamsToFundingListState(searchParams);
  return fundingListHref({ ...base, sort, order, page: DEFAULT_FUNDING_LIST_PAGE });
}
