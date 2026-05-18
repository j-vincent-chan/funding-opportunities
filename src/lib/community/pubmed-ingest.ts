/**
 * PubMed ingestion via NCBI E-utilities (esearch + esummary).
 * Name-based search is ambiguous; prefer pubmed_query_override or ORCID-backed flows later.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const DEFAULT_MAX = 35;

function eutilsParams(): URLSearchParams {
  const p = new URLSearchParams();
  p.set("tool", "pursuit_queue_funding_app");
  const email = process.env.NCBI_CONTACT_EMAIL?.trim();
  if (email) p.set("email", email);
  return p;
}

function buildPubmedTerm(args: {
  fullName: string;
  pubmedQueryOverride: string | null;
}): string {
  if (args.pubmedQueryOverride?.trim()) return args.pubmedQueryOverride.trim();
  const n = args.fullName.trim();
  if (!n) return "";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const first = parts[0];
    return `${last} ${first}[Author]`;
  }
  return `${n}[Author]`;
}

type EsearchResult = {
  esearchresult?: {
    idlist?: string[];
    count?: string;
  };
};

type EsummaryResult = {
  result?: Record<
    string,
    {
      title?: string;
      fulljournalname?: string;
      pubdate?: string;
      sortpubdate?: string;
    }
  >;
};

export type PubmedIngestResult = {
  inserted: number;
  term: string;
  pmids: string[];
  warning?: string;
};

/**
 * Fetch recent PubMed IDs for an investigator and upsert into investigator_publications.
 */
export async function refreshInvestigatorPubMed(
  supabase: SupabaseClient,
  investigatorId: string,
  opts: { max?: number } = {}
): Promise<PubmedIngestResult> {
  const max = Math.min(100, Math.max(1, opts.max ?? DEFAULT_MAX));

  const { data: inv, error: invErr } = await supabase
    .from("investigators")
    .select("id, full_name, pubmed_query_override")
    .eq("id", investigatorId)
    .maybeSingle();

  if (invErr || !inv) {
    throw new Error(invErr?.message ?? "Investigator not found");
  }

  const term = buildPubmedTerm({
    fullName: inv.full_name ?? "",
    pubmedQueryOverride: inv.pubmed_query_override ?? null,
  });
  if (!term) {
    throw new Error("No PubMed query — set full name or pubmed_query_override on the investigator.");
  }

  const esearchUrl = new URL(`${EUTILS}/esearch.fcgi`);
  esearchUrl.search = eutilsParams().toString();
  esearchUrl.searchParams.set("db", "pubmed");
  esearchUrl.searchParams.set("term", term);
  esearchUrl.searchParams.set("retmax", String(max));
  esearchUrl.searchParams.set("retmode", "json");
  esearchUrl.searchParams.set("sort", "pub+date");

  const esRes = await fetch(esearchUrl.toString(), { cache: "no-store" });
  if (!esRes.ok) {
    throw new Error(`PubMed esearch failed: ${esRes.status}`);
  }
  const esJson = (await esRes.json()) as EsearchResult;
  const idlist = esJson.esearchresult?.idlist ?? [];
  if (!idlist.length) {
    return { inserted: 0, term, pmids: [], warning: "No PubMed IDs returned for this query." };
  }

  const esummaryUrl = new URL(`${EUTILS}/esummary.fcgi`);
  esummaryUrl.search = eutilsParams().toString();
  esummaryUrl.searchParams.set("db", "pubmed");
  esummaryUrl.searchParams.set("id", idlist.join(","));
  esummaryUrl.searchParams.set("retmode", "json");

  const sumRes = await fetch(esummaryUrl.toString(), { cache: "no-store" });
  if (!sumRes.ok) {
    throw new Error(`PubMed esummary failed: ${sumRes.status}`);
  }
  const sumJson = (await sumRes.json()) as EsummaryResult;
  const result = sumJson.result ?? {};

  let inserted = 0;
  for (const pmid of idlist) {
    const rec = result[pmid];
    if (!rec) continue;
    const title = (rec.title ?? "").replace(/\s+/g, " ").trim() || "(untitled)";
    const journal = rec.fulljournalname ?? null;
    const pubdateRaw = rec.sortpubdate ?? rec.pubdate ?? null;
    let publication_date: string | null = null;
    if (pubdateRaw) {
      const s = String(pubdateRaw).trim();
      const slash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
      if (slash) {
        publication_date = `${slash[1]}-${slash[2]}-${slash[3]}`;
      } else {
        const y = s.slice(0, 4);
        const m = s.slice(4, 6);
        const d = s.slice(6, 8);
        if (/^\d{4}$/.test(y)) {
          publication_date = m && d ? `${y}-${m}-${d}` : `${y}-01-01`;
        }
      }
    }

    const { error } = await supabase.from("investigator_publications").upsert(
      {
        investigator_id: investigatorId,
        pmid,
        title,
        journal,
        publication_date,
        source: "pubmed_eutils",
        raw_json: rec as unknown as Record<string, unknown>,
        match_confidence: "medium",
        provenance_note: `esearch term: ${term}`,
      },
      { onConflict: "investigator_id,pmid" }
    );
    if (!error) inserted += 1;
  }

  return { inserted, term, pmids: idlist };
}
