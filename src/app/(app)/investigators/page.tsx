import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InvestigatorsDirectoryTable,
  type InvestigatorDirectoryRow,
} from "@/components/investigators/investigators-directory-table";
import { InvestigatorsPageChrome } from "@/components/investigators/investigators-page-chrome";

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

  const allRows = (rows ?? []) as InvestigatorDirectoryRow[];

  const filtered = allRows.filter((r) => {
    if (!tag) return true;
    const f = r.investigator_profile_features;
    const tags = [...(f?.science_tags ?? []), ...(f?.disease_tags ?? [])];
    return tags.includes(tag);
  });

  const stats = {
    showing: filtered.length,
    total: allRows.length,
    withEmail: allRows.filter((r) => r.email?.trim()).length,
    withReporter: allRows.filter((r) => r.nih_profile_id).length,
    withCommunity: allRows.filter((r) => r.research_community_id).length,
  };

  return (
    <InvestigatorsPageChrome
      q={q}
      tag={tag}
      stats={stats}
      researchCommunities={researchCommunities}
    >
      {error ? (
        <div className="px-5 py-8">
          <p className="text-sm text-red-600">{error.message}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-10">
          <EmptyState
            title={stats.total === 0 ? "No people yet" : "No matches"}
            description={
              stats.total === 0
                ? "Use Add person to enter someone manually, import a CSV, or sync from Signal."
                : "Try clearing filters or broadening your name or tag search."
            }
          />
        </div>
      ) : (
        <InvestigatorsDirectoryTable rows={filtered} researchCommunities={researchCommunities} />
      )}
    </InvestigatorsPageChrome>
  );
}
