import type { QuickMatchBuckets } from "@/lib/quick-match/types";

function humanizeTag(tag: string): string {
  return tag.replaceAll("_", " ");
}

const PILL_BASE =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold leading-tight tracking-[0.01em] ring-1 ring-inset";

function pillClassForBucket(bucket: keyof QuickMatchBuckets): string {
  if (bucket === "research_focal_areas") {
    return `${PILL_BASE} bg-[var(--fo-select-tint)] text-[var(--fo-interaction)] ring-[color-mix(in_srgb,var(--fo-brand)_22%,transparent)]`;
  }
  if (bucket === "disease_areas") {
    return `${PILL_BASE} bg-[var(--fo-sage-soft)] text-[#2f6b45] ring-[color-mix(in_srgb,var(--fo-sage)_28%,transparent)]`;
  }
  return `${PILL_BASE} bg-[var(--fo-mineral)] text-[#26415e] ring-[color-mix(in_srgb,var(--fo-border-strong)_45%,transparent)]`;
}

const RESEARCH_FIT_GROUPS: {
  key: keyof QuickMatchBuckets;
  title: string;
}[] = [
  { key: "research_focal_areas", title: "Scientific Topics" },
  { key: "disease_areas", title: "Disease Areas" },
  { key: "technical_expertise", title: "Methods & Technologies" },
];

export function ResearchFitTagPills({ tags }: { tags: QuickMatchBuckets }) {
  return (
    <div className="space-y-4">
      {RESEARCH_FIT_GROUPS.map(({ key, title }) => {
        const values = tags[key];
        return (
          <div key={key}>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--fo-ink-muted)]">
              {title}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {values.length > 0 ? (
                values.map((tag) => (
                  <span key={tag} className={pillClassForBucket(key)}>
                    {humanizeTag(tag)}
                  </span>
                ))
              ) : (
                <span className="text-[0.75rem] font-medium text-[var(--fo-ink-muted)]">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
