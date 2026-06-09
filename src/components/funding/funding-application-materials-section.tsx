"use client";

import {
  formatApplicationDocumentSize,
  type FundingApplicationMaterials,
} from "@/lib/funding-opportunities/funding-opportunity-application-materials";
import { openExternalFundingUrl } from "@/lib/funding-opportunities/source-url";

function DocumentIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5 2.5h4.5L12.5 5.5V13a1 1 0 01-1 1H5a1 1 0 01-1-1v-10a1 1 0 011-1z" strokeLinejoin="round" />
      <path d="M9 2.5V6h3.5" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 3.5h6.5V10M12.5 3.5L3.5 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FundingApplicationMaterialsSection({
  materials,
}: {
  materials: FundingApplicationMaterials;
}) {
  const hasActions = !!(materials.previewPackageUrl || materials.startApplicationUrl);
  const hasDocuments = materials.documents.length > 0;
  const hasNihLink = !!materials.nihStandardFormsUrl;
  const hasAssist = !!materials.assistUrl;

  if (!hasActions && !hasDocuments && !materials.statusMessage && !hasNihLink) {
    return null;
  }

  return (
    <section className="mt-6 border-t border-[var(--fo-divider)] pt-5">
      <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
        Application materials
      </h3>

      {materials.statusMessage ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--fo-ink-muted)]">{materials.statusMessage}</p>
      ) : null}

      {(hasActions || hasAssist) && (
        <div className="mt-3 rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper-2)] p-3.5">
          <div className="flex flex-wrap gap-2">
            {materials.previewPackageUrl ? (
              <button
                type="button"
                onClick={() => openExternalFundingUrl(materials.previewPackageUrl!)}
                className="inline-flex min-w-[10rem] flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--fo-interaction)] bg-white px-3 py-2 text-left text-xs font-semibold text-[var(--fo-interaction)] transition-colors hover:bg-[var(--fo-select-tint)] sm:flex-none sm:justify-start"
              >
                <DocumentIcon />
                <span className="min-w-0">
                  <span className="block">Preview required forms</span>
                  <span className="block text-[0.65rem] font-medium text-[var(--fo-ink-muted)]">
                    {materials.previewPackageLabel}
                  </span>
                </span>
              </button>
            ) : null}

            {materials.startApplicationUrl ? (
              <button
                type="button"
                onClick={() => openExternalFundingUrl(materials.startApplicationUrl!)}
                className="inline-flex min-w-[10rem] flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--fo-interaction)] bg-[var(--fo-interaction)] px-3 py-2 text-left text-xs font-semibold text-white transition-colors hover:bg-[var(--fo-interaction-hover)] sm:flex-none sm:justify-start"
              >
                <ExternalArrowIcon />
                <span className="min-w-0">
                  <span className="block">{materials.startApplicationLabel}</span>
                  <span className="block text-[0.65rem] font-medium text-white/80">
                    {materials.startApplicationSubtitle}
                  </span>
                </span>
              </button>
            ) : null}
          </div>

          {hasAssist && materials.assistUrl !== materials.startApplicationUrl ? (
            <p className="mt-2.5 text-xs text-[var(--fo-ink-muted)]">
              NIH submission:{" "}
              <button
                type="button"
                onClick={() => openExternalFundingUrl(materials.assistUrl!)}
                className="font-semibold text-[var(--fo-interaction)] hover:underline"
              >
                Open ASSIST ↗
              </button>
            </p>
          ) : null}
        </div>
      )}

      {hasDocuments ? (
        <ul className="mt-3 space-y-1.5">
          {materials.documents.map((doc) => {
            const sizeLabel = formatApplicationDocumentSize(doc.fileSizeBytes);
            return (
              <li key={`${doc.downloadUrl}-${doc.fileName}`}>
                <button
                  type="button"
                  onClick={() => openExternalFundingUrl(doc.downloadUrl)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--fo-border)] bg-white px-3 py-2 text-left transition-colors hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-row-hover)]"
                >
                  <DocumentIcon />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--fo-title)]">
                      {doc.fileName}
                    </span>
                    {doc.folderType ? (
                      <span className="block truncate text-[0.65rem] text-[var(--fo-ink-muted)]">
                        {doc.folderType}
                      </span>
                    ) : null}
                  </span>
                  {sizeLabel ? (
                    <span className="shrink-0 text-[0.65rem] font-medium tabular-nums text-[var(--fo-ink-muted)]">
                      {sizeLabel}
                    </span>
                  ) : null}
                  <span className="shrink-0 text-xs font-semibold text-[var(--fo-interaction)]">Download</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="mt-3 text-[0.7rem] leading-relaxed text-[var(--fo-ink-muted)]">
        Narrative, biosketch, and other attachments are not blank templates — prepare them per FOA
        instructions.
      </p>

      {hasNihLink ? (
        <p className="mt-1.5 text-xs text-[var(--fo-ink-muted)]">
          <button
            type="button"
            onClick={() => openExternalFundingUrl(materials.nihStandardFormsUrl!)}
            className="font-semibold text-[var(--fo-interaction)] hover:underline"
          >
            NIH standard forms ↗
          </button>
        </p>
      ) : null}
    </section>
  );
}
