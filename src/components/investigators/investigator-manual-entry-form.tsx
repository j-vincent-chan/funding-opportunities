"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInvestigatorAction,
  type CreateInvestigatorInput,
} from "@/app/actions/investigators-pipeline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type CommunityOption = { id: string; label: string };

export type InvestigatorManualEntryDefaults = Partial<
  Pick<
    CreateInvestigatorInput,
    | "first_name"
    | "last_name"
    | "email"
    | "home_department"
    | "division"
    | "rank"
    | "nih_profile_id"
    | "primary_research_area"
    | "research_summary"
    | "research_community_id"
  >
>;

function splitNameQuery(q: string): { first_name: string; last_name: string } {
  const parts = q.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0]!, last_name: "" };
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") };
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3.5 py-2.5 text-sm text-[var(--fo-title)] shadow-sm placeholder:text-[var(--fo-ink-faint)] focus:border-[var(--fo-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--fo-focus-ring)]";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-[var(--fo-ink-muted)]";

export function InvestigatorManualEntryForm({
  communities = [],
  defaultResearchCommunityId = null,
  defaultValues,
  compact = false,
  variant = "default",
  submitLabel = "Add investigator",
  onCreated,
}: {
  communities?: CommunityOption[];
  defaultResearchCommunityId?: string | null;
  defaultValues?: InvestigatorManualEntryDefaults;
  compact?: boolean;
  variant?: "default" | "page";
  submitLabel?: string;
  onCreated?: (result: { investigatorId: string; full_name: string }) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(!compact || Boolean(defaultValues?.first_name || defaultValues?.last_name));

  const [firstName, setFirstName] = useState(defaultValues?.first_name ?? "");
  const [lastName, setLastName] = useState(defaultValues?.last_name ?? "");
  const [email, setEmail] = useState(defaultValues?.email ?? "");
  const [homeDepartment, setHomeDepartment] = useState(defaultValues?.home_department ?? "");
  const [division, setDivision] = useState(defaultValues?.division ?? "");
  const [rank, setRank] = useState(defaultValues?.rank ?? "");
  const [nihProfileId, setNihProfileId] = useState(defaultValues?.nih_profile_id ?? "");
  const [primaryResearchArea, setPrimaryResearchArea] = useState(defaultValues?.primary_research_area ?? "");
  const [researchCommunityId, setResearchCommunityId] = useState(
    defaultValues?.research_community_id ?? defaultResearchCommunityId ?? ""
  );

  useEffect(() => {
    if (!defaultValues) return;
    if (defaultValues.first_name != null) setFirstName(defaultValues.first_name);
    if (defaultValues.last_name != null) setLastName(defaultValues.last_name);
    if (defaultValues.email != null) setEmail(defaultValues.email);
    if (defaultValues.research_community_id != null) {
      setResearchCommunityId(defaultValues.research_community_id);
    }
    if (defaultValues.first_name || defaultValues.last_name) setOpen(true);
  }, [defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    const res = await createInvestigatorAction({
      first_name: firstName,
      last_name: lastName,
      email,
      home_department: homeDepartment,
      division,
      rank,
      nih_profile_id: nihProfileId,
      primary_research_area: primaryResearchArea,
      research_community_id: researchCommunityId || null,
    });
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if (!res.ok) return;

    if (onCreated) {
      onCreated({ investigatorId: res.investigatorId, full_name: res.full_name });
    } else {
      router.refresh();
      if (variant === "page") {
        setSuccess(`Added ${res.full_name} to the directory.`);
      }
    }

    setFirstName("");
    setLastName("");
    setEmail("");
    setHomeDepartment("");
    setDivision("");
    setRank("");
    setNihProfileId("");
    setPrimaryResearchArea("");
    if (!defaultResearchCommunityId) setResearchCommunityId("");
    if (compact) setOpen(false);
  }

  const formBody = (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? "space-y-3"
          : variant === "page"
            ? "grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"
            : "grid gap-4 sm:grid-cols-2"
      }
    >
      <label className={labelClass}>
        First name
        <input
          className={inputClass}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoComplete="given-name"
        />
      </label>
      <label className={labelClass}>
        Last name
        <input
          className={inputClass}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          autoComplete="family-name"
        />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Email
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="Optional"
        />
      </label>
      <label className={labelClass}>
        Department
        <input className={inputClass} value={homeDepartment} onChange={(e) => setHomeDepartment(e.target.value)} />
      </label>
      <label className={labelClass}>
        Division
        <input className={inputClass} value={division} onChange={(e) => setDivision(e.target.value)} />
      </label>
      <label className={labelClass}>
        Rank / title
        <input className={inputClass} value={rank} onChange={(e) => setRank(e.target.value)} />
      </label>
      <label className={labelClass}>
        NIH RePORTER profile ID
        <input className={inputClass} value={nihProfileId} onChange={(e) => setNihProfileId(e.target.value)} />
      </label>
      {communities.length > 0 ? (
        <label className={`${labelClass} ${variant === "page" ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"}`}>
          Research community
          <Select
            className="mt-1.5"
            value={researchCommunityId}
            onChange={(e) => setResearchCommunityId(e.target.value)}
          >
            <option value="">None</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <label className={`${labelClass} ${variant === "page" ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"}`}>
        Primary research area
        <input
          className={inputClass}
          value={primaryResearchArea}
          onChange={(e) => setPrimaryResearchArea(e.target.value)}
          placeholder="e.g. tumor immunology"
        />
      </label>
      <div
        className={`flex flex-wrap items-center gap-3 ${
          compact ? "" : variant === "page" ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"
        }`}
      >
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {compact ? (
          <Button type="button" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
        {success ? <p className="text-xs font-medium text-emerald-700">{success}</p> : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </form>
  );

  if (!compact) {
    return formBody;
  }

  return (
    <div className="rounded-lg border border-dashed border-[var(--fo-border)] bg-[var(--fo-paper)] p-3">
      {open ? (
        <>
          <p className="mb-3 text-xs font-semibold text-[var(--fo-display)]">Add new investigator</p>
          {formBody}
        </>
      ) : (
        <button
          type="button"
          className="text-xs font-semibold text-[var(--fo-interaction)] hover:underline"
          onClick={() => setOpen(true)}
        >
          + Add new investigator manually
        </button>
      )}
    </div>
  );
}

export function splitInvestigatorNameQuery(query: string) {
  return splitNameQuery(query);
}
