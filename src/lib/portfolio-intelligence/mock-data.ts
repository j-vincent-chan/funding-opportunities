export type SignalSource =
  | "publications"
  | "grants"
  | "news"
  | "honors"
  | "clinical_trials"
  | "patents"
  | "social";

export type MatchStrength = "high" | "medium" | "low";
export type PortfolioViewMode = "community" | "investigator";

export interface WatchedCommunity {
  id: string;
  name: string;
}

export interface PortfolioMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  comparison: string;
  tone: "positive" | "neutral";
}

export interface Theme {
  id: string;
  name: string;
  percentage: number;
  signalCount: number;
  color: string;
}

export interface ResearchSignal {
  date: string;
  thisPeriod: number;
  priorPeriod: number;
}

export interface FundingMechanismSlice {
  id: string;
  label: string;
  percentage: number;
  color: string;
}

export interface Investigator {
  id: string;
  name: string;
  title: string;
  department: string;
  affiliation: string;
  photoUrl?: string | null;
  communityId?: string | null;
  keyThemes: string[];
  recentSignals: number;
  collaborationIndex: number;
  matchStrength: number;
  matchBand: MatchStrength;
  lastUpdated: string;
  portfolioStats: {
    publications: number;
    grants: number;
    news: number;
    honors: number;
    trials: number;
    social: string;
  };
  activitySeries: Array<{
    month: string;
    monthKey: string;
    publications: number;
    grants: number;
    news: number;
    other: number;
  }>;
}

export interface FundingOpportunityMatch {
  id: string;
  title: string;
  agency: string;
  opportunityId: string;
  loi: string;
  badge: "High Match" | "Medium Match";
  area?: string;
  mechanism?: string;
  dueDate?: string;
  matchScore?: number;
  whyMatch?: string;
}

export interface ConsultationBrief {
  summary: string;
}

export interface InvestigatorSignal {
  id: string;
  monthKey: string;
  title: string;
  occurredAt: string | null;
  category: string | null;
  source_type: string | null;
  sourceUrl?: string | null;
  source: SignalSource;
  aiSummary?: string;
}

export interface InvestigatorTheme {
  id: string;
  name: string;
  signalCount: number;
  trend: "rising" | "steady" | "emerging";
  weight: number;
}

export interface InvestigatorFundingMatch {
  id: string;
  title: string;
  agency: string;
  mechanism: string;
  dueDate: string;
  matchScore: number;
  whyMatch: string;
}

export interface InvestigatorMetric {
  id: string;
  label: string;
  value: string;
  subtext: string;
}

export type ConsultationBriefSection =
  | "research-summary"
  | "recent-signals"
  | "top-themes"
  | "funding-matches"
  | "suggested-questions"
  | "potential-collaborators";

export interface Collaborator {
  id: string;
  name: string;
  affiliation: string;
  relationship: "co-author" | "co-investigator" | "clinical-partner" | "potential";
  sharedSignals: number;
}

export interface PortfolioSignalItem {
  id: string;
  monthKey: string;
  title: string;
  summaryText?: string | null;
  /** Raw ingest summary (e.g. PubMed journal name, RePORTER agency line). */
  rawSummary?: string | null;
  sourceDomain?: string | null;
  occurredAt: string | null;
  category: string | null;
  source_type: string | null;
  nih_project_num: string | null;
  sourceUrl?: string | null;
  investigatorIds: string[];
}

export interface PortfolioDocumentAnnotationSummary {
  sourceItemId: string;
  model: string;
  themes: string[];
  methods: string[];
  diseases: string[];
  translationalStage: string;
}

export interface PortfolioIntelligenceDataBundle {
  watchedCommunities: WatchedCommunity[];
  timeRanges: string[];
  sourceCoverage: "High" | "Medium" | "Low";
  kpiMetrics: PortfolioMetric[];
  themeDistribution: Theme[];
  topThemeTags: string[];
  signalActivitySeries: ResearchSignal[];
  fundingMechanismMix: FundingMechanismSlice[];
  investigators: Investigator[];
  communityItems: PortfolioSignalItem[];
  documentAnnotations: PortfolioDocumentAnnotationSummary[];
  opportunityMatchesByInvestigator: Record<string, FundingOpportunityMatch[]>;
  consultationPrepByInvestigator: Record<string, ConsultationBrief>;
  communityStrategyBriefByCommunityId: Record<string, string>;
}

export const watchedCommunities: WatchedCommunity[] = [
  { id: "ucsf-diabetes-metabolism", name: "UCSF Diabetes & Metabolism" },
  { id: "ucsf-cancer-immunology", name: "UCSF Cancer Immunology" },
  { id: "ucsf-translational-ai", name: "UCSF Translational AI" },
];

export const timeRanges = [
  "Apr 1 - Apr 30, 2025",
  "Mar 1 - Mar 31, 2025",
  "Jan 1 - Mar 31, 2025",
  "Last 12 months",
];

export const sourceCoverage: "High" | "Medium" | "Low" = "High";

export const sourceChipLabels: Record<SignalSource, string> = {
  publications: "Publications",
  grants: "Grants",
  news: "News",
  honors: "Honors & Awards",
  clinical_trials: "Clinical Trials",
  patents: "Patents",
  social: "Social",
};

export const defaultActiveSources: SignalSource[] = [
  "publications",
  "grants",
  "clinical_trials",
  "news",
  "honors",
  "patents",
];

export const kpiMetrics: PortfolioMetric[] = [
  {
    id: "monitored-investigators",
    label: "Monitored Investigators",
    value: "312",
    delta: "+8",
    comparison: "vs Mar 1 - Mar 31",
    tone: "positive",
  },
  {
    id: "new-signals",
    label: "New Signals This Month",
    value: "1,248",
    delta: "+18%",
    comparison: "vs prior 30 days",
    tone: "positive",
  },
  {
    id: "active-funding-matches",
    label: "Active Funding Matches",
    value: "87",
    delta: "+12%",
    comparison: "vs prior 30 days",
    tone: "positive",
  },
  {
    id: "top-emerging-themes",
    label: "Top Emerging Themes",
    value: "5",
    delta: "New",
    comparison: "vs prior 30 days",
    tone: "neutral",
  },
];

export const themeDistribution: Theme[] = [
  { id: "immunology", name: "Immunology", percentage: 28, signalCount: 348, color: "#1f6f8a" },
  { id: "oncology", name: "Oncology", percentage: 21, signalCount: 260, color: "#2d8ea4" },
  { id: "clinical-trials", name: "Clinical Trials", percentage: 15, signalCount: 186, color: "#4e7bb8" },
  { id: "data-science-ai", name: "Data Science & AI", percentage: 12, signalCount: 149, color: "#5e8f88" },
  { id: "aging", name: "Aging", percentage: 9, signalCount: 112, color: "#7a80b8" },
  { id: "inflammation", name: "Inflammation", percentage: 8, signalCount: 98, color: "#6f8cb7" },
  { id: "translational-medicine", name: "Translational Medicine", percentage: 7, signalCount: 87, color: "#8e9cb4" },
];

export const topThemeTags = [
  "Immunology",
  "Oncology",
  "Data Science & AI",
  "Clinical Trials",
  "Aging",
  "Inflammation",
  "Translational Medicine",
  "Metabolism",
  "Microbiome",
  "Cardiovascular",
];

export const signalActivitySeries: ResearchSignal[] = [
  { date: "Apr 1", thisPeriod: 26, priorPeriod: 18 },
  { date: "Apr 4", thisPeriod: 31, priorPeriod: 21 },
  { date: "Apr 7", thisPeriod: 29, priorPeriod: 20 },
  { date: "Apr 10", thisPeriod: 35, priorPeriod: 23 },
  { date: "Apr 13", thisPeriod: 40, priorPeriod: 24 },
  { date: "Apr 16", thisPeriod: 44, priorPeriod: 27 },
  { date: "Apr 19", thisPeriod: 48, priorPeriod: 30 },
  { date: "Apr 22", thisPeriod: 52, priorPeriod: 33 },
  { date: "Apr 25", thisPeriod: 58, priorPeriod: 35 },
  { date: "Apr 28", thisPeriod: 62, priorPeriod: 36 },
  { date: "Apr 30", thisPeriod: 65, priorPeriod: 38 },
];

export const fundingMechanismMix: FundingMechanismSlice[] = [
  { id: "r01", label: "R01", percentage: 38, color: "#2563eb" },
  { id: "r21", label: "R21", percentage: 17, color: "#14b8a6" },
  { id: "p01", label: "P01 / Program", percentage: 13, color: "#7c3aed" },
  { id: "u", label: "U Mechanism", percentage: 11, color: "#0ea5e9" },
  { id: "foundation", label: "Foundation", percentage: 9, color: "#84cc16" },
  { id: "other", label: "Other", percentage: 12, color: "#94a3b8" },
];

function mockActivitySeries(
  points: Array<{
    publications: number;
    grants: number;
    news: number;
    other: number;
  }>
): Investigator["activitySeries"] {
  const start = new Date(Date.UTC(2025, 4, 1));
  return points.map((point, index) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    return { month, monthKey, ...point };
  });
}

export const investigators: Investigator[] = [
  {
    id: "lee",
    name: "Jasmine K. Lee, MD, PhD",
    title: "Professor, Endocrinology",
    department: "Endocrinology",
    affiliation: "UCSF Diabetes Center",
    keyThemes: ["Immunology", "Metabolism", "Clinical Trials", "Inflammation"],
    recentSignals: 24,
    collaborationIndex: 92,
    matchStrength: 92,
    matchBand: "high",
    lastUpdated: "Apr 30, 2025",
    portfolioStats: { publications: 128, grants: 14, news: 32, honors: 6, trials: 8, social: "1.2K" },
    activitySeries: [
      { month: "May 2025", monthKey: "2025-05", publications: 8, grants: 1, news: 2, other: 1 },
      { month: "Jun 2025", monthKey: "2025-06", publications: 9, grants: 1, news: 2, other: 1 },
      { month: "Jul 2025", monthKey: "2025-07", publications: 7, grants: 1, news: 2, other: 1 },
      { month: "Aug 2025", monthKey: "2025-08", publications: 10, grants: 2, news: 3, other: 2 },
      { month: "Sep 2025", monthKey: "2025-09", publications: 11, grants: 1, news: 3, other: 1 },
      { month: "Oct 2025", monthKey: "2025-10", publications: 12, grants: 2, news: 3, other: 2 },
      { month: "Nov 2025", monthKey: "2025-11", publications: 10, grants: 1, news: 2, other: 1 },
      { month: "Dec 2025", monthKey: "2025-12", publications: 9, grants: 1, news: 2, other: 1 },
      { month: "Jan 2026", monthKey: "2026-01", publications: 11, grants: 2, news: 3, other: 2 },
      { month: "Feb 2026", monthKey: "2026-02", publications: 13, grants: 1, news: 3, other: 2 },
      { month: "Mar 2026", monthKey: "2026-03", publications: 14, grants: 1, news: 4, other: 2 },
      { month: "Apr 2026", monthKey: "2026-04", publications: 14, grants: 1, news: 3, other: 2 },
    ],
  },
  {
    id: "rodriguez",
    name: "Michael A. Rodriguez, PhD",
    title: "Associate Professor, Cell Biology",
    department: "Cell Biology",
    affiliation: "UCSF",
    keyThemes: ["Oncology", "Cell Signaling", "Systems Biology"],
    recentSignals: 18,
    collaborationIndex: 78,
    matchStrength: 81,
    matchBand: "high",
    lastUpdated: "Apr 30, 2025",
    portfolioStats: { publications: 84, grants: 11, news: 14, honors: 4, trials: 2, social: "420" },
    activitySeries: mockActivitySeries([
      { publications: 4, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 0, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 7, grants: 1, news: 2, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 7, grants: 1, news: 2, other: 1 },
      { publications: 7, grants: 1, news: 2, other: 1 },
      { publications: 8, grants: 1, news: 2, other: 1 },
      { publications: 8, grants: 1, news: 2, other: 1 },
    ]),
  },
  {
    id: "desai",
    name: "Priya N. Desai, MD",
    title: "Assistant Professor, Hematology/Oncology",
    department: "Hematology/Oncology",
    affiliation: "UCSF",
    keyThemes: ["Clinical Trials", "Translational Medicine", "Oncology"],
    recentSignals: 16,
    collaborationIndex: 71,
    matchStrength: 66,
    matchBand: "medium",
    lastUpdated: "Apr 29, 2025",
    portfolioStats: { publications: 62, grants: 8, news: 9, honors: 2, trials: 6, social: "310" },
    activitySeries: mockActivitySeries([
      { publications: 3, grants: 1, news: 1, other: 1 },
      { publications: 4, grants: 0, news: 1, other: 1 },
      { publications: 4, grants: 0, news: 1, other: 1 },
      { publications: 4, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 0, news: 1, other: 1 },
      { publications: 5, grants: 0, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 7, grants: 1, news: 1, other: 1 },
      { publications: 7, grants: 1, news: 2, other: 1 },
    ]),
  },
  {
    id: "wu",
    name: "Jonathan T. Wu, PhD",
    title: "Assistant Professor, Computational Biology",
    department: "Computational Biology",
    affiliation: "UCSF",
    keyThemes: ["Data Science & AI", "Systems Immunology", "Microbiome"],
    recentSignals: 14,
    collaborationIndex: 68,
    matchStrength: 62,
    matchBand: "medium",
    lastUpdated: "Apr 29, 2025",
    portfolioStats: { publications: 70, grants: 9, news: 8, honors: 3, trials: 2, social: "670" },
    activitySeries: mockActivitySeries([
      { publications: 4, grants: 1, news: 1, other: 0 },
      { publications: 4, grants: 1, news: 1, other: 1 },
      { publications: 4, grants: 0, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 0, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 1, other: 1 },
      { publications: 6, grants: 1, news: 2, other: 1 },
      { publications: 6, grants: 1, news: 2, other: 1 },
    ]),
  },
  {
    id: "garcia",
    name: "Elena M. Garcia, MD, PhD",
    title: "Professor, Rheumatology",
    department: "Rheumatology",
    affiliation: "UCSF",
    keyThemes: ["Inflammation", "Autoimmunity", "Clinical Trials"],
    recentSignals: 13,
    collaborationIndex: 65,
    matchStrength: 58,
    matchBand: "medium",
    lastUpdated: "Apr 28, 2025",
    portfolioStats: { publications: 58, grants: 7, news: 10, honors: 5, trials: 4, social: "380" },
    activitySeries: mockActivitySeries([
      { publications: 3, grants: 0, news: 1, other: 1 },
      { publications: 3, grants: 1, news: 1, other: 1 },
      { publications: 3, grants: 1, news: 1, other: 1 },
      { publications: 4, grants: 1, news: 1, other: 1 },
      { publications: 4, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 1, other: 1 },
      { publications: 5, grants: 0, news: 1, other: 1 },
      { publications: 4, grants: 0, news: 1, other: 1 },
      { publications: 5, grants: 1, news: 2, other: 1 },
      { publications: 5, grants: 1, news: 2, other: 1 },
      { publications: 6, grants: 1, news: 2, other: 1 },
      { publications: 6, grants: 1, news: 2, other: 1 },
    ]),
  },
];

export const opportunityMatchesByInvestigator: Record<string, FundingOpportunityMatch[]> = {
  lee: [
    {
      id: "nih-r01-metabolic",
      title: "NIH R01 - Immune Mechanisms in Metabolic Disease",
      agency: "NIH / NIDDK",
      opportunityId: "RFA-DK-25-021",
      loi: "Jun 12, 2025",
      badge: "High Match",
    },
    {
      id: "jdrf-immunometabolism",
      title: "JDRF - Innovative Immunometabolism Research",
      agency: "JDRF",
      opportunityId: "3-PDF-2025-789-M-B",
      loi: "May 28, 2025",
      badge: "High Match",
    },
    {
      id: "allen-frontiers",
      title: "Paul G. Allen Frontiers Group Advised Grant",
      agency: "Allen Frontiers",
      opportunityId: "AFG-IMMUNO-2025",
      loi: "Jun 30, 2025",
      badge: "Medium Match",
      area: "Frontiers in Immunology",
    },
  ],
};

export const defaultOpportunityMatches: FundingOpportunityMatch[] =
  opportunityMatchesByInvestigator.lee ?? [];

export const consultationPrepSummary: ConsultationBrief = {
  summary:
    "High activity in immunometabolism and clinical trials. Strong collaborative network and recent R01 funding. Consider opportunities that emphasize translational impact and patient outcomes.",
};

export const consultationPrepByInvestigator: Record<string, ConsultationBrief> = {
  lee: consultationPrepSummary,
};

const MOCK_JOURNALS = ["Nature Immunology", "Cell", "Science Translational Medicine", "JCI", "Immunity"];
const MOCK_AGENCIES = ["NIDDK", "NIAID", "NCI", "NHLBI", "NIGMS"];

function makeMockCommunityItems(): PortfolioSignalItem[] {
  const rows: PortfolioSignalItem[] = [];
  let seq = 1;
  const monthKeys = [
    "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10",
    "2024-11", "2024-12", "2025-01", "2025-02", "2025-03", "2025-04",
  ];
  for (const inv of investigators) {
    inv.activitySeries.forEach((point, idx) => {
      const monthKey = point.monthKey ?? monthKeys[idx] ?? "2025-04";
      for (let i = 0; i < point.publications; i += 1) {
        rows.push({
          id: `mock-paper-${seq++}`,
          monthKey,
          title: `${inv.name.split(",")[0]} publication ${i + 1}`,
          summaryText: null,
          rawSummary: MOCK_JOURNALS[(seq + i) % MOCK_JOURNALS.length] ?? "Nature Immunology",
          sourceDomain: "pubmed.ncbi.nlm.nih.gov",
          occurredAt: `${monthKey}-01T00:00:00.000Z`,
          category: "paper",
          source_type: "pubmed",
          nih_project_num: null,
          sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/",
          investigatorIds: [inv.id],
        });
      }
      for (let i = 0; i < point.grants; i += 1) {
        rows.push({
          id: `mock-grant-${seq++}`,
          monthKey,
          title: `${inv.name.split(",")[0]} grant update ${i + 1}`,
          summaryText: null,
          rawSummary: MOCK_AGENCIES[(seq + i) % MOCK_AGENCIES.length] ?? "NIDDK",
          sourceDomain: "reporter.nih.gov",
          occurredAt: `${monthKey}-08T00:00:00.000Z`,
          category: "funding",
          source_type: "reporter",
          nih_project_num: i % 2 === 0 ? "R01-TEST" : "R21-TEST",
          sourceUrl: "https://reporter.nih.gov/",
          investigatorIds: [inv.id],
        });
      }
      for (let i = 0; i < point.news; i += 1) {
        rows.push({
          id: `mock-news-${seq++}`,
          monthKey,
          title: `${inv.name.split(",")[0]} in the news ${i + 1}`,
          summaryText: null,
          occurredAt: `${monthKey}-15T00:00:00.000Z`,
          category: "media",
          source_type: "web",
          nih_project_num: null,
          sourceUrl: null,
          investigatorIds: [inv.id],
        });
      }
      for (let i = 0; i < point.other; i += 1) {
        rows.push({
          id: `mock-other-${seq++}`,
          monthKey,
          title: `${inv.name.split(",")[0]} profile signal ${i + 1}`,
          summaryText: null,
          occurredAt: `${monthKey}-22T00:00:00.000Z`,
          category: i % 3 === 0 ? "award" : "other",
          source_type: i % 4 === 0 ? "clinical_trial" : i % 5 === 0 ? "social" : "manual",
          nih_project_num: null,
          sourceUrl: null,
          investigatorIds: [inv.id],
        });
      }
    });
  }
  return rows;
}

export const mockPortfolioIntelligenceBundle: PortfolioIntelligenceDataBundle = {
  watchedCommunities,
  timeRanges,
  sourceCoverage,
  kpiMetrics,
  themeDistribution,
  topThemeTags,
  signalActivitySeries,
  fundingMechanismMix,
  investigators,
  communityItems: makeMockCommunityItems(),
  documentAnnotations: [],
  opportunityMatchesByInvestigator,
  consultationPrepByInvestigator,
  communityStrategyBriefByCommunityId: {},
};
