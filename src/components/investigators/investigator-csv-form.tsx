"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { importInvestigatorsFromCsv } from "@/app/actions/investigators-pipeline";

export function InvestigatorCsvForm() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      action={async (fd) => {
        setPending(true);
        setMsg(null);
        const res = await importInvestigatorsFromCsv(fd);
        setPending(false);
        if ("error" in res && res.error) setMsg(res.error);
        else if ("imported" in res) {
          const errCount = Array.isArray(res.errors) ? res.errors.length : 0;
          setMsg(`Imported ${res.imported} investigators. ${errCount} row errors.`);
        }
      }}
    >
      <label className="text-xs font-medium text-slate-600">
        PI CSV
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1 block w-full text-sm"
        />
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Importing…" : "Import CSV"}
      </Button>
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </form>
  );
}
