"use client";

import { useState, useTransition } from "react";
import { refreshAllInvestigatorCachesAdminAction } from "@/app/actions/community-intelligence";
import { Button } from "@/components/ui/button";

export function BulkRefreshCachesPanel() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <h3 className="font-semibold text-slate-900">
        Refresh PubMed + RePORTER + ClinicalTrials.gov for all investigators
      </h3>
      <p className="mt-1 text-[var(--fo-ink-muted)]">
        Re-fetches PubMed (strict UCSF + author match), NIH RePORTER, and ClinicalTrials.gov per
        investigator (three APIs in parallel), mirrors caches into community signals, then rebuilds
        the co-authorship graph. RePORTER only runs when{" "}
        <code className="rounded bg-[var(--fo-paper-2)] px-1 text-xs">nih_profile_id</code> is set;
        others are skipped (cache cleared if empty).
      </p>
      <p className="mt-2 text-amber-800">
        <strong>Admin only.</strong> Large directories can exceed hosting time limits — if this
        times out, run{" "}
        <code className="rounded bg-amber-100 px-1 text-xs">npm run refresh-investigator-caches -- --concurrency 6</code>{" "}
        locally (needs <code className="rounded bg-amber-100 px-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>
        ; set <code className="rounded bg-amber-100 px-1 text-xs">NCBI_API_KEY</code> for faster PubMed)
        ) or call{" "}
        <code className="rounded bg-amber-100 px-1 text-xs">POST /api/cron/refresh-investigator-caches</code>{" "}
        with <code className="rounded bg-amber-100 px-1 text-xs">Authorization: Bearer CRON_SECRET</code>.
      </p>
      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(async () => {
              const r = await refreshAllInvestigatorCachesAdminAction();
              if (r.ok) setMessage(r.message);
              else setError(r.message);
            });
          }}
        >
          {pending ? "Refreshing…" : "Run bulk refresh (admin)"}
        </Button>
      </div>
      {error ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-900">
          {error}
        </pre>
      ) : null}
      {message ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-800">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
