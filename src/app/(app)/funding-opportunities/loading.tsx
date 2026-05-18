/**
 * Shown while App Router loads the next server render after URL changes (filters, sort, search).
 */
export default function FundingOpportunitiesLoading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col animate-pulse">
      <header className="mb-12 pt-2">
        <div className="h-3 w-40 rounded bg-[var(--fo-border)]" />
        <div className="mt-6 h-12 max-w-xl rounded-lg bg-[var(--fo-border)] sm:h-14" />
        <div className="mt-5 h-4 max-w-2xl rounded bg-[var(--fo-border)]" />
        <div className="mt-2 h-4 max-w-xl rounded bg-[var(--fo-border)]" />
      </header>
      <div className="mb-10 h-24 max-w-3xl rounded-xl bg-[var(--fo-border)]/80" />
      <div className="flex min-h-0 flex-1 flex-col gap-10 md:flex-row md:items-start md:gap-8 lg:gap-10 xl:gap-12">
        <div className="order-2 min-h-[12rem] flex-1 rounded-xl bg-[var(--fo-border)]/70" />
        <div className="order-1 h-96 w-full shrink-0 rounded-xl bg-[var(--fo-border)]/60 md:w-[min(100%,17rem)]" />
      </div>
    </div>
  );
}
