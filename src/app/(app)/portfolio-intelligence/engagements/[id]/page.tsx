import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateStrategistEngagementFormAction } from "@/app/actions/community-intelligence";

export const dynamic = "force-dynamic";

export default async function EditEngagementPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: e, error } = await supabase
    .from("strategist_engagements")
    .select(
      "id, status, notes, next_step, next_step_due_date, last_contact_date, outcome, investigator_id, opportunity_id, investigators(full_name), funding_opportunities(title)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !e) notFound();

  type Inv = { full_name?: string };
  const inv = e.investigators as Inv | Inv[] | null | undefined;
  const invName = Array.isArray(inv) ? inv[0]?.full_name : inv?.full_name;

  return (
    <div className="space-y-6">
      <Link
        href="/portfolio-intelligence/engagements"
        className="text-xs font-medium text-[var(--fo-ink-muted)] hover:text-[var(--fo-title)]"
      >
        ← Engagements
      </Link>
      <header>
        <h1 className="mt-2 app-page-title">Edit engagement</h1>
        <p className="app-page-description">
          {invName ? (
            <Link
              href={`/investigators/${e.investigator_id}`}
              className="text-[var(--accent)] underline"
            >
              {invName}
            </Link>
          ) : (
            "Investigator"
          )}
        </p>
      </header>

      <Card>
        <CardHeader title="Update" />
        <CardBody>
          <form action={updateStrategistEngagementFormAction} className="grid max-w-xl gap-3">
            <input type="hidden" name="engagementId" value={e.id} />
            <label className="text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                name="status"
                defaultValue={e.status}
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
            <label className="text-sm">
              <span className="font-medium text-slate-700">Last contact date</span>
              <input
                type="date"
                name="lastContactDate"
                defaultValue={e.last_contact_date ?? ""}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Next step due</span>
              <input
                type="date"
                name="nextStepDueDate"
                defaultValue={e.next_step_due_date ?? ""}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Next step</span>
              <textarea
                name="nextStep"
                rows={2}
                defaultValue={e.next_step ?? ""}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Notes</span>
              <textarea
                name="notes"
                rows={4}
                defaultValue={e.notes ?? ""}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Outcome</span>
              <textarea
                name="outcome"
                rows={2}
                defaultValue={e.outcome ?? ""}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
