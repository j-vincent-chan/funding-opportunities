/**
 * Derive NIH activity code (e.g. R01, U01, P01) from RePORTER project numbers.
 * Typical formats: 5R01GM123456, 1R01HL123456-01A1
 */

const KNOWN_PREFIX = new Set([
  "R01",
  "R21",
  "R03",
  "R15",
  "R33",
  "R34",
  "R35",
  "R37",
  "R56",
  "U01",
  "U10",
  "U19",
  "U24",
  "U41",
  "U54",
  "P01",
  "P20",
  "P30",
  "P41",
  "P50",
  "K01",
  "K08",
  "K12",
  "K23",
  "K24",
  "K99",
  "F31",
  "F32",
  "T32",
]);

export function nihActivityCodeFromProjectNum(projectNum: string | null | undefined): string | null {
  if (!projectNum?.trim()) return null;
  const s = projectNum.replace(/\s+/g, "").toUpperCase();
  const m = s.match(/\d*([A-Z]\d{2})(?=[A-Z])/);
  const code = m?.[1] ?? null;
  if (code && (KNOWN_PREFIX.has(code) || /^[A-Z]\d{2}$/.test(code))) return code;
  return code;
}

export function bucketNihMechanism(code: string | null): string {
  if (!code) return "Unknown";
  if (code.startsWith("R")) return `R-series (${code})`;
  if (code.startsWith("U")) return `U-series (${code})`;
  if (code.startsWith("P")) return `P-series (${code})`;
  if (code.startsWith("K") || code.startsWith("F") || code.startsWith("T"))
    return `Training / career (${code})`;
  return code;
}

/** Fewer columns for heatmaps (R / U / P / training / other). */
export function bucketNihMechanismCoarse(code: string | null): string {
  if (!code) return "Unknown";
  if (code.startsWith("R")) return "R-awards (R01, R21, …)";
  if (code.startsWith("U")) return "U-awards (U01, U19, …)";
  if (code.startsWith("P")) return "P-centers (P01, P30, …)";
  if (code.startsWith("K") || code.startsWith("F") || code.startsWith("T"))
    return "Training / career (K, F, T)";
  return "Other NIH activity codes";
}
