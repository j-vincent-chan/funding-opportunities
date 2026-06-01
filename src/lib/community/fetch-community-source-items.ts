import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

const COMMUNITY_ITEM_COLUMNS =
  "id,title,category,source_type,status,published_at,found_at,signal_created_at,raw_summary,nih_project_num,source_domain,source_url,signal_tracked_entity_id,prospera_investigator_id,imported_at,updated_at";

export type CommunitySourceItemDbRow = {
  id: string;
  title: string | null;
  category: string | null;
  source_type: string | null;
  status: string | null;
  published_at: string | null;
  found_at: string | null;
  signal_created_at: string | null;
  raw_summary: string | null;
  nih_project_num: string | null;
  source_domain: string | null;
  source_url: string | null;
  signal_tracked_entity_id: string | null;
  prospera_investigator_id: string | null;
  imported_at: string | null;
  updated_at: string | null;
};

export async function fetchAllCommunitySourceItems(supabase: SupabaseClient): Promise<{
  rows: CommunitySourceItemDbRow[];
  totalCount: number | null;
  truncated: boolean;
  error: string | null;
}> {
  const { count, error: countErr } = await supabase
    .from("community_source_items")
    .select("*", { count: "exact", head: true });

  const { data, error, truncated } = await fetchAllRows<CommunitySourceItemDbRow>(
    async (from, to) => {
      const res = await supabase
        .from("community_source_items")
        .select(COMMUNITY_ITEM_COLUMNS)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to);
      return { data: (res.data ?? []) as CommunitySourceItemDbRow[], error: res.error };
    }
  );

  if (error) {
    return { rows: data, totalCount: null, truncated: false, error };
  }

  return {
    rows: data,
    totalCount: countErr ? null : count,
    truncated,
    error: null,
  };
}

export async function fetchAllCommunitySourceItemEntityLinks(
  supabase: SupabaseClient
): Promise<{
  links: { source_item_id: string; signal_entity_id: string }[];
  error: string | null;
}> {
  const { data, error } = await fetchAllRows<{ source_item_id: string; signal_entity_id: string }>(
    async (from, to) => {
      const res = await supabase
        .from("community_source_item_entities")
        .select("source_item_id,signal_entity_id")
        .order("source_item_id", { ascending: true })
        .range(from, to);
      return {
        data: (res.data ?? []) as { source_item_id: string; signal_entity_id: string }[],
        error: res.error,
      };
    }
  );

  return { links: data, error };
}
