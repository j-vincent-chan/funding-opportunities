import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export type DocumentAiAnnotationRow = {
  model: string;
  themes: unknown;
  methods: unknown;
  diseases: unknown;
  translational_stage: string | null;
  source_documents:
    | { source_item_id: string }
    | Array<{ source_item_id: string }>
    | null;
};

const ANNOTATION_SELECT =
  "model,themes,methods,diseases,translational_stage,source_documents!inner(source_item_id)";

export async function fetchAllDocumentAiAnnotations(supabase: SupabaseClient): Promise<{
  rows: DocumentAiAnnotationRow[];
  error: string | null;
  truncated: boolean;
}> {
  const { data, error, truncated } = await fetchAllRows<DocumentAiAnnotationRow>(
    async (from, to) => {
      const res = await supabase
        .from("document_ai_annotations")
        .select(ANNOTATION_SELECT)
        .order("id", { ascending: true })
        .range(from, to);
      return {
        data: (res.data ?? []) as DocumentAiAnnotationRow[],
        error: res.error,
      };
    }
  );

  return { rows: data, error, truncated };
}
