import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request";
import { runFundingSearchNotificationsJob } from "@/lib/funding-opportunities/run-funding-search-notifications";
import { createServiceRoleClient } from "@/lib/supabase/admin-service";

export const maxDuration = 300;

/**
 * Email digests for saved searches with notifications enabled.
 * Vercel Cron uses GET; manual runs may use POST.
 * Headers: Authorization: Bearer <CRON_SECRET>
 * Requires SUPABASE_SERVICE_ROLE_KEY, and for sends: RESEND_API_KEY + RESEND_FROM_EMAIL.
 */
async function handleFundingSearchNotifications(req: Request) {
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
    const result = await runFundingSearchNotificationsJob(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleFundingSearchNotifications(req);
}

export async function POST(req: Request) {
  return handleFundingSearchNotifications(req);
}
