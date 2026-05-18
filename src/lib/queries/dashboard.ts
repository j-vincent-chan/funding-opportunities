import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MAX_NOFOS_PER_SYNC } from "@/lib/services/simpler-grants-sync";

export type FundingOppListRow = {
  id: string;
  title: string;
  agency: string | null;
  close_date: string | null;
  posted_date: string | null;
  status: string | null;
};

export type FundingDashboardBundle = {
  investigatorCount: number;
  recentFunding: FundingOppListRow[];
  closingSoon: FundingOppListRow[];
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function fetchFundingDashboard(
  supabase: SupabaseClient
): Promise<FundingDashboardBundle> {
  const today = new Date().toISOString().slice(0, 10);
  const soon = addDays(today, 30);

  const { count: investigatorCount } = await supabase
    .from("investigators")
    .select("id", { count: "exact", head: true });

  const { data: recentFunding, error: rErr } = await supabase
    .from("funding_opportunities")
    .select("id, title, agency, close_date, posted_date, status")
    .order("posted_date", { ascending: false, nullsFirst: false })
    .limit(8);
  if (rErr) throw rErr;

  const { data: pool, error: pErr } = await supabase
    .from("funding_opportunities")
    .select("id, title, agency, close_date, posted_date, status")
    .limit(DEFAULT_MAX_NOFOS_PER_SYNC);
  if (pErr) throw pErr;

  const rows = pool ?? [];
  const closingSoon = rows
    .filter((r) => {
      if (!r.close_date) return false;
      if (r.close_date < today) return false;
      if (r.close_date > soon) return false;
      if (r.status === "closed" || r.status === "archived") return false;
      return true;
    })
    .sort((a, b) => (a.close_date ?? "").localeCompare(b.close_date ?? ""))
    .slice(0, 8);

  return {
    investigatorCount: investigatorCount ?? 0,
    recentFunding: (recentFunding ?? []) as FundingOppListRow[],
    closingSoon: closingSoon as FundingOppListRow[],
  };
}
