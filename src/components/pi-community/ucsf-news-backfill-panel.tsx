"use client";

import { useState, useTransition } from "react";
import {
  ingestUcsfNewsFromSitemapsAction,
  linkUcsfNewsToWatchlistAction,
} from "@/app/actions/community-intelligence";
import { Button } from "@/components/ui/button";

export function UcsfNewsBackfillPanel() {
  const [pendingIngest, startIngestTransition] = useTransition();
  const [pendingLink, startLinkTransition] = useTransition();
  const [maxItems, setMaxItems] = useState(5000);
  const [linkMaxItems, setLinkMaxItems] = useState(2000);
  const [sinceYear, setSinceYear] = useState(2010);
  const [fetchBodies, setFetchBodies] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <h3 className="font-semibold text-slate-900">Ingest UCSF News (direct sitemap backfill)</h3>
      <p className="mt-1 text-[var(--fo-ink-muted)]">
        Crawls UCSF sitemap URLs into
        <code className="rounded bg-[var(--fo-paper-2)] px-1 text-xs"> community_source_items </code>
        , then matches article text against your watchlist (People roster) and writes
        <code className="rounded bg-[var(--fo-paper-2)] px-1 text-xs"> community_source_item_entities </code>
        links so news appears on investigator filters and PI views.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          Max URLs to ingest
          <input
            type="number"
            min={1}
            max={20000}
            value={maxItems}
            onChange={(e) => setMaxItems(Number(e.target.value) || 5000)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Since year (optional floor)
          <input
            type="number"
            min={1990}
            max={2100}
            value={sinceYear}
            onChange={(e) => setSinceYear(Number(e.target.value) || 2010)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 sm:col-span-2">
          Max rows to link per run
          <input
            type="number"
            min={1}
            max={20000}
            value={linkMaxItems}
            onChange={(e) => setLinkMaxItems(Number(e.target.value) || 2000)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={fetchBodies}
          onChange={(e) => setFetchBodies(e.target.checked)}
          className="rounded border-[var(--border)]"
        />
        Fetch article HTML when title alone does not match (recommended; slower)
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pendingIngest}
          onClick={() => {
            setMessage(null);
            setError(null);
            startIngestTransition(async () => {
              const r = await ingestUcsfNewsFromSitemapsAction({
                maxItems,
                sinceYear,
                linkToWatchlist: true,
                linkMaxItems,
              });
              if (r.ok) setMessage(r.message);
              else setError(r.message);
            });
          }}
        >
          {pendingIngest ? "Ingesting..." : "Run UCSF News backfill (admin)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pendingLink}
          onClick={() => {
            setMessage(null);
            setError(null);
            startLinkTransition(async () => {
              const r = await linkUcsfNewsToWatchlistAction({
                maxItems: linkMaxItems,
                onlyUnlinked: true,
                fetchArticleBodies: fetchBodies,
              });
              if (r.ok) setMessage(r.message);
              else setError(r.message);
            });
          }}
        >
          {pendingLink ? "Linking..." : "Link to watchlist (admin)"}
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
