import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { InvestigatorResearchCommunitySelect } from "@/components/investigators/investigator-research-community-select";
import { InvestigatorRowActions } from "@/components/investigators/investigator-row-actions";

export type InvestigatorDirectoryRow = {
  id: string;
  full_name: string;
  email: string | null;
  home_department: string | null;
  division: string | null;
  nih_profile_id: string | null;
  research_community_id: string | null;
  pipeline_communities: { id: string; label: string } | { id: string; label: string }[] | null;
  investigator_profile_features: {
    science_tags?: string[];
    disease_tags?: string[];
  } | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-[10rem] truncate rounded-full border border-[var(--fo-border)] bg-[var(--fo-paper-2)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--fo-ink-body)]">
      {label.replace(/_/g, " ")}
    </span>
  );
}

export function InvestigatorsDirectoryTable({
  rows,
  researchCommunities,
}: {
  rows: InvestigatorDirectoryRow[];
  researchCommunities: { id: string; label: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-[var(--fo-table-edge)] bg-[var(--fo-table-head)] text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--fo-table-head-fg)]">
          <tr>
            <th className="px-5 py-3 font-medium">Person</th>
            <th className="px-5 py-3 font-medium">Department</th>
            <th className="min-w-[11rem] px-5 py-3 font-medium">Community</th>
            <th className="px-5 py-3 font-medium">RePORTER</th>
            <th className="min-w-[12rem] px-5 py-3 font-medium">Tags</th>
            <th className="w-[6.5rem] px-3 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fo-divider)]">
          {rows.map((r) => {
            const f = r.investigator_profile_features;
            const tags = [...(f?.science_tags ?? []).slice(0, 2), ...(f?.disease_tags ?? []).slice(0, 1)];
            const dept = r.home_department ?? r.division ?? null;

            return (
              <tr key={r.id} className="transition-colors hover:bg-[var(--fo-row-hover)]">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fo-select-tint)] text-xs font-bold text-[var(--fo-interaction)] ring-1 ring-[color-mix(in_srgb,var(--fo-interaction)_18%,transparent)]"
                      aria-hidden
                    >
                      {initials(r.full_name)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/investigators/${r.id}`}
                        className="block font-semibold text-[var(--fo-title)] hover:text-[var(--fo-interaction)] hover:underline"
                      >
                        {r.full_name}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-[var(--fo-ink-muted)]">{r.email ?? "No email on file"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 align-top text-[var(--fo-ink-body)]">
                  {dept ? <span className="line-clamp-2">{dept}</span> : <span className="text-[var(--fo-ink-faint)]">—</span>}
                </td>
                <td className="px-5 py-4 align-top">
                  <InvestigatorResearchCommunitySelect
                    investigatorId={r.id}
                    valueId={r.research_community_id}
                    communities={researchCommunities}
                  />
                </td>
                <td className="px-5 py-4 align-top">
                  {r.nih_profile_id ? (
                    <Badge tone="info">Linked</Badge>
                  ) : (
                    <span className="text-xs text-[var(--fo-ink-faint)]">Not linked</span>
                  )}
                </td>
                <td className="px-5 py-4 align-top">
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <TagChip key={tag} label={tag} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--fo-ink-faint)]">No tags yet</span>
                  )}
                </td>
                <td className="px-3 py-4 align-top">
                  <InvestigatorRowActions investigatorId={r.id} fullName={r.full_name} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
