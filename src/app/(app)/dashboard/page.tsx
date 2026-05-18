import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchFundingDashboard } from "@/lib/queries/dashboard";
import { formatDate } from "@/lib/formatting/dates";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function DashboardPage() {
  const supabase = createClient();
  let bundle: Awaited<ReturnType<typeof fetchFundingDashboard>> | null = null;
  let loadError: string | null = null;
  try {
    bundle = await fetchFundingDashboard(supabase);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dashboard";
  }

  return (
    <div className="space-y-8">
      <header>
        <div>
          <h1 className="app-page-title">Dashboard</h1>
          <p className="app-page-description">
            Funding opportunities from Simpler.Grants.gov and your investigator directory.
          </p>
        </div>
      </header>

      {loadError ? (
        <p className="text-sm text-red-600" role="alert">
          {loadError}
        </p>
      ) : null}

      {bundle ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="app-surface-card px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-ink-muted)]">
              Investigators
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--fo-title)]">
              {bundle.investigatorCount.toLocaleString()}
            </p>
            <Link
              href="/investigators"
              className="mt-2 inline-block text-xs font-medium text-[var(--fo-interaction)] hover:text-[var(--fo-title)] hover:underline"
            >
              Manage directory →
            </Link>
          </div>
        </div>
      ) : null}

      {bundle ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <QueueCard
            title="Recently posted"
            description="Newest sync rows by posted date."
            rows={bundle.recentFunding.map((o) => ({
              id: o.id,
              title: o.title,
              agency: o.agency,
              close: o.close_date,
              meta: o.status ?? "—",
            }))}
          />
          <QueueCard
            title="Closing soon (30 days)"
            description="Open-dated closes; excludes closed/archived status."
            rows={bundle.closingSoon.map((o) => ({
              id: o.id,
              title: o.title,
              agency: o.agency,
              close: o.close_date,
              meta: "",
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function QueueCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: {
    id: string;
    title: string;
    agency: string | null;
    close: string | null;
    meta: string;
  }[];
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState title="Nothing in this queue" />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--fo-divider)]">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 transition-colors hover:bg-[var(--fo-row-hover)]">
                <Link
                  href={`/funding-opportunities/${r.id}`}
                  className="block text-sm font-medium text-[var(--fo-title)] hover:text-[var(--fo-interaction)] hover:underline"
                >
                  {r.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fo-ink-muted)]">
                  <span>{r.agency ?? "—"}</span>
                  <span>Close {formatDate(r.close)}</span>
                  {r.meta ? (
                    <span className="text-[var(--fo-ink-body)]">{r.meta}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
