"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_FUNDING_LIST_PAGE,
  FUNDING_LIST_PAGE_SIZES,
  fundingListHref,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
  type FundingListPageSize,
} from "@/lib/funding-opportunities/funding-list-url";
import { useFundingListNavigate } from "@/components/funding/use-funding-list-navigate";

export function FundingListPagination({
  totalFiltered,
  effectivePage,
  perPage,
  editorial = false,
}: {
  totalFiltered: number;
  effectivePage: number;
  perPage: number;
  editorial?: boolean;
}) {
  const sp = useSearchParams();
  const { navigate } = useFundingListNavigate();

  const state = useMemo(() => {
    return searchParamsToFundingListState(urlSearchParamsToRecord(new URLSearchParams(sp.toString())));
  }, [sp]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const start = totalFiltered === 0 ? 0 : (effectivePage - 1) * perPage + 1;
  const end = Math.min(effectivePage * perPage, totalFiltered);

  const prevHref = fundingListHref({
    ...state,
    page: Math.max(DEFAULT_FUNDING_LIST_PAGE, effectivePage - 1),
  });
  const nextHref = fundingListHref({
    ...state,
    page: Math.min(totalPages, effectivePage + 1),
  });

  const navBtn = editorial
    ? "inline-flex min-h-[2.25rem] items-center justify-center rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 text-sm font-medium text-[var(--fo-title)] shadow-soft transition-colors hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-paper-2)] hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-40"
    : "inline-flex min-h-[2.25rem] items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  const selectCls = editorial ? "fo-filter-input !mt-0 w-[4.5rem] py-2 text-sm" : "rounded-md border border-slate-300 px-2 py-1.5 text-sm";

  const meta = editorial
    ? "text-sm font-medium text-[var(--fo-ink-body)]"
    : "text-sm text-slate-600";

  return (
    <div
      className={
        editorial
          ? "flex flex-col gap-4 border-t border-[var(--fo-divider)] bg-[var(--fo-paper-2)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <p className={meta}>
        <span className="tabular-nums">
          {totalFiltered === 0 ? "No results" : `Showing ${start}–${end} of ${totalFiltered}`}
        </span>
        {totalFiltered > 0 ? (
          <span className={editorial ? "text-[var(--fo-ink-muted)]" : "text-slate-500"}>
            {" "}
            · Page{" "}
            <span className="tabular-nums font-semibold text-[var(--fo-title)]">
              {effectivePage}
            </span>{" "}
            of{" "}
            <span className="tabular-nums font-semibold text-[var(--fo-title)]">{totalPages}</span>
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className={editorial ? "flex items-center gap-2 text-sm font-medium text-[var(--fo-ink-body)]" : "flex items-center gap-2 text-sm text-slate-700"}>
          <span className="whitespace-nowrap">Per page</span>
          <select
            value={perPage}
            onChange={(e) => {
              const next = Number(e.target.value) as FundingListPageSize;
              navigate({ perPage: next, page: DEFAULT_FUNDING_LIST_PAGE });
            }}
            className={selectCls}
            aria-label="Results per page"
          >
            {FUNDING_LIST_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          {effectivePage <= DEFAULT_FUNDING_LIST_PAGE ? (
            <span className={`${navBtn} pointer-events-none opacity-40`} aria-disabled>
              Previous
            </span>
          ) : (
            <Link href={prevHref} className={navBtn} prefetch={false}>
              Previous
            </Link>
          )}
          {effectivePage >= totalPages ? (
            <span className={`${navBtn} pointer-events-none opacity-40`} aria-disabled>
              Next
            </span>
          ) : (
            <Link href={nextHref} className={navBtn} prefetch={false}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
