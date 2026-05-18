import {
  bucketNihMechanismCoarse,
  nihActivityCodeFromProjectNum,
} from "@/lib/community/nih-mechanism";
import { normalizeReporterAgencyField } from "@/lib/community/reporter-display";

export type HeatmapGrid = {
  rowLabels: string[];
  colLabels: string[];
  /** row-major: values[rowIndex][colIndex] */
  values: number[][];
  max: number;
};

function topKeys(counts: Map<string, number>, n: number): string[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function displayDept(d: string | null | undefined): string {
  const t = d?.trim();
  if (!t) return "Unspecified";
  return t.length > 48 ? `${t.slice(0, 46)}…` : t;
}

function displayTheme(t: string | null | undefined): string {
  const s = t?.trim();
  if (!s) return "Unspecified";
  const u = s.length > 1 ? s[0].toUpperCase() + s.slice(1) : s.toUpperCase();
  return u.length > 40 ? `${u.slice(0, 38)}…` : u;
}

/** Department (home or division) × primary science theme (first tag). */
export function buildDeptThemeMatrix(
  rows: { home_department: string | null; division: string | null; science_tags: string[] }[],
  maxRows: number,
  maxCols: number
): HeatmapGrid {
  const cell = new Map<string, number>();
  const rowCounts = new Map<string, number>();
  const colCounts = new Map<string, number>();

  for (const r of rows) {
    const dept = displayDept(r.home_department?.trim() || r.division?.trim() || null);
    const theme = displayTheme(r.science_tags[0] ?? null);
    rowCounts.set(dept, (rowCounts.get(dept) ?? 0) + 1);
    colCounts.set(theme, (colCounts.get(theme) ?? 0) + 1);
    const k = `${dept}\t${theme}`;
    cell.set(k, (cell.get(k) ?? 0) + 1);
  }

  const rowLabels = topKeys(rowCounts, maxRows);
  const colLabels = topKeys(colCounts, maxCols);
  const values: number[][] = rowLabels.map(() => colLabels.map(() => 0));
  let max = 0;
  for (let ri = 0; ri < rowLabels.length; ri += 1) {
    for (let ci = 0; ci < colLabels.length; ci += 1) {
      const v = cell.get(`${rowLabels[ri]}\t${colLabels[ci]}`) ?? 0;
      values[ri][ci] = v;
      if (v > max) max = v;
    }
  }
  return { rowLabels, colLabels, values, max: max || 1 };
}

export type YearTrendPoint = {
  year: string;
  publications: number;
  nihGrantRows: number;
};

export function buildPublicationGrantTrends(
  pubDates: (string | null)[],
  grantFiscalYears: (number | null)[]
): YearTrendPoint[] {
  const pubByYear = new Map<string, number>();
  for (const d of pubDates) {
    if (!d?.trim()) continue;
    const y = d.slice(0, 4);
    if (!/^\d{4}$/.test(y)) continue;
    pubByYear.set(y, (pubByYear.get(y) ?? 0) + 1);
  }
  const grantByYear = new Map<string, number>();
  for (const fy of grantFiscalYears) {
    if (fy == null || Number.isNaN(fy)) continue;
    const y = String(fy);
    grantByYear.set(y, (grantByYear.get(y) ?? 0) + 1);
  }
  const years = new Set<string>([
    ...Array.from(pubByYear.keys()),
    ...Array.from(grantByYear.keys()),
  ]);
  const sorted = Array.from(years).sort();
  const recent = sorted.slice(-8);
  return recent.map((year) => ({
    year,
    publications: pubByYear.get(year) ?? 0,
    nihGrantRows: grantByYear.get(year) ?? 0,
  }));
}

/** Ordered engagement pipeline counts (one row per engagement — current status). */
export const ENGAGEMENT_STATUS_ORDER = [
  "identified",
  "matched",
  "contacted",
  "engaged",
  "drafting",
  "internal_review",
  "submitted",
  "funded",
  "declined",
  "dormant",
] as const;

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
};

export function buildStrategistFunnel(statuses: string[]): FunnelStage[] {
  const m = new Map<string, number>();
  for (const s of statuses) {
    const k = s || "unknown";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return ENGAGEMENT_STATUS_ORDER.filter((s) => (m.get(s) ?? 0) > 0).map((s) => ({
    key: s,
    label: s.replace(/_/g, " "),
    count: m.get(s) ?? 0,
  }));
}

export function buildGroupedPipeline(statuses: string[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of statuses) {
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  const g = (keys: string[]) => keys.reduce((a, k) => a + (m.get(k) ?? 0), 0);
  return [
    { label: "Opportunities identified", count: g(["identified", "matched"]) },
    { label: "Investigators in outreach", count: g(["contacted", "engaged"]) },
    { label: "Proposals in development", count: g(["drafting", "internal_review"]) },
    { label: "Submitted", count: g(["submitted"]) },
    { label: "Funded", count: g(["funded"]) },
  ];
}

/** Terminal / inactive statuses excluded from active pipeline view. */
export function buildTerminalEngagementCounts(statuses: string[]): {
  declined: number;
  dormant: number;
} {
  let declined = 0;
  let dormant = 0;
  for (const s of statuses) {
    if (s === "declined") declined += 1;
    if (s === "dormant") dormant += 1;
  }
  return { declined, dormant };
}

export function buildMechanismByDeptHeatmap(
  rows: { home_department: string | null; division: string | null; project_num: string | null }[],
  maxRows: number,
  maxCols: number
): HeatmapGrid {
  const deptCounts = new Map<string, number>();
  const mechCounts = new Map<string, number>();
  for (const r of rows) {
    const dept = displayDept(r.home_department?.trim() || r.division?.trim() || null);
    const code = nihActivityCodeFromProjectNum(r.project_num);
    const bucket = bucketNihMechanismCoarse(code);
    deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
    mechCounts.set(bucket, (mechCounts.get(bucket) ?? 0) + 1);
  }
  const rowLabels = topKeys(deptCounts, maxRows);
  const colLabels = topKeys(mechCounts, maxCols);
  const cell = new Map<string, number>();
  for (const r of rows) {
    const dept = displayDept(r.home_department?.trim() || r.division?.trim() || null);
    const code = nihActivityCodeFromProjectNum(r.project_num);
    const bucket = bucketNihMechanismCoarse(code);
    const k = `${dept}\t${bucket}`;
    cell.set(k, (cell.get(k) ?? 0) + 1);
  }
  const values: number[][] = rowLabels.map(() => colLabels.map(() => 0));
  let max = 0;
  for (let ri = 0; ri < rowLabels.length; ri += 1) {
    for (let ci = 0; ci < colLabels.length; ci += 1) {
      const v = cell.get(`${rowLabels[ri]}\t${colLabels[ci]}`) ?? 0;
      values[ri][ci] = v;
      if (v > max) max = v;
    }
  }
  return { rowLabels, colLabels, values, max: max || 1 };
}

/** Primary science theme × NIH IC (from cached grant rows). */
export function buildThemeIcHeatmap(
  pairs: { theme: string | null; ic_name: unknown }[],
  maxRows: number,
  maxCols: number
): HeatmapGrid {
  const rowCounts = new Map<string, number>();
  const colCounts = new Map<string, number>();
  const normPairs = pairs.map((p) => ({
    theme: displayTheme(p.theme),
    ic: normalizeReporterAgencyField(p.ic_name) ?? "Unknown IC",
  }));
  for (const p of normPairs) {
    rowCounts.set(p.theme, (rowCounts.get(p.theme) ?? 0) + 1);
    colCounts.set(p.ic, (colCounts.get(p.ic) ?? 0) + 1);
  }
  const rowLabels = topKeys(rowCounts, maxRows);
  const colLabels = topKeys(colCounts, maxCols);
  const cell = new Map<string, number>();
  for (const p of normPairs) {
    const k = `${p.theme}\t${p.ic}`;
    cell.set(k, (cell.get(k) ?? 0) + 1);
  }
  const values: number[][] = rowLabels.map(() => colLabels.map(() => 0));
  let max = 0;
  for (let ri = 0; ri < rowLabels.length; ri += 1) {
    for (let ci = 0; ci < colLabels.length; ci += 1) {
      const v = cell.get(`${rowLabels[ri]}\t${colLabels[ci]}`) ?? 0;
      values[ri][ci] = v;
      if (v > max) max = v;
    }
  }
  return { rowLabels, colLabels, values, max: max || 1 };
}

/** Method tags × department — counts investigator-method pairs (one per tag per investigator). */
export function buildCapabilityMatrix(
  rows: {
    home_department: string | null;
    division: string | null;
    method_tags: string[];
  }[],
  maxRows: number,
  maxCols: number
): HeatmapGrid {
  const cell = new Map<string, number>();
  const methodCounts = new Map<string, number>();
  const deptCounts = new Map<string, number>();

  for (const r of rows) {
    const dept = displayDept(r.home_department?.trim() || r.division?.trim() || null);
    deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
    const methods = r.method_tags?.length ? r.method_tags : [""];
    for (const raw of methods) {
      const m = raw?.trim() ? displayTheme(raw) : "Unspecified method";
      methodCounts.set(m, (methodCounts.get(m) ?? 0) + 1);
      const k = `${dept}\t${m}`;
      cell.set(k, (cell.get(k) ?? 0) + 1);
    }
  }

  const rowLabels = topKeys(deptCounts, maxRows);
  const colLabels = topKeys(methodCounts, maxCols);
  const values: number[][] = rowLabels.map(() => colLabels.map(() => 0));
  let max = 0;
  for (let ri = 0; ri < rowLabels.length; ri += 1) {
    for (let ci = 0; ci < colLabels.length; ci += 1) {
      const v = cell.get(`${rowLabels[ri]}\t${colLabels[ci]}`) ?? 0;
      values[ri][ci] = v;
      if (v > max) max = v;
    }
  }
  return { rowLabels, colLabels, values, max: max || 1 };
}

export type RankEngagementRow = { rankLabel: string; total: number; engaged: number };

export function buildEquityByRank(
  investigators: { id: string; rank: string | null }[],
  engagedIds: Set<string>
): RankEngagementRow[] {
  const byRank = new Map<string, { total: number; engaged: number }>();
  for (const inv of investigators) {
    const label = inv.rank?.trim() || "Unspecified";
    const cur = byRank.get(label) ?? { total: 0, engaged: 0 };
    cur.total += 1;
    if (engagedIds.has(inv.id)) cur.engaged += 1;
    byRank.set(label, cur);
  }
  return Array.from(byRank.entries())
    .map(([rankLabel, v]) => ({ rankLabel, ...v }))
    .sort((a, b) => b.total - a.total);
}

export type OutcomeSnapshot = {
  submitted: number;
  funded: number;
  declined: number;
  /** funded / (submitted + funded + declined) when denominator &gt; 0 */
  successRate: number | null;
};

export function buildOutcomeSnapshot(statuses: string[]): OutcomeSnapshot {
  let submitted = 0;
  let funded = 0;
  let declined = 0;
  for (const s of statuses) {
    if (s === "submitted") submitted += 1;
    else if (s === "funded") funded += 1;
    else if (s === "declined") declined += 1;
  }
  const denom = submitted + funded + declined;
  const successRate = denom > 0 ? funded / denom : null;
  return { submitted, funded, declined, successRate };
}

export type EngagementTier = {
  tier: string;
  count: number;
  description: string;
};

export function buildNetworkSample(
  rawEdges: { investigator_a_id: string; investigator_b_id: string; evidence_count: number }[],
  nameById: Map<string, string>,
  maxNodes: number,
  maxEdges: number
): {
  nodes: { id: string; label: string }[];
  edges: { a: string; b: string; weight: number }[];
} {
  const sorted = [...rawEdges].sort((a, b) => (b.evidence_count ?? 0) - (a.evidence_count ?? 0));
  let pick = sorted.slice(0, maxEdges);
  const ids = new Set<string>();
  for (const e of pick) {
    ids.add(e.investigator_a_id);
    ids.add(e.investigator_b_id);
  }

  while (ids.size > maxNodes) {
    const deg = new Map<string, number>();
    Array.from(ids).forEach((id) => deg.set(id, 0));
    for (const e of pick) {
      if (ids.has(e.investigator_a_id) && ids.has(e.investigator_b_id)) {
        deg.set(e.investigator_a_id, (deg.get(e.investigator_a_id) ?? 0) + 1);
        deg.set(e.investigator_b_id, (deg.get(e.investigator_b_id) ?? 0) + 1);
      }
    }
    let minId: string | null = null;
    let minD = Infinity;
    Array.from(ids).forEach((id) => {
      const d = deg.get(id) ?? 0;
      if (d < minD) {
        minD = d;
        minId = id;
      }
    });
    if (!minId) break;
    ids.delete(minId);
    pick = pick.filter(
      (e) => ids.has(e.investigator_a_id) && ids.has(e.investigator_b_id)
    );
  }

  const nodes = Array.from(ids).map((id) => ({
    id,
    label: nameById.get(id) ?? id.slice(0, 8),
  }));
  const edges = pick
    .filter((e) => ids.has(e.investigator_a_id) && ids.has(e.investigator_b_id))
    .map((e) => ({
      a: e.investigator_a_id,
      b: e.investigator_b_id,
      weight: Math.max(1, e.evidence_count ?? 1),
    }));
  return { nodes, edges };
}

/** Mutually exclusive depth per investigator (funded &gt; submitted &gt; active &gt; dormant-only &gt; none). */
export function buildExclusiveEngagementStages(
  totalInvestigators: number,
  engagements: { investigator_id: string; status: string }[]
): EngagementTier[] {
  const byInv = new Map<string, Set<string>>();
  for (const e of engagements) {
    const id = e.investigator_id;
    if (!id) continue;
    const set = byInv.get(id) ?? new Set<string>();
    set.add(e.status);
    byInv.set(id, set);
  }

  let active = 0;
  let submittedOnly = 0;
  let funded = 0;
  let dormantOnly = 0;

  const preSubmit = new Set([
    "identified",
    "matched",
    "contacted",
    "engaged",
    "drafting",
    "internal_review",
  ]);
  const terminal = new Set(["declined", "dormant"]);

  Array.from(byInv.values()).forEach((statuses) => {
    const st = Array.from(statuses);
    if (statuses.has("funded")) {
      funded += 1;
      return;
    }
    if (statuses.has("submitted")) {
      submittedOnly += 1;
      return;
    }
    const onlyTerminal = st.length > 0 && st.every((s) => terminal.has(s));
    if (onlyTerminal) {
      dormantOnly += 1;
      return;
    }
    if (st.some((s) => preSubmit.has(s))) {
      active += 1;
      return;
    }
    active += 1;
  });

  const none = Math.max(0, totalInvestigators - byInv.size);

  return [
    {
      tier: "Not yet reached",
      count: none,
      description: "No engagement rows for this investigator.",
    },
    {
      tier: "Active cultivation",
      count: active,
      description: "Working the pipeline before submission (identified through internal review).",
    },
    {
      tier: "Submitted (awaiting outcome)",
      count: submittedOnly,
      description: "At least one engagement submitted; none funded yet.",
    },
    {
      tier: "Awarded / funded",
      count: funded,
      description: "At least one engagement marked funded.",
    },
    {
      tier: "Paused / closed (declined or dormant)",
      count: dormantOnly,
      description: "Only terminal statuses on file — revisit when strategy shifts.",
    },
  ];
}
