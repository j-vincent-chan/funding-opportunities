import { Badge } from "@/components/ui/badge";
import type { QuickMatchBuckets } from "@/lib/quick-match/types";

function humanize(tag: string): string {
  return tag.replaceAll("_", " ");
}

export function QuickMatchTagChips({ tags }: { tags: QuickMatchBuckets }) {
  const has =
    tags.research_focal_areas.length +
    tags.disease_areas.length +
    tags.technical_expertise.length;
  if (has === 0) {
    return <p className="text-sm text-[var(--fo-ink-muted)]">No dictionary tags extracted.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {tags.research_focal_areas.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-title)]">
            Research focal areas
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.research_focal_areas.map((t) => (
              <Badge key={t} tone="info">
                {humanize(t)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {tags.disease_areas.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-title)]">
            Disease areas
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.disease_areas.map((t) => (
              <Badge key={t} tone="info">
                {humanize(t)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {tags.technical_expertise.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-title)]">
            Technical expertise
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.technical_expertise.map((t) => (
              <Badge key={t} tone="info">
                {humanize(t)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
