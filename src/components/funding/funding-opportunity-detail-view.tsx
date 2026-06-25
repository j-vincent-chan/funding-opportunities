"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DismissFundingOpportunityButton } from "@/components/funding/dismiss-funding-opportunity-button";
import { ActivityFamilyPills } from "@/components/funding/activity-family-pills";
import { FundingApplicationMaterialsSection } from "@/components/funding/funding-application-materials-section";
import { FundingInstrumentPills } from "@/components/funding/funding-instrument-pills";
import { FundingOpportunityStatusPill } from "@/components/funding/funding-opportunity-status-pill";
import { FundingSourceLinkIconButton } from "@/components/funding/funding-source-link-icon-button";
import { ResearchFitTagPills } from "@/components/funding/research-fit-tag-pills";
import { formatDate } from "@/lib/formatting/dates";
import type { FundingOpportunityPeekData } from "@/lib/funding-opportunities/funding-opportunity-peek";
import type { DeadlineUrgency } from "@/lib/funding-opportunities/funding-opportunity-pi-brief";
import { openExternalFundingUrl } from "@/lib/funding-opportunities/source-url";

function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--fo-ink-body)]">{children}</dd>
    </div>
  );
}

function urgencyClass(urgency: DeadlineUrgency): string {
  if (urgency === "within_30") return "bg-red-50 text-red-800 ring-red-200";
  if (urgency === "within_60") return "bg-amber-50 text-amber-900 ring-amber-200";
  if (urgency === "within_90") return "bg-sky-50 text-sky-900 ring-sky-200";
  if (urgency === "closed") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-[var(--fo-paper-2)] text-[var(--fo-ink-body)] ring-[var(--fo-border)]";
}

function deadlineLabel(days: number | null, urgency: DeadlineUrgency): string {
  if (urgency === "closed") return "Closed";
  if (days == null) return "No close date listed";
  if (days < 0) return "Past deadline";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `${days} days to close`;
}

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function PiDecisionCard({ data }: { data: FundingOpportunityPeekData }) {
  const { piBrief } = data;
  const isForecasted = data.statusBucket === "forecasted";
  return (
    <section className="rounded-xl border border-[var(--fo-border)] bg-[#f8fbfc] p-4 ring-1 ring-[color-mix(in_srgb,var(--fo-brand)_8%,transparent)]">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-brand)]">
        Should I pursue this?
      </p>
      <ul className="mt-3 space-y-2">
        {piBrief.highlights.map((line) => (
          <li key={line} className="flex gap-2 text-sm leading-snug text-[var(--fo-ink-body)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fo-brand)]" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetaField label="Mechanism">{piBrief.mechanismLabel}</MetaField>
        <MetaField label="Award range">{piBrief.awardRangeLabel}</MetaField>
        <MetaField label="Deadline">
          {isForecasted ? (
            "—"
          ) : (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${urgencyClass(piBrief.deadlineUrgency)}`}
            >
              {deadlineLabel(piBrief.daysToClose, piBrief.deadlineUrgency)}
            </span>
          )}
        </MetaField>
        <MetaField label="Career stage">{piBrief.careerStageLabel}</MetaField>
        <MetaField label="Collaboration">{piBrief.collaborationLabel}</MetaField>
        <MetaField label="Clinical trials">{piBrief.clinicalTrialLabel}</MetaField>
        <MetaField label="Human subjects">{piBrief.humanSubjectsLabel}</MetaField>
        <MetaField label="Announcement">{piBrief.announcementLabel}</MetaField>
        {piBrief.nihInstitutes.length > 0 ? (
          <div className="sm:col-span-2">
            <MetaField label="NIH institute(s)">{piBrief.nihInstitutes.join(", ")}</MetaField>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function InvestigatorMatchesSection({ data }: { data: FundingOpportunityPeekData }) {
  if (data.investigatorMatches.length === 0) return null;
  return (
    <section className="mt-6 border-t border-[var(--fo-divider)] pt-5">
      <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
        Best watchlist fit
      </h3>
      <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">
        Investigators in your directory whose research profile overlaps this notice.
      </p>
      <ul className="mt-3 space-y-2">
        {data.investigatorMatches.map((match) => (
          <li key={match.investigatorId}>
            <Link
              href={`/investigators/${match.investigatorId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--fo-border)] bg-white px-3 py-2 transition-colors hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-row-hover)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--fo-title)]">
                  {match.fullName}
                </span>
                {match.department ? (
                  <span className="block truncate text-xs text-[var(--fo-ink-muted)]">{match.department}</span>
                ) : null}
              </span>
              <span className="shrink-0 rounded-full bg-[var(--fo-select-tint)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--fo-interaction)]">
                {match.matchScore}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SimilarAwardeesSection({ data }: { data: FundingOpportunityPeekData }) {
  return (
    <section className="mt-6 border-t border-[var(--fo-divider)] pt-5">
      <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
        Prior awardees in your watchlist
      </h3>
      <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">
        Investigators who have received a similar mechanism
        {data.piBrief.nihInstitutes.length > 0 ? " at a matching NIH institute" : ""} before.
      </p>
      {data.similarAwardees.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--fo-ink-muted)]">
          No matching prior awards found in cached RePORTER data. Refresh investigator grant caches or
          broaden mechanism filters.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.similarAwardees.map((awardee) => (
            <li key={`${awardee.investigatorId}-${awardee.projectNum}`}>
              <Link
                href={`/investigators/${awardee.investigatorId}`}
                className="block rounded-lg border border-[var(--fo-border)] bg-white px-3 py-2 transition-colors hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-row-hover)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--fo-title)]">{awardee.fullName}</span>
                    {awardee.department ? (
                      <span className="block text-xs text-[var(--fo-ink-muted)]">{awardee.department}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--fo-ink-muted)]">
                    FY {awardee.fiscalYear}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-[var(--fo-interaction)]">{awardee.projectNum}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--fo-ink-body)]">
                  {awardee.projectTitle}
                </p>
                {awardee.icName ? (
                  <p className="mt-1 text-[0.65rem] text-[var(--fo-ink-muted)]">{awardee.icName}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatUpdatedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDate(iso.slice(0, 10));
}

function KeyDatesEligibilitySection({ data }: { data: FundingOpportunityPeekData }) {
  const isForecasted = data.statusBucket === "forecasted";

  return (
    <section className="mt-6 border-t border-[var(--fo-divider)] pt-5">
      <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
        Key dates & eligibility
      </h3>
      {isForecasted ? (
        <p className="mt-1 text-xs text-[var(--fo-ink-muted)]">
          Dates are estimated for this forecasted notice and may change when it posts.
        </p>
      ) : null}
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {isForecasted ? (
          <>
            <MetaField label="Last Updated">{formatUpdatedDate(data.updatedAt)}</MetaField>
            <MetaField label="Estimated Open">{formatDate(data.estimatedOpenDate)}</MetaField>
            <MetaField label="Estimated Close">{formatDate(data.closeDate)}</MetaField>
          </>
        ) : (
          <>
            <MetaField label="Posted">{formatDate(data.postedDate)}</MetaField>
            <MetaField label="Close">{formatDate(data.closeDate)}</MetaField>
          </>
        )}
        <MetaField label="Instrument">
          <FundingInstrumentPills value={data.fundingInstrument} />
        </MetaField>
        <MetaField label="Activity family">
          <ActivityFamilyPills families={data.activityFamilies ?? undefined} />
        </MetaField>
        <MetaField label="Award ceiling">${formatCurrency(data.awardCeiling)}</MetaField>
        <MetaField label="Expected number of awards">
          {data.expectedNumberOfAwards != null
            ? data.expectedNumberOfAwards.toLocaleString()
            : "—"}
        </MetaField>
      </dl>
    </section>
  );
}

function DetailBody({ data }: { data: FundingOpportunityPeekData }) {
  return (
    <>
      <PiDecisionCard data={data} />

      <InvestigatorMatchesSection data={data} />

      <KeyDatesEligibilitySection data={data} />

      <section className="mt-6 border-t border-[var(--fo-divider)] pt-5">
        <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
          Summary
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fo-ink-body)]">
          {data.description.trim() ? data.description : "—"}
        </p>
      </section>

      <section className="mt-6 border-t border-[var(--fo-divider)] pt-5">
        <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
          Research fit tags
        </h3>
        <div className="mt-3">
          <ResearchFitTagPills tags={data.quickTags} />
        </div>
      </section>

      <FundingApplicationMaterialsSection materials={data.applicationMaterials} />

      {data.sourceUrl ? (
        <p className="mt-6">
          <button
            type="button"
            onClick={() => openExternalFundingUrl(data.sourceUrl!)}
            className="text-sm font-semibold text-[var(--fo-interaction)] hover:underline"
          >
            Full notice on agency site ↗
          </button>
        </p>
      ) : null}

      <SimilarAwardeesSection data={data} />
    </>
  );
}

function DetailActions({
  data,
  loggedIn,
  onDismissed,
  showFullPageLink,
}: {
  data: FundingOpportunityPeekData;
  loggedIn: boolean;
  onDismissed?: () => void;
  showFullPageLink?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/match/quick?q=${encodeURIComponent(data.title)}`}
        className="inline-flex items-center rounded-lg border border-[var(--fo-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
      >
        Match
      </Link>
      <Link
        href={`mailto:?subject=${encodeURIComponent(`Funding opportunity: ${data.title}`)}&body=${encodeURIComponent(`Review this opportunity: /funding-opportunities/${data.id}`)}`}
        className="inline-flex items-center rounded-lg border border-[var(--fo-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
      >
        Share
      </Link>
      {loggedIn ? (
        <DismissFundingOpportunityButton opportunityId={data.id} onDismissed={onDismissed} />
      ) : null}
      {showFullPageLink ? (
        <Link
          href={`/funding-opportunities/${data.id}`}
          className="inline-flex items-center rounded-lg border border-[var(--fo-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
        >
          Full page
        </Link>
      ) : null}
    </div>
  );
}

function DetailHeader({
  data,
  onClose,
  variant,
}: {
  data: FundingOpportunityPeekData;
  onClose?: () => void;
  variant: "peek" | "page";
}) {
  return (
    <header
      className={`shrink-0 border-b border-[var(--fo-border)] bg-white ${
        variant === "peek" ? "px-5 py-4" : "px-0 py-4"
      }`}
    >
      {variant === "page" ? (
        <Link
          href="/funding-opportunities"
          className="text-xs font-medium text-[var(--fo-ink-muted)] hover:text-[var(--fo-title)]"
        >
          ← Search
        </Link>
      ) : null}
      <div className={`flex items-start justify-between gap-3 ${variant === "page" ? "mt-2" : ""}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-interaction)]">
            PI grant brief
          </p>
          <h2
            className={`mt-1 font-semibold leading-snug tracking-tight text-[var(--fo-title)] [overflow-wrap:anywhere] ${
              variant === "page" ? "text-2xl" : "text-lg"
            }`}
          >
            {data.title}
          </h2>
          <p className="mt-2 text-sm font-medium text-[var(--fo-ink-body)]">
            {data.agency}
            {data.opportunityNumber ? (
              <>
                {" "}
                · <span className="tabular-nums">{data.opportunityNumber}</span>
              </>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FundingOpportunityStatusPill status={data.statusBucket} />
            {data.status && data.status !== data.statusBucket ? (
              <span className="text-xs font-medium text-[var(--fo-ink-muted)]">{data.status}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {data.sourceUrl ? (
            <FundingSourceLinkIconButton sourceUrl={data.sourceUrl} compact />
          ) : null}
          {variant === "peek" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              title="Close panel"
              aria-label="Close grant details"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--fo-border)] bg-white text-[var(--fo-ink-muted)] transition-colors hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-row-hover)] hover:text-[var(--fo-title)]"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function FundingOpportunityDetailView({
  data,
  loggedIn,
  variant,
  onClose,
  onDismissed,
}: {
  data: FundingOpportunityPeekData;
  loggedIn: boolean;
  variant: "peek" | "page";
  onClose?: () => void;
  onDismissed?: () => void;
}) {
  if (variant === "peek") {
    return (
      <>
        <DetailHeader data={data} onClose={onClose} variant="peek" />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-5 py-5">
          <DetailBody data={data} />
        </div>
        <footer className="shrink-0 border-t border-[var(--fo-border)] bg-[#eef2f7] px-5 py-4">
          <DetailActions
            data={data}
            loggedIn={loggedIn}
            onDismissed={onDismissed}
            showFullPageLink
          />
        </footer>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-8">
      <div className="rounded-xl border border-[var(--fo-border)] bg-white shadow-sm">
        <div className="px-5 sm:px-6">
          <DetailHeader data={data} variant="page" />
        </div>
        <div className="border-t border-[var(--fo-divider)] px-5 py-5 sm:px-6">
          <DetailBody data={data} />
        </div>
        <footer className="border-t border-[var(--fo-border)] bg-[#eef2f7] px-5 py-4 sm:px-6">
          <DetailActions data={data} loggedIn={loggedIn} onDismissed={onDismissed} />
        </footer>
      </div>
    </div>
  );
}
