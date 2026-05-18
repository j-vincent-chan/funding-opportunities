import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InvestigatorCsvForm } from "@/components/investigators/investigator-csv-form";
import { InvestigatorResearchCommunitySelect } from "@/components/investigators/investigator-research-community-select";
import { Button } from "@/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function InvestigatorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const tag =
    typeof searchParams.tag === "string" ? searchParams.tag.trim() : "";

  const supabase = createClient();

  let invQuery = supabase
    .from("investigators")
    .select(
      "id, full_name, email, home_department, division, nih_profile_id, research_community_id, pipeline_communities(id, label), investigator_profile_features(science_tags, disease_tags)"
    )
    .order("full_name", { ascending: true })
    .limit(200);

  if (q) {
    invQuery = invQuery.ilike("full_name", `%${q}%`);
  }

  const [{ data: communityRows }, { data: rows, error }] = await Promise.all([
    supabase.from("pipeline_communities").select("id, label").order("sort_order", { ascending: true }),
    invQuery,
  ]);
  const researchCommunities = (communityRows ?? []) as { id: string; label: string }[];

  const filtered = (rows ?? []).filter((r) => {
    if (!tag) return true;
    const f = r.investigator_profile_features as
      | { science_tags?: string[]; disease_tags?: string[] }
      | null
      | undefined;
    const tags = [...(f?.science_tags ?? []), ...(f?.disease_tags ?? [])];
    return tags.includes(tag);
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="app-page-title">Investigators</h1>
        <p className="app-page-description">
          PI profiles, normalized tags, and deterministic NIH opportunity matches.
        </p>
      </header>

      <Card>
        <CardHeader title="Import PIs" description="CSV columns: first_name, last_name, email, home_department, division, rank, affiliations, primary_research_area, …" />
        <CardBody>
          <InvestigatorCsvForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Search & filters" />
        <CardBody>
          <form className="flex flex-wrap gap-3" method="get">
            <label className="text-xs font-medium text-[var(--fo-ink-muted)]">
              Name contains
              <input
                name="q"
                defaultValue={q}
                className="mt-1 block w-56 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--fo-ink-muted)]">
              Has science/disease tag
              <input
                name="tag"
                defaultValue={tag}
                placeholder="e.g. tumor_immunology"
                className="mt-1 block w-56 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary">
                Apply
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No investigators"
          description="Import a CSV to create investigator rows and normalized features."
        />
      ) : (
        <Card>
          <CardHeader title={`Directory (${filtered.length})`} />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b-2 border-[var(--fo-table-edge)] bg-[var(--fo-table-head)] text-xs uppercase text-[var(--fo-table-head-fg)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Department</th>
                    <th className="px-4 py-2 font-medium">Research community</th>
                    <th className="px-4 py-2 font-medium">RePORTER profile</th>
                    <th className="px-4 py-2 font-medium">Tags (sample)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fo-divider)]">
                  {filtered.map((r) => {
                    const f = r.investigator_profile_features as
                      | { science_tags?: string[]; disease_tags?: string[] }
                      | null
                      | undefined;
                    const sample = [...(f?.science_tags ?? []).slice(0, 2), ...(f?.disease_tags ?? []).slice(0, 1)];
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-[var(--fo-row-hover)]">
                        <td className="px-4 py-2">
                          <Link
                            href={`/investigators/${r.id}`}
                            className="font-medium text-[var(--fo-interaction)] hover:text-[var(--fo-title)] hover:underline"
                          >
                            {r.full_name}
                          </Link>
                          <div className="text-xs text-[var(--fo-ink-muted)]">{r.email ?? "—"}</div>
                        </td>
                        <td className="px-4 py-2 text-[var(--fo-ink-body)]">
                          {r.home_department ?? r.division ?? "—"}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <InvestigatorResearchCommunitySelect
                            investigatorId={r.id}
                            valueId={r.research_community_id as string | null}
                            communities={researchCommunities}
                          />
                        </td>
                        <td className="px-4 py-2">
                          {r.nih_profile_id ? (
                            <Badge tone="info">Linked</Badge>
                          ) : (
                            <span className="text-xs text-[var(--fo-ink-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-[var(--fo-ink-body)]">
                          {sample.length ? sample.join(", ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
