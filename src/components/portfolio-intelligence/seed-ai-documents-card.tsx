"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  annotatePortfolioSourceDocuments,
  enrichPortfolioSourceDocumentsFromUrls,
  seedPortfolioSourceDocuments,
  synthesizePortfolioIntelligenceSnapshots,
} from "@/app/actions/portfolio-intelligence-ai";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type SeedResult =
  | { ok: false; error: string }
  | {
      ok: true;
      sourceItemsRead: number;
      documentsUpserted: number;
      chunksWritten: number;
      chunkErrors?: number;
      chunkErrorSamples?: string[];
    };

type AnnotationResult =
  | { ok: false; error: string }
  | {
      ok: true;
      model: string;
      processed: number;
      candidates: number;
      succeeded: number;
      skipped: number;
      skippedNoText: number;
      skippedAlreadyAnnotated: number;
      retryDeferred: number;
      retryExhausted: number;
      failed: number;
      concurrency: number;
      failures: Array<{ documentId: string; title: string; error: string }>;
    };

type UrlEnrichmentResult =
  | { ok: false; error: string }
  | {
      ok: true;
      processed: number;
      enriched: number;
      skippedExisting: number;
      skippedNoUrl: number;
      skippedNoExtractableText: number;
      failed: number;
      failures: Array<{ documentId: string; title: string; error: string }>;
    };

type SynthesisResult =
  | { ok: false; error: string }
  | {
      ok: true;
      model: string;
      windowStart: string;
      windowEnd: string;
      investigator: {
        processed: number;
        succeeded: number;
        failed: number;
        retryDeferred: number;
        retryExhausted: number;
      };
      community: {
        processed: number;
        succeeded: number;
        failed: number;
        retryDeferred: number;
        retryExhausted: number;
      };
      failureSamples: string[];
    };

export function SeedAiDocumentsCard() {
  const [limit, setLimit] = useState(600);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [annotateLimit, setAnnotateLimit] = useState(200);
  const [annotateConcurrency, setAnnotateConcurrency] = useState<1 | 6 | 32>(6);
  const [annotationResult, setAnnotationResult] = useState<AnnotationResult | null>(null);
  const [enrichmentLimit, setEnrichmentLimit] = useState(200);
  const [enrichmentResult, setEnrichmentResult] = useState<UrlEnrichmentResult | null>(null);
  const [synthesisMonths, setSynthesisMonths] = useState(12);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [isPendingSeed, startSeedTransition] = useTransition();
  const [isPendingEnrich, startEnrichTransition] = useTransition();
  const [isPendingAnnotate, startAnnotateTransition] = useTransition();
  const [isPendingSynthesize, startSynthesizeTransition] = useTransition();

  return (
    <Card>
      <CardHeader
        title="Portfolio Intelligence AI Seed"
        description="Backfill source documents and chunks from community signals."
      />
      <CardBody className="space-y-3">
        <label className="block text-sm text-[var(--fo-ink-body)]">
          Max source items to seed
          <input
            type="number"
            min={1}
            max={100000}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 600)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        <Button
          variant="secondary"
          disabled={isPendingSeed}
          onClick={() => {
            startSeedTransition(async () => {
              const res = await seedPortfolioSourceDocuments(limit);
              setResult(res as SeedResult);
            });
          }}
        >
          {isPendingSeed ? "Seeding..." : "Seed source documents"}
        </Button>
        {result ? (
          result.ok ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Read {result.sourceItemsRead} items, upserted {result.documentsUpserted} documents, wrote{" "}
              {result.chunksWritten} chunks.
              {(result.chunkErrors ?? 0) > 0 ? (
                <span className="block mt-1 text-[0.8rem] text-emerald-900">
                  Chunk errors: {result.chunkErrors}.{" "}
                  {result.chunkErrorSamples?.[0] ?? "See server logs."}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {result.error}
            </div>
          )
        ) : null}

        <div className="border-t border-[var(--border)] pt-3" />

        <label className="block text-sm text-[var(--fo-ink-body)]">
          Max source URLs to enrich
          <input
            type="number"
            min={1}
            max={100000}
            value={enrichmentLimit}
            onChange={(e) => setEnrichmentLimit(Number(e.target.value) || 200)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        <Button
          variant="secondary"
          disabled={isPendingEnrich}
          onClick={() => {
            startEnrichTransition(async () => {
              const res = await enrichPortfolioSourceDocumentsFromUrls({
                limit: enrichmentLimit,
                overwrite: false,
              });
              setEnrichmentResult(res as UrlEnrichmentResult);
            });
          }}
        >
          {isPendingEnrich ? "Enriching..." : "Fetch source text (phase 1b)"}
        </Button>
        {enrichmentResult ? (
          enrichmentResult.ok ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Processed {enrichmentResult.processed}; enriched {enrichmentResult.enriched}; existing text{" "}
              {enrichmentResult.skippedExisting}; no URL {enrichmentResult.skippedNoUrl}; no extractable text{" "}
              {enrichmentResult.skippedNoExtractableText}; failed {enrichmentResult.failed}.
              {enrichmentResult.failed > 0 ? (
                <span className="block mt-1 text-[0.8rem] text-emerald-900">
                  First error: {enrichmentResult.failures[0]?.title}: {enrichmentResult.failures[0]?.error}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {enrichmentResult.error}
            </div>
          )
        ) : null}

        <div className="border-t border-[var(--border)] pt-3" />

        <label className="block text-sm text-[var(--fo-ink-body)]">
          Max documents to annotate (single batch, parallel LLM calls)
          <input
            type="number"
            min={1}
            max={100000}
            value={annotateLimit}
            onChange={(e) => setAnnotateLimit(Number(e.target.value) || 200)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm text-[var(--fo-ink-body)]">
          Parallel LLM workers
          <select
            value={annotateConcurrency}
            onChange={(e) => setAnnotateConcurrency(Number(e.target.value) as 1 | 6 | 32)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          >
            <option value={1}>1 (sequential — safest, slowest)</option>
            <option value={6}>6 (balanced default)</option>
            <option value={32}>32 (fastest — more rate limits / cost bursts)</option>
          </select>
        </label>
        <p className="text-xs text-[var(--fo-ink-muted)]">
          CLI default follows env{" "}
          <code className="rounded bg-slate-100 px-1">PORTFOLIO_ANNOTATE_CONCURRENCY</code> (1, 6, or 32). Full
          corpus:{" "}
          <code className="rounded bg-slate-100 px-1">
            npm run annotate-portfolio-documents -- --until-done --concurrency 32
          </code>
        </p>
        <Button
          variant="secondary"
          disabled={isPendingAnnotate}
          onClick={() => {
            startAnnotateTransition(async () => {
              const res = await annotatePortfolioSourceDocuments({
                limit: annotateLimit,
                model: "gpt-4o-mini",
                skipAlreadyAnnotated: true,
                maxAttempts: 3,
                concurrency: annotateConcurrency,
              });
              setAnnotationResult(res as AnnotationResult);
            });
          }}
        >
          {isPendingAnnotate ? "Annotating..." : "Annotate documents (phase 2)"}
        </Button>
        {annotationResult ? (
          annotationResult.ok ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Processed {annotationResult.processed}; LLM candidates {annotationResult.candidates}; annotated{" "}
              {annotationResult.succeeded} (concurrency {annotationResult.concurrency}); skipped{" "}
              {annotationResult.skipped} (no text {annotationResult.skippedNoText}, already done{" "}
              {annotationResult.skippedAlreadyAnnotated}); deferred {annotationResult.retryDeferred}; exhausted{" "}
              {annotationResult.retryExhausted}; failed {annotationResult.failed}.
              {annotationResult.failed > 0 ? (
                <span className="block mt-1 text-[0.8rem] text-emerald-900">
                  First error: {annotationResult.failures[0]?.title}: {annotationResult.failures[0]?.error}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {annotationResult.error}
            </div>
          )
        ) : null}

        <div className="border-t border-[var(--border)] pt-3" />

        <label className="block text-sm text-[var(--fo-ink-body)]">
          Snapshot window (months)
          <input
            type="number"
            min={1}
            max={20000}
            value={synthesisMonths}
            onChange={(e) => setSynthesisMonths(Number(e.target.value) || 12)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        <Button
          variant="secondary"
          disabled={isPendingSynthesize}
          onClick={() => {
            startSynthesizeTransition(async () => {
              const res = await synthesizePortfolioIntelligenceSnapshots({
                months: synthesisMonths,
                model: "gpt-4o-mini",
                maxAttempts: 3,
              });
              setSynthesisResult(res as SynthesisResult);
            });
          }}
        >
          {isPendingSynthesize ? "Synthesizing..." : "Generate snapshots (phase 3)"}
        </Button>
        {synthesisResult ? (
          synthesisResult.ok ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Window {synthesisResult.windowStart} to {synthesisResult.windowEnd}. Investigator snapshots:{" "}
              {synthesisResult.investigator.succeeded}/{synthesisResult.investigator.processed} succeeded.
              {" "}Deferred: {synthesisResult.investigator.retryDeferred}; exhausted:{" "}
              {synthesisResult.investigator.retryExhausted}.
              Community snapshots: {synthesisResult.community.succeeded}/{synthesisResult.community.processed}{" "}
              succeeded. Deferred: {synthesisResult.community.retryDeferred}; exhausted:{" "}
              {synthesisResult.community.retryExhausted}.
              {synthesisResult.failureSamples.length > 0 ? (
                <span className="block mt-1 text-[0.8rem] text-emerald-900">
                  First error: {synthesisResult.failureSamples[0]}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {synthesisResult.error}
            </div>
          )
        ) : null}
      </CardBody>
    </Card>
  );
}
