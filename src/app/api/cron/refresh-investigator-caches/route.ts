import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request";
import {
  formatBulkRefreshSummary,
  refreshAllInvestigatorsCommunityCaches,
} from "@/lib/community/bulk-refresh-investigator-caches";
import { createServiceRoleClient } from "@/lib/supabase/admin-service";

export const maxDuration = 300;

/**
 * Refresh PubMed + NIH RePORTER caches for all investigators, then recompute co-authorship edges.
 * Vercel Cron uses GET; manual runs may use POST.
 * Headers: Authorization: Bearer <CRON_SECRET>
 * Requires SUPABASE_SERVICE_ROLE_KEY.
 */
async function handleRefreshInvestigatorCaches(req: Request) {
  const denied = authorizeCronRequest(req);
  if (denied) return denied;

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

export async function GET(req: Request) {
  return handleRefreshInvestigatorCaches(req);
}

export async function POST(req: Request) {
  return handleRefreshInvestigatorCaches(req);
}
