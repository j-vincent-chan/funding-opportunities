"use client";

import { useState, useTransition } from "react";
import { syncCommunitySignalsFromCachesAction } from "@/app/actions/community-intelligence";
import { Button } from "@/components/ui/button";

export function CommunitySignalsSyncPanel() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-4 text-sm text-[var(--fo-ink-body)]">
      <h3 className="font-semibold text-[var(--fo-title)]">
        Build community signals from PubMed, RePORTER &amp; ClinicalTrials.gov
      </h3>
      <p className="mt-1 text-[var(--fo-ink-muted)]">
        No Signal account required. Mirrors cached publications, NIH grants, and clinical trial rows
        from your People directory into the Community dashboard. Refresh those sources on investigator
        pages first (or run the bulk refresh below), then sync here.
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
              const r = await syncCommunitySignalsFromCachesAction();
              if (r.ok) setMessage(r.message);
              else setError(r.message);
            });
          }}
        >
          {pending ? "Syncing…" : "Sync community signals"}
        </Button>
      </div>
      {error ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-900">
          {error}
        </pre>
      ) : null}
      {message ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-[var(--card)] p-3 text-xs text-[var(--fo-ink-body)]">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
