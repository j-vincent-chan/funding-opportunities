"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  extractOpportunityFeaturesAll,
  syncFundingOpportunities,
  syncFundingOpportunitiesTest10,
} from "@/app/actions/funding-opportunities-pipeline";

type SyncOk = {
  upserted: number;
  skippedClosed: number;
  skippedLocked: number;
  pagesFetched: number;
  apiTotalRecords: number | null;
  apiTotalPages: number | null;
  errors: string[];
  maxNofosPerRun?: number;
};

function formatSyncLog(label: string, r: SyncOk): string {
  const errTail =
    r.errors.length > 0
      ? ` — ${r.errors.slice(0, 5).join(" | ")}${r.errors.length > 5 ? " …" : ""}`
      : "";
  const apiMeta =
    r.apiTotalRecords != null
      ? ` Simpler search reports ${r.apiTotalRecords} total matches for this filter${
          r.apiTotalPages != null ? ` (${r.apiTotalPages} page(s) at this page size)` : ""
        }.`
      : "";
  const capNote = r.maxNofosPerRun != null ? ` Row cap: ${r.maxNofosPerRun}.` : "";
  return `${label}: upserted ${r.upserted}, skipped closed ${r.skippedClosed}, pages fetched ${r.pagesFetched}.${capNote}${apiMeta} API/log lines ${r.errors.length}${errTail}`;
}

const editorialBtn =
  "!border-[#B3C5D4] !bg-[#FFFFFF] !text-[#26415E] shadow-none hover:!border-[#0F5B99] hover:!bg-[#D9EBF8] hover:!text-[#0B2E4F] focus-visible:!ring-2 focus-visible:!ring-[#147DC2]/35 !rounded-[10px] !px-3.5 !py-2 !text-xs !font-semibold";

const editorialPrimary =
  "!border-[#0B4D82] !bg-[#0F5B99] !text-white shadow-none hover:!border-[#093E68] hover:!bg-[#0d4f85] hover:!text-white focus-visible:!ring-2 focus-visible:!ring-[#147DC2]/45 !rounded-[10px] !px-3.5 !py-2 !text-xs !font-semibold";

export function SimplerSyncControls({ editorial = false }: { editorial?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={editorial ? "secondary" : "primary"}
        className={editorial ? editorialPrimary : ""}
        disabled={busy !== null}
        onClick={async () => {
          setBusy("sync");
          setLog(null);
          const r = await syncFundingOpportunities();
          setBusy(null);
          if ("error" in r && r.error) setLog(r.error);
          else if ("upserted" in r) {
            setLog(formatSyncLog("Full sync", r));
          }
        }}
      >
        {busy === "sync" ? "Syncing…" : "Sync Simpler"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className={editorial ? editorialBtn : ""}
        disabled={busy !== null}
        onClick={async () => {
          setBusy("sync10");
          setLog(null);
          const r = await syncFundingOpportunitiesTest10();
          setBusy(null);
          if ("error" in r && r.error) setLog(r.error);
          else if ("upserted" in r) {
            setLog(formatSyncLog("Test sync (max 10 opportunities)", r));
          }
        }}
      >
        {busy === "sync10" ? "Syncing…" : "Sync Simpler (10, test)"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className={editorial ? editorialBtn : ""}
        disabled={busy !== null}
        onClick={async () => {
          setBusy("feat");
          setLog(null);
          const r = await extractOpportunityFeaturesAll();
          setBusy(null);
          if ("error" in r && r.error) setLog(r.error);
          else if ("extracted" in r) setLog(`Re-extracted features for ${r.extracted} rows.`);
        }}
      >
        {busy === "feat" ? "Extracting…" : "Re-extract all opportunity features"}
      </Button>
      {log ? (
        <p
          className={`w-full text-xs leading-relaxed ${editorial ? "text-[var(--fo-ink-body)]" : "text-slate-600"}`}
        >
          {log}
        </p>
      ) : null}
    </div>
  );
}
