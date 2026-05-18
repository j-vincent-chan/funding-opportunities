import { z } from "zod";
import { normalizeCsvHeader } from "@/lib/csv/normalize-csv-header";

const optionalTrim = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v == null ? "" : v).trim());

export const investigatorCsvRowSchema = z.object({
  first_name: z.string().trim().min(1, "First name required"),
  last_name: z.string().trim().min(1, "Last name required"),
  email: z
    .string()
    .trim()
    .max(320)
    .optional()
    .default("")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email"),
  home_department: optionalTrim(300),
  division: optionalTrim(300),
  rank: optionalTrim(120),
  affiliations: optionalTrim(4000),
  primary_research_area: optionalTrim(500),
  secondary_research_areas: optionalTrim(4000),
  primary_disease_focus: optionalTrim(500),
  secondary_disease_focuses: optionalTrim(4000),
  technological_expertise: optionalTrim(8000),
  clinical_samples: optionalTrim(2000),
  biobanks: optionalTrim(2000),
  small_grants: optionalTrim(2000),
  large_grants: optionalTrim(2000),
  nih_profile_id: optionalTrim(128),
  research_summary: optionalTrim(16_000),
});

export type InvestigatorCsvRow = z.infer<typeof investigatorCsvRowSchema>;

const HEADER_ALIASES: Record<string, keyof InvestigatorCsvRow | "skip"> = {
  first_name: "first_name",
  firstname: "first_name",
  fname: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  lname: "last_name",
  email: "email",
  home_department: "home_department",
  department: "home_department",
  dept: "home_department",
  division: "division",
  rank: "rank",
  title: "rank",
  affiliations: "affiliations",
  primary_research_area: "primary_research_area",
  secondary_research_areas: "secondary_research_areas",
  primary_disease_focus: "primary_disease_focus",
  secondary_disease_focuses: "secondary_disease_focuses",
  technological_expertise: "technological_expertise",
  clinical_samples: "clinical_samples",
  biobanks: "biobanks",
  small_grants: "small_grants",
  large_grants: "large_grants",
  nih_profile_id: "nih_profile_id",
  nih_reporter_id: "nih_profile_id",
  reporter_profile_id: "nih_profile_id",
  research_summary: "research_summary",
  summary: "research_summary",
};

const KNOWN = new Set(Object.keys(investigatorCsvRowSchema.shape));

function mapHeader(header: string): string | null {
  const n = normalizeCsvHeader(header);
  const alias = HEADER_ALIASES[n];
  if (alias === "skip") return null;
  if (alias) return alias;
  if (KNOWN.has(n)) return n;
  return null;
}

export function flattenInvestigatorRow(rec: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [header, value] of Object.entries(rec)) {
    const key = mapHeader(header);
    if (!key) continue;
    out[key] = String(value ?? "").trim();
  }
  return out;
}

export function parseAffiliationsJson(raw: string): unknown[] {
  const t = raw.trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t);
    return Array.isArray(j) ? j : [j];
  } catch {
    return t.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
  }
}

export function rowToInvestigatorCsv(
  rec: Record<string, unknown>,
  line: number
): { ok: true; data: InvestigatorCsvRow } | { ok: false; line: number; error: string } {
  const flat = flattenInvestigatorRow(rec);
  const parsed = investigatorCsvRowSchema.safeParse(flat);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, line, error: msg };
  }
  return { ok: true, data: parsed.data };
}
