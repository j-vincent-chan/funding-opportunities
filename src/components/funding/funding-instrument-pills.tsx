/** Instrument chips — semantic grant / co-op; UCSF-aligned cool fallbacks. */
const ACCENT_FALLBACK = [
  "bg-[#E4E8F7] text-[#4D5E93] ring-1 ring-inset ring-[rgba(77,94,147,0.2)]",
  "bg-[#DDEEF3] text-[#34697A] ring-1 ring-inset ring-[rgba(52,105,122,0.2)]",
  "bg-[#DDF2F3] text-[#2A6570] ring-1 ring-inset ring-[rgba(42,101,112,0.18)]",
  "bg-[#E2EDF6] text-[#355A7A] ring-1 ring-inset ring-[rgba(53,90,122,0.18)]",
  "bg-[#E5EAF5] text-[#4A5B82] ring-1 ring-inset ring-[rgba(74,91,130,0.16)]",
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function instrumentToneClass(display: string, index: number): string {
  const d = display.toLowerCase();
  if (/\bgrants?\b/.test(d)) {
    return "bg-[#E4E8F7] text-[#4D5E93] ring-1 ring-inset ring-[rgba(77,94,147,0.22)]";
  }
  if (/co-op|cooperative/.test(d)) {
    return "bg-[#DDEEF3] text-[#34697A] ring-1 ring-inset ring-[rgba(52,105,122,0.22)]";
  }
  const h = hashString(display.toLowerCase());
  return ACCENT_FALLBACK[(h + index * 5) % ACCENT_FALLBACK.length];
}

/**
 * Turn API-style slugs into readable labels, e.g. `cooperative_agreement` → "Co-op agreement" (shorter table-friendly wording).
 */
export function humanizeInstrumentLabel(raw: string): string {
  let s = raw
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return s;
  s = s.toLowerCase();
  s = s.charAt(0).toUpperCase() + s.slice(1);

  const acronyms = ["nih", "nsf", "sbir", "sttr", "fda", "cdc", "hhs", "darpa", "arpa"];
  for (const a of acronyms) {
    s = s.replace(new RegExp(`\\b${a}\\b`, "gi"), a.toUpperCase());
  }

  s = s.replace(/\b([rfpkug])(\d{2}[a-z]?)\b/gi, (_, letter: string, rest: string) => {
    return letter.toUpperCase() + rest.toLowerCase();
  });

  const collapsed = s.toLowerCase().replace(/\s+/g, " ").trim();
  if (collapsed === "cooperative agreement") return "Co-op agreement";
  if (collapsed === "cooperative agreements") return "Co-op agreements";

  return s;
}

function splitInstruments(raw: string): string[] {
  return raw
    .split(/\s*[,;]\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function FundingInstrumentPills({ value }: { value: string | null | undefined }) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return <span className="text-[0.6875rem] font-medium text-[#5F7387]">—</span>;
  }
  const parts = splitInstruments(text);
  if (parts.length === 0) {
    return <span className="text-[0.6875rem] font-medium text-[#5F7387]">—</span>;
  }
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
      {parts.map((part, i) => {
        const display = humanizeInstrumentLabel(part);
        const tone = instrumentToneClass(display, i);
        return (
          <span
            key={`${i}-${part}`}
            title={display}
            className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold leading-tight tracking-[0.02em] ${tone}`}
          >
            {display}
          </span>
        );
      })}
    </span>
  );
}
