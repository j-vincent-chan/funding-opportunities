import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import { stripHtmlToText } from "@/lib/formatting/html";

const MAX_DESC_LEN = 500_000;

/** Prefer DB column; recover from raw Simpler payload if we previously stored "[object Object]". */
export function resolveFundingOpportunityDescription(fo: {
  description?: unknown;
  raw_payload_json?: unknown;
}): string {
  const direct = coercePlainTextFromUnknown(fo.description, MAX_DESC_LEN);
  if (direct && direct !== "[object Object]") return stripHtmlToText(direct);
  const raw = fo.raw_payload_json;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const sd = r.summary_description;
    if (typeof sd === "string" && sd.trim()) {
      return stripHtmlToText(sd).slice(0, MAX_DESC_LEN).trim();
    }
    const text = coercePlainTextFromUnknown(
      r.summary ?? r.description ?? r.opportunity_description,
      MAX_DESC_LEN
    );
    if (text) return stripHtmlToText(text);
    return "";
  }
  return stripHtmlToText(direct);
}
