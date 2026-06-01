"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  refreshInvestigatorClinicalTrialsFormAction,
  refreshInvestigatorPubMedFormAction,
  refreshInvestigatorReporterFormAction,
} from "@/app/actions/community-intelligence";
import { Button } from "@/components/ui/button";

type RefreshJob = "pubmed" | "reporter" | "trials";

const JOB_LABELS: Record<RefreshJob, { idle: string; pending: string }> = {
  pubmed: {
    idle: "Refresh PubMed",
    pending: "Refreshing PubMed…",
  },
  reporter: {
    idle: "Refresh NIH RePORTER",
    pending: "Refreshing NIH RePORTER…",
  },
  trials: {
    idle: "Refresh ClinicalTrials.gov",
    pending: "Refreshing ClinicalTrials.gov…",
  },
};

export function InvestigatorCacheRefreshButtons({
  investigatorId,
}: {
  investigatorId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeJob, setActiveJob] = useState<RefreshJob | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const run = (job: RefreshJob, action: (formData: FormData) => Promise<{ ok: boolean; message: string }>) => {
    setActiveJob(job);
    setStatus({
      ok: true,
      message:
        job === "pubmed"
          ? "Querying PubMed and verifying UCSF affiliations — this can take 1–2 minutes for large publication lists."
          : "Working…",
    });
    startTransition(async () => {
      const formData = new FormData();
      formData.set("investigatorId", investigatorId);
      const result = await action(formData);
      setStatus(result);
      setActiveJob(null);
      if (result.ok) router.refresh();
    });
  };

  const busy = isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-busy={busy}>
        {(Object.keys(JOB_LABELS) as RefreshJob[]).map((job) => (
          <Button
            key={job}
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (job === "pubmed") run(job, refreshInvestigatorPubMedFormAction);
              else if (job === "reporter") run(job, refreshInvestigatorReporterFormAction);
              else run(job, refreshInvestigatorClinicalTrialsFormAction);
            }}
          >
            {activeJob === job && isPending ? JOB_LABELS[job].pending : JOB_LABELS[job].idle}
          </Button>
        ))}
      </div>

      {status ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-3 py-2 text-sm ${
            busy
              ? "border-[var(--border)] bg-[var(--fo-paper-2)] text-[var(--fo-ink-body)]"
              : status.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-red-200 bg-red-50 text-red-950"
          }`}
        >
          {busy ? (
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--fo-ink-muted)] border-t-transparent"
                aria-hidden
              />
              <span>{status.message}</span>
            </div>
          ) : (
            status.message
          )}
        </div>
      ) : null}
    </div>
  );
}
