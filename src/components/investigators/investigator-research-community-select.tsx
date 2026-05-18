"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvestigatorResearchCommunityAction } from "@/app/actions/investigators-pipeline";
import { Select } from "@/components/ui/select";

export type ResearchCommunityOption = { id: string; label: string };

export function InvestigatorResearchCommunitySelect({
  investigatorId,
  valueId,
  communities,
}: {
  investigatorId: string;
  valueId: string | null;
  communities: ResearchCommunityOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await updateInvestigatorResearchCommunityAction(fd);
          router.refresh();
        });
      }}
      className="min-w-[10rem]"
    >
      <input type="hidden" name="investigatorId" value={investigatorId} />
      <Select
        name="researchCommunityId"
        disabled={pending}
        className="w-full max-w-[14rem] border-[var(--fo-border)] bg-[var(--fo-paper-2)] text-xs"
        defaultValue={valueId ?? ""}
        onChange={(e) => {
          e.currentTarget.form?.requestSubmit();
        }}
      >
        <option value="">Uncategorized</option>
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
