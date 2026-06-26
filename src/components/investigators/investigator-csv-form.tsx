"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { importInvestigatorsFromCsv } from "@/app/actions/investigators-pipeline";

const fieldClass =
  "mt-1.5 block w-full max-w-md rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2 text-sm text-[var(--fo-title)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--fo-paper-2)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--fo-title)]";

export function InvestigatorCsvForm() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  return (
    <form
      className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      action={async (fd) => {
        setPending(true);
        setMsg(null);
        setIsError(false);
        const res = await importInvestigatorsFromCsv(fd);
        setPending(false);
        if ("error" in res && res.error) {
          setIsError(true);
          setMsg(res.error);
        } else if ("imported" in res) {
          const errCount = Array.isArray(res.errors) ? res.errors.length : 0;
          setMsg(`Imported ${res.imported} investigator${res.imported === 1 ? "" : "s"}.${errCount > 0 ? ` ${errCount} row errors.` : ""}`);
        }
      }}
    >
      <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-[var(--fo-ink-muted)]">
        CSV file
        <input name="file" type="file" accept=".csv,text/csv" required className={fieldClass} />
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Importing…" : "Import CSV"}
      </Button>
      {msg ? (
        <p className={`w-full text-xs ${isError ? "text-red-600" : "font-medium text-emerald-700"}`}>{msg}</p>
      ) : null}
    </form>
  );
}
