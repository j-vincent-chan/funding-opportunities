export type FundingQuickFilterRow = {
  title: string;
  agency: string | null;
  agency_code: string | null;
  close_date: string | null;
  posted_date: string | null;
  updated_at?: string | null;
  raw_payload_json?: unknown;
  funding_instrument: string | null;
  status: string | null;
  forecasted: boolean | null;
  activity_families?: string[] | null;
};

export function looksLargeCollaborativeGrant(row: FundingQuickFilterRow): boolean {
  const text = `${row.title ?? ""} ${row.funding_instrument ?? ""}`.toLowerCase();
  return (
    /cooperative|collaborative|consortium|multi-project|program project|multi-?pi|center grant|research center/.test(
      text
    ) ||
    row.funding_instrument?.startsWith("U") === true ||
    row.funding_instrument?.startsWith("P") === true
  );
}

export function isEsiCareerDevelopment(row: FundingQuickFilterRow): boolean {
  const text = `${row.title ?? ""} ${row.funding_instrument ?? ""} ${row.activity_families?.join(" ") ?? ""}`;
  return /\b(k0?\d|k12|k99|r25|f3[012]|t32|t35|d43|career development|early[-\s]?stage investigator|\bESI\b|new investigator|pathway to independence|mentored career|individual fellowship)\b/i.test(
    text
  );
}

export function isInvestigatorInitiated(row: FundingQuickFilterRow): boolean {
  const instrument = row.funding_instrument ?? "";
  const text = `${row.title ?? ""} ${instrument}`;
  if (/^R\d|^DP|^SC|^RM/i.test(instrument)) return true;
  return /\b(r0?1|r21|r03|r34|dp[125]|sc1|rm1|investigator-initiated|research project grant)\b/i.test(text);
}

export function isFoundationOpportunity(row: FundingQuickFilterRow): boolean {
  const agency = `${row.agency ?? ""} ${row.agency_code ?? ""}`.toLowerCase();
  const federal =
    /national institutes of health|\bnih\b|national cancer institute|\bnci\b|national institute|centers for disease|\bcdc\b|food and drug|\bfda\b|national science foundation|\bnsf\b|department of|agency for healthcare|\bahrg\b|veterans affairs|\bva\b|department of defense|\bdod\b|darpa|national endowment|national archive|health resources|samhsa|cms\b|hrsa|ahrq|energy|\bdoe\b|agriculture|\busda\b|nasa\b|homeland|justice department|state department|environmental protection|\bepa\b|substance abuse|indian health|federal/;
  if (federal.test(agency)) return false;
  return /foundation|philanthrop|charit|trust|society|fund|hhmi|howard hughes|wellcome|sloan|komen|american .*(association|society|heart|diabetes|cancer)|burroughs|pew charitable|march of dimes|leukemia|lymphoma|parkinson|alzheimer/.test(
    agency
  );
}

export function recommendationScore(
  row: FundingQuickFilterRow,
  inDays: (iso: string | null, days: number) => boolean
): number {
  const text = `${row.title ?? ""} ${row.activity_families?.join(" ") ?? ""}`.toLowerCase();
  let score = 0;
  if (/immun|inflamm|translat|clinical/.test(text)) score += 3;
  if (inDays(row.close_date, 90)) score += 2;
  if (row.status === "open") score += 1;
  if (looksLargeCollaborativeGrant(row)) score += 1;
  return score;
}

export function isRecommendedMatch(
  row: FundingQuickFilterRow,
  inDays: (iso: string | null, days: number) => boolean
): boolean {
  return recommendationScore(row, inDays) >= 3;
}
