"use client";

import { useMemo, useState } from "react";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { importSignalSourceItemsFromSignal } from "@/app/actions/community-signal-import";
import { importInvestigatorsFromSignal } from "@/app/actions/investigators-pipeline";
import { fetchAllRows, SUPABASE_PAGE_SIZE } from "@/lib/supabase/fetch-all-rows";

type SignalTrackedEntityRow = {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_initial: string | null;
  name: string | null;
  slug: string | null;
  entity_type: string | null;
  priority_tier: number | null;
  active: boolean | null;
  member_status: string | null;
  institution: string | null;
  pubmed_url: string | null;
  lab_website: string | null;
  google_alert_query: string | null;
  nih_profile_id: string | null;
  x_handle: string | null;
  bluesky_handle: string | null;
  x_lab_handle: string | null;
  bluesky_lab_handle: string | null;
  headshot_url: string | null;
  headshot_storage_path: string | null;
  community_id: string | null;
};

type SignalSourceItemRow = {
  id: string;
  community_id: string | null;
  title: string | null;
  category: string | null;
  source_type: string | null;
  status: string | null;
  published_at: string | null;
  found_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_url: string | null;
  source_domain: string | null;
  signal_group_key: string | null;
  raw_summary: string | null;
  nih_project_num: string | null;
  tracked_entity_id: string | null;
};

type SignalEntityLinkRow = {
  source_item_id: string;
  tracked_entity_id: string;
  created_at: string | null;
};

const SIGNAL_TRACKED_ENTITIES_COLUMNS =
  "id,first_name,last_name,middle_initial,name,slug,entity_type,priority_tier,active,member_status,institution,pubmed_url,lab_website,google_alert_query,nih_profile_id,x_handle,bluesky_handle,x_lab_handle,bluesky_lab_handle,headshot_url,headshot_storage_path,community_id";

const SIGNAL_SOURCE_ITEMS_COLUMNS =
  "id,community_id,title,category,source_type,status,published_at,found_at,created_at,updated_at,source_url,source_domain,signal_group_key,raw_summary,nih_project_num,tracked_entity_id";

const SIGNAL_ENTITY_LINK_COLUMNS = "source_item_id,tracked_entity_id,created_at";

/** Keep each Server Action payload under Next.js default body limit. */
const IMPORT_ITEMS_BATCH = 75;
const IMPORT_LINKS_BATCH = 400;
const SIGNAL_FETCH_MAX_ROWS = 200_000;

type SignalClient = SupabaseClient;

function dedupeSourceItemsById(items: SignalSourceItemRow[]): SignalSourceItemRow[] {
  const byId = new Map<string, SignalSourceItemRow>();
  for (const item of items) {
    if (item.id) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function authErrorMessage(error: { message?: string; code?: string }): string {
  const code = error.code ?? "";
  if (code === "invalid_credentials" || error.message?.toLowerCase().includes("invalid login")) {
    return "Invalid Signal email or password. Use the same credentials as signal.ucsf.edu.";
  }
  if (code === "email_address_invalid") {
    return "Signal rejected this email address. Use the same email as signal.ucsf.edu.";
  }
  return error.message ?? "Could not sign in to Signal.";
}

async function fetchSourceItemsByIds(
  signalClient: SignalClient,
  ids: string[]
): Promise<{ items: SignalSourceItemRow[]; error: string | null }> {
  const items: SignalSourceItemRow[] = [];
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const chunkSize = 200;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await signalClient
      .from("source_items")
      .select(SIGNAL_SOURCE_ITEMS_COLUMNS)
      .in("id", chunk);
    if (error) return { items, error: error.message };
    items.push(...((data ?? []) as SignalSourceItemRow[]));
  }

  return { items, error: null };
}

async function fetchSourceItemsViaEntityLinks(
  signalClient: SignalClient,
  trackedEntityIds: string[]
): Promise<{ items: SignalSourceItemRow[]; error: string | null }> {
  const sourceItemIds = new Set<string>();
  const chunkSize = 100;

  for (let i = 0; i < trackedEntityIds.length; i += chunkSize) {
    const chunk = trackedEntityIds.slice(i, i + chunkSize);
    const { data, error } = await signalClient
      .from("source_item_tracked_entities")
      .select("source_item_id")
      .in("tracked_entity_id", chunk);
    if (error) return { items: [], error: error.message };
    for (const row of (data ?? []) as Array<{ source_item_id: string | null }>) {
      const id = row.source_item_id;
      if (id) sourceItemIds.add(id);
    }
  }

  if (sourceItemIds.size === 0) return { items: [], error: null };
  return fetchSourceItemsByIds(signalClient, Array.from(sourceItemIds));
}

/** Paginate all source_items visible to the signed-in Signal user (RLS-scoped). */
async function fetchAllSourceItems(
  signalClient: SignalClient
): Promise<{ items: SignalSourceItemRow[]; error: string | null; truncated: boolean }> {
  const { data, error, truncated } = await fetchAllRows<SignalSourceItemRow>(
    async (from, to) => {
      const res = await signalClient
        .from("source_items")
        .select(SIGNAL_SOURCE_ITEMS_COLUMNS)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to);
      return { data: (res.data ?? []) as SignalSourceItemRow[], error: res.error };
    },
    { pageSize: SUPABASE_PAGE_SIZE, maxRows: SIGNAL_FETCH_MAX_ROWS }
  );

  return { items: data, error, truncated };
}

async function fetchSignalSourceItemsForImport(
  signalClient: SignalClient,
  trackedEntityIds: string[]
): Promise<{ items: SignalSourceItemRow[]; error: string | null; truncated: boolean }> {
  const direct = await fetchAllSourceItems(signalClient);
  if (direct.error) return { items: direct.items, error: direct.error, truncated: false };
  if (direct.items.length > 0) {
    return { items: direct.items, error: null, truncated: direct.truncated };
  }

  if (trackedEntityIds.length === 0) {
    return { items: direct.items, error: null, truncated: direct.truncated };
  }

  const viaLinks = await fetchSourceItemsViaEntityLinks(signalClient, trackedEntityIds);
  if (viaLinks.error) return { items: [], error: viaLinks.error, truncated: false };
  if (viaLinks.items.length > 0) return { items: viaLinks.items, error: null, truncated: false };

  const directIds = trackedEntityIds.filter(Boolean);
  if (directIds.length === 0) return direct;

  const byEntity: SignalSourceItemRow[] = [];
  const chunkSize = 100;
  for (let i = 0; i < directIds.length; i += chunkSize) {
    const chunk = directIds.slice(i, i + chunkSize);
    const { data, error } = await signalClient
      .from("source_items")
      .select(SIGNAL_SOURCE_ITEMS_COLUMNS)
      .in("tracked_entity_id", chunk);
    if (error) return { items: byEntity, error: error.message, truncated: false };
    byEntity.push(...((data ?? []) as SignalSourceItemRow[]));
  }

  return { items: dedupeSourceItemsById(byEntity), error: null, truncated: false };
}

async function fetchEntityLinks(
  signalClient: SignalClient,
  sourceItemIds: string[]
): Promise<{ links: SignalEntityLinkRow[]; error: string | null }> {
  const links: SignalEntityLinkRow[] = [];
  const chunkSize = 200;

  for (let i = 0; i < sourceItemIds.length; i += chunkSize) {
    const chunk = sourceItemIds.slice(i, i + chunkSize);
    const { data, error } = await signalClient
      .from("source_item_tracked_entities")
      .select(SIGNAL_ENTITY_LINK_COLUMNS)
      .in("source_item_id", chunk);
    if (error) return { links, error: error.message };
    links.push(...((data ?? []) as SignalEntityLinkRow[]));
  }

  return { links, error: null };
}

export function InvestigatorSignalImportForm() {
  const signalUrl = process.env.NEXT_PUBLIC_SIGNAL_SUPABASE_URL?.trim() ?? "";
  const signalAnon = process.env.NEXT_PUBLIC_SIGNAL_SUPABASE_ANON_KEY?.trim() ?? "";
  const enabled = signalUrl.length > 0 && signalAnon.length > 0;

  const signalClient = useMemo(() => {
    if (!enabled) return null;
    return createSupabaseClient(signalUrl, signalAnon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }, [enabled, signalAnon, signalUrl]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<SignalTrackedEntityRow[]>([]);
  const [sourceItems, setSourceItems] = useState<SignalSourceItemRow[]>([]);
  const [entityLinks, setEntityLinks] = useState<SignalEntityLinkRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    imported: number;
    inserted: number;
    updated: number;
    signalsImported: number;
    signalLinksImported: number;
    errors: string[];
  } | null>(null);

  async function signInAndFetch() {
    if (!signalClient) return;
    setFetching(true);
    setMsg(null);
    setSummary(null);
    setRows([]);
    setSourceItems([]);
    setEntityLinks([]);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setFetching(false);
      setMsg("Enter your Signal email and password.");
      return;
    }

    const { error: signInErr } = await signalClient.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (signInErr) {
      setFetching(false);
      setPassword("");
      setMsg(authErrorMessage(signInErr));
      return;
    }

    const { data: trackedPages, error: fetchErr } = await fetchAllRows<SignalTrackedEntityRow>(
      async (from, to) => {
        const res = await signalClient
          .from("tracked_entities")
          .select(SIGNAL_TRACKED_ENTITIES_COLUMNS)
          .eq("active", true)
          .order("last_name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to);
        return { data: (res.data ?? []) as SignalTrackedEntityRow[], error: res.error };
      },
      { pageSize: SUPABASE_PAGE_SIZE, maxRows: 10_000 }
    );

    if (fetchErr) {
      await signalClient.auth.signOut();
      setPassword("");
      setFetching(false);
      setMsg(fetchErr);
      return;
    }

    const loaded = trackedPages;
    const trackedEntityIds = loaded
      .map((r) => r.id)
      .filter((id): id is string => Boolean(id));

    const { items, error: itemsErr, truncated: itemsTruncated } =
      await fetchSignalSourceItemsForImport(signalClient, trackedEntityIds);
    if (itemsErr) {
      await signalClient.auth.signOut();
      setPassword("");
      setFetching(false);
      setMsg(`Fetched ${loaded.length} people but signals failed: ${itemsErr}`);
      setRows(loaded);
      return;
    }

    const itemIds = items.map((item) => item.id);
    const { links, error: linksErr } =
      itemIds.length > 0
        ? await fetchEntityLinks(signalClient, itemIds)
        : { links: [] as SignalEntityLinkRow[], error: null };

    await signalClient.auth.signOut();
    setPassword("");
    setFetching(false);

    const uniqueItems = dedupeSourceItemsById(items);
    const duplicateCount = items.length - uniqueItems.length;

    setRows(loaded);
    setSourceItems(uniqueItems);
    setEntityLinks(linksErr ? [] : links);

    const linkNote = linksErr ? ` Entity links skipped (${linksErr}).` : ` ${links.length} entity links.`;
    const dupeNote =
      duplicateCount > 0 ? ` (${duplicateCount} duplicate signal ids removed.)` : "";
    const truncNote = itemsTruncated ? " Signal fetch hit the safety cap — not all rows may be included." : "";
    if (uniqueItems.length === 0) {
      setMsg(
        `Fetched ${loaded.length} people but 0 signals from Signal. Confirm you can see items on signal.ucsf.edu, then try again.${linkNote}`
      );
    } else {
      setMsg(
        `Fetched ${loaded.length} active people and ${uniqueItems.length} signals.${dupeNote}${linkNote}${truncNote} Click import to merge into Prospera.`
      );
    }
  }

  async function runImport() {
    setImporting(true);
    setMsg(null);
    setSummary(null);

    const peopleRes = await importInvestigatorsFromSignal(rows);
    if ("error" in peopleRes && peopleRes.error) {
      setImporting(false);
      setMsg(peopleRes.error);
      return;
    }

    let signalsImported = 0;
    let signalLinksImported = 0;
    const errors = Array.isArray(peopleRes.errors) ? [...peopleRes.errors] : [];

    if (sourceItems.length > 0) {
      const itemBatches = Math.ceil(sourceItems.length / IMPORT_ITEMS_BATCH);
      for (let i = 0; i < sourceItems.length; i += IMPORT_ITEMS_BATCH) {
        const batchNum = Math.floor(i / IMPORT_ITEMS_BATCH) + 1;
        setMsg(`Importing signals batch ${batchNum} of ${itemBatches}…`);
        const batch = sourceItems.slice(i, i + IMPORT_ITEMS_BATCH);
        const signalsRes = await importSignalSourceItemsFromSignal(batch, []);
        if ("error" in signalsRes && signalsRes.error) {
          setImporting(false);
          setMsg(signalsRes.error);
          return;
        }
        if ("imported" in signalsRes) {
          signalsImported += signalsRes.imported ?? 0;
          errors.push(...(signalsRes.errors ?? []));
        }
      }
      for (let i = 0; i < entityLinks.length; i += IMPORT_LINKS_BATCH) {
        const batch = entityLinks.slice(i, i + IMPORT_LINKS_BATCH);
        const linksRes = await importSignalSourceItemsFromSignal([], batch);
        if ("error" in linksRes && linksRes.error) {
          setImporting(false);
          setMsg(linksRes.error);
          return;
        }
        if ("linksImported" in linksRes) {
          signalLinksImported += linksRes.linksImported ?? 0;
          errors.push(...(linksRes.errors ?? []));
        }
      }
    }

    setImporting(false);
    if ("imported" in peopleRes) {
      const peopleImported = peopleRes.imported ?? 0;
      const peopleInserted = peopleRes.inserted ?? 0;
      const peopleUpdated = peopleRes.updated ?? 0;
      setSummary({
        imported: peopleImported,
        inserted: peopleInserted,
        updated: peopleUpdated,
        signalsImported,
        signalLinksImported,
        errors,
      });
      if (sourceItems.length > 0 && signalsImported === 0) {
        const hint = errors[0] ?? "Check import errors below.";
        setMsg(
          `People saved (${peopleImported}), but 0 signals were written to community_source_items. ${hint}`
        );
      } else {
        setMsg(
          `Imported ${peopleImported} people (${peopleInserted} new, ${peopleUpdated} updated) and ${signalsImported} signals. ${errors.length} row errors.`
        );
      }
    }
  }

  function downloadErrors() {
    if (!summary || summary.errors.length === 0) return;
    const body = summary.errors.join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "signal-import-errors.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!enabled) {
    return (
      <p className="text-xs text-[var(--fo-ink-muted)]">
        Signal import is disabled. Set{" "}
        <code className="rounded bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-[0.7rem]">
          NEXT_PUBLIC_SIGNAL_SUPABASE_URL
        </code>{" "}
        and{" "}
        <code className="rounded bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-[0.7rem]">
          NEXT_PUBLIC_SIGNAL_SUPABASE_ANON_KEY
        </code>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--fo-paper-2)] p-3">
      <p className="text-xs font-medium text-[var(--fo-ink-body)]">
        Sign in with your{" "}
        <a
          href="https://signal.ucsf.edu"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[var(--fo-interaction)] underline"
        >
          signal.ucsf.edu
        </a>{" "}
        email and password to fetch your active people list and their curated signals. Your password
        is sent directly to Signal (not stored in Prospera).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-[var(--fo-ink-muted)]">
          Signal email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@ucsf.edu"
            autoComplete="username"
            className="mt-1 block w-64 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </label>
        <label className="text-xs font-medium text-[var(--fo-ink-muted)]">
          Signal password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 block w-48 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void signInAndFetch();
              }
            }}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void signInAndFetch()}
          disabled={fetching || !email.trim() || !password}
        >
          {fetching ? "Signing in…" : "Sign in + fetch"}
        </Button>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-[var(--fo-ink-muted)]">
            Ready: <span className="font-semibold">{rows.length}</span> people,{" "}
            <span className="font-semibold">{sourceItems.length}</span> signals
          </p>
          <Button type="button" onClick={runImport} disabled={importing}>
            {importing ? "Importing…" : "Import from Signal"}
          </Button>
        </div>
      ) : null}

      {msg ? <p className="text-xs text-[var(--fo-ink-body)]">{msg}</p> : null}

      {summary ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fo-ink-muted)]">
            Last import summary
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded border border-[var(--border)] bg-[var(--fo-paper-2)] px-2 py-1.5">
              <span className="block text-[var(--fo-ink-muted)]">People</span>
              <span className="font-semibold text-[var(--fo-title)]">{summary.imported}</span>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--fo-paper-2)] px-2 py-1.5">
              <span className="block text-[var(--fo-ink-muted)]">Inserted</span>
              <span className="font-semibold text-[var(--fo-title)]">{summary.inserted}</span>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--fo-paper-2)] px-2 py-1.5">
              <span className="block text-[var(--fo-ink-muted)]">Updated</span>
              <span className="font-semibold text-[var(--fo-title)]">{summary.updated}</span>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--fo-paper-2)] px-2 py-1.5">
              <span className="block text-[var(--fo-ink-muted)]">Signals</span>
              <span className="font-semibold text-[var(--fo-title)]">{summary.signalsImported}</span>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--fo-paper-2)] px-2 py-1.5">
              <span className="block text-[var(--fo-ink-muted)]">Entity links</span>
              <span className="font-semibold text-[var(--fo-title)]">
                {summary.signalLinksImported}
              </span>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--fo-paper-2)] px-2 py-1.5">
              <span className="block text-[var(--fo-ink-muted)]">Errors</span>
              <span className="font-semibold text-[var(--fo-title)]">{summary.errors.length}</span>
            </div>
          </div>
          {summary.errors.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={downloadErrors}>
                Download error lines
              </Button>
              <p className="text-xs text-[var(--fo-ink-muted)]">
                Review and retry after correcting source rows.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
