import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatting/dates";
import { createStrategistEngagementFormAction } from "@/app/actions/community-intelligence";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function StrategistEngagementsPage() {
  const supabase = createClient();

  const [{ data: engagements, error }, { data: invs }] = await Promise.all([
    supabase
      .from("strategist_engagements")
      .select(
        "id, status, engagement_type, date_opened, last_contact_date, next_step_due_date, next_step, notes, investigator_id, opportunity_id, investigators(full_name), funding_opportunities(title)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("investigators").select("id, full_name").order("full_name").limit(800),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/portfolio-intelligence"
          className="text-xs font-medium text-[var(--fo-ink-muted)] hover:text-[var(--fo-title)]"
        >
          ← Portfolio Intelligence
        </Link>
        <h1 className="mt-2 app-page-title">Strategist engagements</h1>
        <p className="app-page-description">
          Operational tracking for outreach. Link investigators to funding opportunities where
          relevant.
        </p>
      </header>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}

      <Card>
        <CardHeader title="New engagement" />
        <CardBody>
          <form action={createStrategistEngagementFormAction} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-slate-700">Investigator</span>
              <select
                name="investigatorId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Select…</option>
                {(invs ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                name="status"
                defaultValue="identified"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {[
                  "identified",
                  "matched",
                  "contacted",
                  "engaged",
                  "drafting",
                  "internal_review",
                  "submitted",
                  "funded",
                  "declined",
                  "dormant",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Type</span>
              <input
                name="engagementType"
                defaultValue="outreach"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">
                Funding opportunity ID (optional, UUID)
              </span>
              <input
                name="opportunityId"
                placeholder="funding_opportunities.id"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Notes</span>
              <textarea
                name="notes"
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary">
                Create engagement
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="All engagements" description="Sorted by next step due date when set." />
        <CardBody>
          {(engagements ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No engagements yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-2">Investigator</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Opportunity</th>
                    <th className="py-2 pr-2">Next step due</th>
                    <th className="py-2 pr-2">Notes</th>
                    <th className="py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {(engagements ?? []).map((e) => {
                    type Inv = { full_name?: string };
                    type Fo = { title?: string };
                    const inv = e.investigators as Inv | Inv[] | null | undefined;
                    const name = Array.isArray(inv) ? inv[0]?.full_name : inv?.full_name;
                    const fo = e.funding_opportunities as Fo | Fo[] | null | undefined;
                    const title = Array.isArray(fo) ? fo[0]?.title : fo?.title;
                    return (
                      <tr key={e.id} className="border-b border-slate-100">
                        <td className="py-2 pr-2">
                          <Link
                            href={`/investigators/${e.investigator_id}`}
                            className="font-medium text-[var(--accent)] hover:underline"
                          >
                            {name ?? "—"}
                          </Link>
                        </td>
                        <td className="py-2 pr-2">
                          <Badge tone="neutral">{e.status}</Badge>
                        </td>
                        <td className="py-2 pr-2 text-slate-700">
                          {e.opportunity_id && title ? (
                            <Link
                              href={`/funding-opportunities/${e.opportunity_id}`}
                              className="text-[var(--accent)] hover:underline"
                            >
                              {title}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatDate(e.next_step_due_date ?? null)}
                        </td>
                        <td className="max-w-[200px] truncate py-2 pr-2 text-slate-600">
                          {e.notes ?? "—"}
                        </td>
                        <td className="py-2">
                          <Link
                            href={`/portfolio-intelligence/engagements/${e.id}`}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
