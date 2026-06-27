import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function FundingOpportunitiesLoading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col">
      <header className="mb-8 pt-2">
        <div className="h-3 w-16 animate-pulse rounded bg-[var(--fo-border)]" />
        <div className="mt-3 h-10 w-72 max-w-full animate-pulse rounded-lg bg-[var(--fo-border)]" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-[var(--fo-border)]" />
      </header>
      <PageLoadingState message="Updating results…" className="min-h-[12rem] rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)]" />
    </div>
  );
}
