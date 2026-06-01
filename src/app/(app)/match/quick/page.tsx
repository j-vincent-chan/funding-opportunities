import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function AiAssistedMatchesPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="app-page-title">AI-Assisted Matches</h1>
        <p className="app-page-description">
          Second in Match after{" "}
          <Link href="/match/saved" className="font-semibold text-[var(--fo-interaction)] underline">
            Opportunity pipeline
          </Link>
          : deterministic overlap between controlled tags inferred from funding text and tags normalized from PI CSV
          fields plus stored profile features. Each notice and investigator profile lists the top 10 matches by score,
          with short explanations.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="From a notice" description="See who fits this opportunity." />
          <CardBody className="space-y-3 text-sm text-[var(--fo-ink-body)]">
            <p>
              Open any opportunity from{" "}
              <Link href="/funding-opportunities" className="font-semibold text-[var(--fo-interaction)] underline">
                Search
              </Link>
              . The detail page shows AI-Assisted Matches tags and the top 10 investigators with score and rationale.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="From a PI" description="See which notices overlap their profile." />
          <CardBody className="space-y-3 text-sm text-[var(--fo-ink-body)]">
            <p>
              Open an investigator in{" "}
              <Link href="/investigators" className="font-semibold text-[var(--fo-interaction)] underline">
                People
              </Link>
              . The profile shows AI-Assisted Matches tags and the top 10 opportunities (from recently synced rows).
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Tuning" description="Where to edit behavior." />
        <CardBody className="space-y-2 text-sm text-[var(--fo-ink-body)]">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-[var(--fo-title)]">Taxonomy & synonyms:</span>{" "}
              <code className="rounded bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-xs">src/lib/normalization/vocab-config.ts</code>
            </li>
            <li>
              <span className="font-medium text-[var(--fo-title)]">Overlap weights:</span>{" "}
              <code className="rounded bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-xs">src/lib/quick-match/scoring-weights.ts</code>
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
