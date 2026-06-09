"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_FUNDING_LIST_PAGE,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
} from "@/lib/funding-opportunities/funding-list-url";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { useFundingListNavigate } from "@/components/funding/use-funding-list-navigate";

function FundingListKeywordSearchInner({ editorial }: { editorial: boolean }) {
  const sp = useSearchParams();
  const { navigate } = useFundingListNavigate();

  const record = useMemo(() => urlSearchParamsToRecord(new URLSearchParams(sp.toString())), [sp]);
  const state = useMemo(() => searchParamsToFundingListState(record), [record]);

  const [qDraft, setQDraft] = useState(state.q);
  useEffect(() => {
    setQDraft(state.q);
  }, [state.q]);

  const qDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushQ = useCallback(
    (value: string) => {
      if (qDebounce.current) clearTimeout(qDebounce.current);
      qDebounce.current = setTimeout(() => {
        navigate({ q: value, page: DEFAULT_FUNDING_LIST_PAGE });
      }, 400);
    },
    [navigate]
  );

  useEffect(() => {
    return () => {
      if (qDebounce.current) clearTimeout(qDebounce.current);
    };
  }, []);

  const shell = editorial
    ? "fo-search"
    : "rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5";

  const labelCls = editorial
    ? "block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-inherit"
    : "block text-sm font-semibold text-slate-900";

  const hintCls = editorial
    ? "mt-1.5 text-sm font-medium leading-relaxed text-inherit opacity-90"
    : "mt-1 text-sm text-slate-600";

  const inputCls = editorial
    ? "mt-0 block w-full rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-4 py-3.5 text-[1.05rem] font-medium leading-snug text-[var(--fo-ink)] shadow-sm placeholder:text-[var(--fo-ink-faint)] transition-[border-color,box-shadow] hover:border-[var(--fo-line-hover)] focus:border-[var(--fo-focus-border)] focus:outline-none focus:ring-[3px] focus:ring-[var(--fo-focus-ring)] sm:py-4 sm:text-lg"
    : "mt-3 block w-full rounded-lg border-2 border-slate-200 bg-slate-50/50 px-4 py-3.5 text-base text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25 sm:py-4 sm:text-lg";

  if (editorial) {
    return (
      <div className={shell}>
        <div className="fo-search-head">
          <label htmlFor="funding-list-q" className={labelCls}>
            Search the funding database
          </label>
          <p className={hintCls}>
            Use this for title, keyword, opportunity number, agency, mechanism, or topic.
          </p>
        </div>
        <div className="fo-search-field">
          <input
            id="funding-list-q"
            type="search"
            value={qDraft}
            onChange={(e) => {
              const v = e.target.value;
              setQDraft(v);
              flushQ(v);
            }}
            onBlur={() => {
              if (qDebounce.current) clearTimeout(qDebounce.current);
              navigate({ q: qDraft, page: DEFAULT_FUNDING_LIST_PAGE });
            }}
            placeholder="Search by title, keyword, mechanism, opportunity number, or agency…"
            maxLength={200}
            className={inputCls}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <label htmlFor="funding-list-q" className={labelCls}>
        Search the funding database
      </label>
      <p className={hintCls}>
        Use this for title, keyword, opportunity number, agency, mechanism, or topic.
      </p>
      <input
        id="funding-list-q"
        type="search"
        value={qDraft}
        onChange={(e) => {
          const v = e.target.value;
          setQDraft(v);
          flushQ(v);
        }}
        onBlur={() => {
          if (qDebounce.current) clearTimeout(qDebounce.current);
          navigate({ q: qDraft, page: DEFAULT_FUNDING_LIST_PAGE });
        }}
        placeholder="Search by title, keyword, mechanism, opportunity number, or agency…"
        maxLength={200}
        className={inputCls}
      />
    </div>
  );
}

export function FundingListKeywordSearch({ editorial = false }: { editorial?: boolean }) {
  return (
    <Suspense
      fallback={<PageLoadingState message="Loading search…" compact />}
    >
      <FundingListKeywordSearchInner editorial={editorial} />
    </Suspense>
  );
}
