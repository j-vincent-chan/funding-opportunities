import { NextResponse } from "next/server";
import {
  formatBulkRefreshSummary,
  refreshAllInvestigatorsCommunityCaches,
} from "@/lib/community/bulk-refresh-investigator-caches";
import { createServiceRoleClient } from "@/lib/supabase/admin-service";

export const maxDuration = 300;

/**
 * Refresh PubMed + NIH RePORTER caches for all investigators, then recompute co-authorship edges.
 * Headers: Authorization: Bearer <CRON_SECRET>
 * Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const result = await refreshAllInvestigatorsCommunityCaches(supabase);
    return NextResponse.json({
      ok: true,
      summary: formatBulkRefreshSummary(result),
      stats: result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
