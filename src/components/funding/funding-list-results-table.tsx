"use client";

import Link from "next/link";
import { useState } from "react";
import { ActivityFamilyPills } from "@/components/funding/activity-family-pills";
import { FundingInstrumentPills } from "@/components/funding/funding-instrument-pills";
import { FundingListRowActions } from "@/components/funding/funding-list-row-actions";
import { FundingOpportunityPeekLink } from "@/components/funding/funding-opportunity-peek-panel";
import { FundingOpportunityStatusPill } from "@/components/funding/funding-opportunity-status-pill";
import { formatDate } from "@/lib/formatting/dates";
import type { FundingListRowBucket } from "@/lib/funding-opportunities/funding-list-row-scope";
import type { FundingListSortKey } from "@/lib/funding-opportunities/funding-list-url";

export type FundingListResultsRow = {
  id: string;
  title: string;
  agencyDisplay: string;
  statusBucket: FundingListRowBucket;
  postedDate: string | null;
  estimatedOpenDate: string | null;
  updatedAt: string | null;
  closeDate: string | null;
  closeDateLabel: string;
  closingUrgency: 30 | 60 | 90 | null;
  fundingInstrument: string | null;
  activityFamilies: string[] | null;
  sourceUrl: string | null;
  isMatched: boolean;
};

type SortState = { key: FundingListSortKey; dir: "asc" | "desc" };

function SortHeaderLink({
  label,
  column,
  current,
  href,
  nowrap = false,
}: {
  label: string;
  column: FundingListSortKey;
  current: SortState;
  href: string;
  nowrap?: boolean;
}) {
  const active = current.key === column;
  return (
    <th
      scope="col"
      className={`px-5 py-4 pb-3 text-left align-bottom ${nowrap ? "whitespace-nowrap" : ""}`}
    >
      <Link
        href={href}
        title="Sort by this column; click again to reverse"
        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] transition-colors ${
          active
            ? "border-b-2 border-[var(--fo-accent)] text-[var(--fo-title)]"
            : "border-b-2 border-transparent text-[var(--fo-ink-muted)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-interaction)]"
        } hover:bg-black/[0.03]`}
      >
        {label}
        {active ? (
          <span className="font-semibold text-[var(--fo-accent)] tabular-nums" aria-hidden>
            {current.dir === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </Link>
    </th>
  );
}

function closingUrgencyClass(days: 30 | 60 | 90 | null): string {
  if (days === 30) return "text-red-700";
  if (days === 60) return "text-amber-800";
  if (days === 90) return "text-sky-800";
  return "";
}

function formatUpdatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  return formatDate(day);
}

/** Label + value stack for table date columns (matches peek panel MetaField rhythm). */
function TableDateStack({
  items,
}: {
  items: Array<{ label: string; value: string; highlight?: boolean }>;
}) {
  return (
    <dl className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--fo-ink-muted)]">
            {item.label}
          </dt>
          <dd
            className={`mt-0.5 tabular-nums leading-snug ${
              item.highlight
                ? "text-sm font-semibold text-[var(--fo-title)]"
                : "text-sm font-medium text-[var(--fo-ink-body)]"
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ForecastedOpenHint({ date }: { date: string | null }) {
  return (
    <div className="rounded-lg border border-[color-mix(in_srgb,var(--fo-warn-border)_45%,transparent)] bg-[color-mix(in_srgb,var(--fo-warn-bg)_38%,var(--fo-paper))] px-2.5 py-2">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--fo-warn-text)]">
        Est. open
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums leading-snug text-[var(--fo-title)]">
        {formatDate(date)}
      </p>
    </div>
  );
}

export function FundingListResultsTable({
  rows,
  loggedIn,
  listIncludesActivityFamilies,
  sortState,
  sortHrefs,
}: {
  rows: FundingListResultsRow[];
  loggedIn: boolean;
  listIncludesActivityFamilies: boolean;
  sortState: SortState;
  sortHrefs: Record<FundingListSortKey, string>;
}) {
  const [showOptionalColumns, setShowOptionalColumns] = useState(false);

  const showInstrument = showOptionalColumns;
  const showActivity = showOptionalColumns && listIncludesActivityFamilies;

  return (
    <div className="overflow-x-auto">
      <table className="fo-funding-results-table min-w-full table-fixed text-left">
        <colgroup>
          <col className={showOptionalColumns ? "w-[28%]" : "w-[40%]"} />
          <col className="w-[15%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          {showInstrument ? <col className="w-[12%]" /> : null}
          {showActivity ? <col className="w-[12%]" /> : null}
          <col className="w-[140px] min-w-[140px] max-w-[140px]" />
        </colgroup>
        <thead className="fo-funding-results-thead">
          <tr>
            <SortHeaderLink label="Title" column="title" current={sortState} href={sortHrefs.title} />
            <SortHeaderLink label="Agency" column="agency" current={sortState} href={sortHrefs.agency} />
            <SortHeaderLink label="Status" column="status" current={sortState} href={sortHrefs.status} />
            <SortHeaderLink
              label="Posted"
              column="posted_date"
              current={sortState}
              href={sortHrefs.posted_date}
              nowrap
            />
            <SortHeaderLink
              label="Close"
              column="close_date"
              current={sortState}
              href={sortHrefs.close_date}
              nowrap
            />
            {showInstrument ? (
              <SortHeaderLink
                label="Instrument"
                column="funding_instrument"
                current={sortState}
                href={sortHrefs.funding_instrument}
              />
            ) : null}
            {showActivity ? (
              <th
                scope="col"
                className="px-5 py-4 pb-3 text-left text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-table-head-fg)]"
              >
                Activity family
              </th>
            ) : null}
            <th
              scope="col"
              className="w-[140px] min-w-[140px] max-w-[140px] px-3 py-4 pb-3 text-right text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-table-head-fg)]"
            >
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOptionalColumns((v) => !v)}
                  className="rounded-md border border-[var(--fo-border)] bg-white px-2 py-0.5 text-[0.62rem] font-semibold normal-case tracking-normal text-[var(--fo-ink-muted)] transition-colors hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
                  aria-pressed={showOptionalColumns}
                  aria-label={showOptionalColumns ? "Collapse columns" : "Expand columns"}
                >
                  {showOptionalColumns ? "Collapse Columns" : "Expand Columns"}
                </button>
                <span className="sr-only">Actions</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
              <tr
                key={row.id}
                className={`fo-funding-results-row group border-b transition-colors last:border-b-0 hover:bg-[var(--fo-row-hover)] ${
                  row.statusBucket === "forecasted" ? "fo-row-forecasted" : ""
                }`}
              >
                <td className="min-w-0 max-w-[min(100%,22rem)] px-5 py-5 align-top sm:max-w-[min(100%,28rem)] lg:max-w-[min(100%,36rem)] xl:max-w-none xl:min-w-[12rem]">
                  <FundingOpportunityPeekLink
                    opportunityId={row.id}
                    title={row.title}
                    className="block text-[1.02rem] font-semibold leading-snug tracking-tight text-[var(--fo-title)] underline-offset-[6px] [overflow-wrap:anywhere] hover:text-[var(--fo-interaction)] hover:underline"
                  >
                    {row.title}
                  </FundingOpportunityPeekLink>
                </td>
                <td className="px-5 py-5 align-top text-sm font-medium leading-snug text-[var(--fo-ink-body)]">
                  {row.agencyDisplay}
                </td>
                <td className="min-w-[8.5rem] px-5 py-5 align-top">
                  <div className="flex flex-col gap-2.5">
                    <FundingOpportunityStatusPill status={row.statusBucket} size="lg" />
                    {row.statusBucket === "forecasted" ? (
                      <ForecastedOpenHint date={row.estimatedOpenDate} />
                    ) : null}
                  </div>
                </td>
                <td className="min-w-[7.5rem] px-5 py-5 align-top">
                  <TableDateStack
                    items={
                      row.statusBucket === "forecasted"
                        ? [
                            {
                              label: "Last updated",
                              value: formatUpdatedDate(row.updatedAt),
                              highlight: row.updatedAt != null,
                            },
                          ]
                        : [
                            {
                              label: "Posted",
                              value: formatDate(row.postedDate),
                              highlight: row.postedDate != null,
                            },
                          ]
                    }
                  />
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-5 align-top tabular-nums text-sm font-medium text-[var(--fo-ink-muted)] ${closingUrgencyClass(row.closingUrgency)}`}
                  title={
                    row.closingUrgency
                      ? `Closing within ${row.closingUrgency} days`
                      : undefined
                  }
                >
                  {row.closeDateLabel}
                </td>
                {showInstrument ? (
                  <td className="px-5 py-5 align-top text-sm font-medium text-[var(--fo-ink-body)]">
                    <FundingInstrumentPills value={row.fundingInstrument} />
                  </td>
                ) : null}
                {showActivity ? (
                  <td className="px-5 py-5 align-top text-sm font-medium text-[var(--fo-ink-body)]">
                    <ActivityFamilyPills families={row.activityFamilies ?? undefined} />
                  </td>
                ) : null}
                <td className="w-[140px] min-w-[140px] max-w-[140px] px-3 py-5 align-middle">
                  <FundingListRowActions
                    opportunityId={row.id}
                    title={row.title}
                    sourceUrl={row.sourceUrl}
                    isMatched={row.isMatched}
                    loggedIn={loggedIn}
                  />
                </td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
