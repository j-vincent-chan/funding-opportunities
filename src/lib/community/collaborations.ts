/**
 * Derive investigator_relationships from shared PubMed IDs (co-authorship proxy).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CollaborationRecomputeResult = {
  coauthorshipEdges: number;
};

export async function recomputeCoauthorshipFromPublications(
  supabase: SupabaseClient
): Promise<CollaborationRecomputeResult> {
  const { data: pubs, error } = await supabase
    .from("investigator_publications")
    .select("investigator_id, pmid, publication_date");

  if (error) throw new Error(error.message);
  const rows = pubs ?? [];

  const pmidToInvs = new Map<string, string[]>();
  const pmidDate = new Map<string, string | null>();
  for (const r of rows) {
    const pmid = String(r.pmid ?? "");
    const iid = String(r.investigator_id ?? "");
    if (!pmid || !iid) continue;
    const list = pmidToInvs.get(pmid) ?? [];
    if (!list.includes(iid)) list.push(iid);
    pmidToInvs.set(pmid, list);
    if (!pmidDate.has(pmid)) pmidDate.set(pmid, r.publication_date ?? null);
  }

  type PairAgg = { sharedPmids: number; dates: string[] };
  const pairAgg = new Map<string, PairAgg>();

  for (const [pmid, invs] of Array.from(pmidToInvs.entries())) {
    if (invs.length < 2) continue;
    const sorted = [...invs].sort();
    const d = pmidDate.get(pmid);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        const ia = a < b ? a : b;
        const ib = a < b ? b : a;
        const key = `${ia}:${ib}`;
        const cur = pairAgg.get(key) ?? { sharedPmids: 0, dates: [] };
        cur.sharedPmids += 1;
        if (d) cur.dates.push(d);
        pairAgg.set(key, cur);
      }
    }
  }

  await supabase.from("investigator_relationships").delete().eq("source_type", "pubmed_coauthorship");

  let coauthorshipEdges = 0;
  for (const [key, agg] of Array.from(pairAgg.entries())) {
    const [ia, ib] = key.split(":");
    if (!ia || !ib) continue;
    const strength = Math.min(1, agg.sharedPmids / 10);
    const last =
      agg.dates.length > 0
        ? agg.dates.reduce((a: string, b: string) => (a > b ? a : b))
        : null;

    const { error: insErr } = await supabase.from("investigator_relationships").insert({
      investigator_a_id: ia,
      investigator_b_id: ib,
      source_type: "pubmed_coauthorship",
      relationship_type: "coauthor",
      strength_score: strength,
      evidence_count: agg.sharedPmids,
      last_seen_date: last,
      provenance: { shared_publication_count: agg.sharedPmids },
      confidence: 0.6,
    });
    if (!insErr) coauthorshipEdges += 1;
  }

  return { coauthorshipEdges };
}
