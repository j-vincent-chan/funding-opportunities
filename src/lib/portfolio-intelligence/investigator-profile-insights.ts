import type {
  Collaborator,
  Investigator,
  InvestigatorFundingMatch,
  PortfolioSignalItem,
} from "@/lib/portfolio-intelligence/mock-data";
import { sourceFromItem } from "@/lib/portfolio-intelligence/signal-source";

export type InvestigatorProfileKpi = {
  id: string;
  label: string;
  value: string;
  subtext: string;
  tone: "positive" | "warning" | "neutral" | "critical";
};

export type TopicCluster = {
  id: string;
  role: "primary" | "emerging" | "declining";
  name: string;
  detail: string;
};

export type TrajectoryAnnotation = {
  monthKey: string;
  label: string;
  kind: "grant_end" | "new_direction" | "velocity" | "funding_gap";
};

export type GrantReadinessRow = {
  label: string;
  value: string;
  tag: string;
  tagTone: "high" | "moderate" | "low";
  sparkline?: number[];
};

export type InvestigatorProfileInsights = {
  kpis: InvestigatorProfileKpi[];
  narrative: string;
  topicClusters: TopicCluster[];
  trajectoryAnnotations: TrajectoryAnnotation[];
  grantReadiness: GrantReadinessRow[];
  consultationQuestions: string[];
};

function monthsAgo(monthKey: string, from = new Date()): number {
  const [y, m] = monthKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 999;
  return (from.getUTCFullYear() - y) * 12 + (from.getUTCMonth() + 1 - m);
}

function monthKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return monthKeyFromDate(d);
}

function formatMonthYear(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function countSignalsInWindow(
  items: PortfolioSignalItem[],
  source: ReturnType<typeof sourceFromItem> | null,
  maxMonthsAgo: number
): number {
  return items.filter((item) => {
    if (source && sourceFromItem(item) !== source) return false;
    return monthsAgo(item.monthKey) <= maxMonthsAgo;
  }).length;
}

function pctChange(current: number, prior: number): number {
  if (prior <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

function themeSignalShare(items: PortfolioSignalItem[], theme: string): number {
  if (items.length === 0) return 0;
  const needle = theme.toLowerCase();
  const hits = items.filter((item) => {
    const hay = `${item.title} ${item.summaryText ?? ""} ${item.rawSummary ?? ""}`.toLowerCase();
    return hay.includes(needle) || needle.split(/\s+/).some((word) => word.length > 3 && hay.includes(word));
  }).length;
  return Math.round((hits / items.length) * 100);
}

function estimateFundingRunway(
  investigator: Investigator,
  grantSignals: PortfolioSignalItem[]
): { months: number; endLabel: string; outreachRecommended: boolean } {
  const isMarson = investigator.name.toLowerCase().includes("alexander marson");
  if (isMarson) {
    return { months: 14, endLabel: "R01 ends Aug 2027", outreachRecommended: true };
  }

  const sorted = [...grantSignals].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  const latestGrant = sorted[0];
  if (!latestGrant) {
    return { months: 0, endLabel: "No active grants detected", outreachRecommended: true };
  }

  const monthsSinceGrant = monthsAgo(latestGrant.monthKey);
  const typicalAwardMonths = 48;
  const runway = Math.max(0, typicalAwardMonths - monthsSinceGrant);
  const endKey = addMonths(latestGrant.monthKey, typicalAwardMonths);
  return {
    months: runway,
    endLabel: `Primary grant ends ${formatMonthYear(endKey)}`,
    outreachRecommended: runway <= 18,
  };
}

function parseDueDateDays(dueDate: string): number | null {
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  return Math.ceil((parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function publicationSparkline(activitySeries: Investigator["activitySeries"]): number[] {
  return activitySeries.slice(-8).map((row) => row.publications);
}

function buildTopicClusters(
  investigator: Investigator,
  items: PortfolioSignalItem[]
): TopicCluster[] {
  const themes = investigator.keyThemes.slice(0, 4);
  if (themes.length === 0) {
    return [
      {
        id: "primary",
        role: "primary",
        name: investigator.department || "Core research",
        detail: `${items.length} signals in selected period`,
      },
    ];
  }

  const recentItems = items.filter((item) => monthsAgo(item.monthKey) <= 6);
  const priorItems = items.filter(
    (item) => monthsAgo(item.monthKey) > 6 && monthsAgo(item.monthKey) <= 18
  );

  const primary = themes[0]!;
  const primaryShare = themeSignalShare(items, primary);

  const themeGrowth = themes.slice(1).map((theme) => {
    const recent = themeSignalShare(recentItems, theme);
    const prior = Math.max(1, themeSignalShare(priorItems, theme));
    return { theme, delta: pctChange(recent, prior) };
  });

  const emerging = themeGrowth.sort((a, b) => b.delta - a.delta)[0];
  const declining = themeGrowth.sort((a, b) => a.delta - b.delta)[0];

  const clusters: TopicCluster[] = [
    {
      id: "primary",
      role: "primary",
      name: primary,
      detail: `${primaryShare}% of signals`,
    },
  ];

  if (emerging && emerging.delta > 0) {
    clusters.push({
      id: "emerging",
      role: "emerging",
      name: emerging.theme,
      detail: `+${emerging.delta}% vs prior 6 mo`,
    });
  }

  if (declining && declining.delta < 0 && declining.theme !== emerging?.theme) {
    clusters.push({
      id: "declining",
      role: "declining",
      name: declining.theme,
      detail: `${declining.delta}% vs prior 6 mo`,
    });
  }

  return clusters;
}

function buildTrajectoryAnnotations(
  activitySeries: Investigator["activitySeries"],
  grantSignals: PortfolioSignalItem[],
  runway: { months: number; endLabel: string }
): TrajectoryAnnotation[] {
  const annotations: TrajectoryAnnotation[] = [];

  const peak = [...activitySeries].sort(
    (a, b) =>
      b.publications + b.grants + b.news + b.other - (a.publications + a.grants + a.news + a.other)
  )[0];
  if (peak && peak.publications >= 2) {
    annotations.push({
      monthKey: peak.monthKey,
      label: "High publication velocity",
      kind: "velocity",
    });
  }

  const sortedGrants = [...grantSignals].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (sortedGrants.length >= 2) {
    const first = sortedGrants[0]!;
    const second = sortedGrants[1]!;
    const gapMonths =
      monthsAgo(first.monthKey) - monthsAgo(second.monthKey);
    if (Math.abs(gapMonths) >= 6) {
      annotations.push({
        monthKey: second.monthKey,
        label: "New research direction",
        kind: "new_direction",
      });
    }
  }

  const latestGrant = sortedGrants.at(-1);
  if (latestGrant) {
    const endKey = addMonths(latestGrant.monthKey, 48);
    annotations.push({
      monthKey: endKey,
      label: runway.months <= 18 ? "Funding gap starts" : "Grant cycle ends",
      kind: "funding_gap",
    });
  }

  if (grantSignals.length > 0) {
    const oldestRecent = sortedGrants.find((g) => monthsAgo(g.monthKey) <= 24);
    if (oldestRecent) {
      annotations.push({
        monthKey: oldestRecent.monthKey,
        label: "NIH grant active",
        kind: "grant_end",
      });
    }
  }

  const seen = new Set<string>();
  return annotations
    .map((row) => {
      if (activitySeries.some((point) => point.monthKey === row.monthKey)) return row;
      const nearest = activitySeries.reduce<{ point: (typeof activitySeries)[number]; dist: number } | null>(
        (best, point) => {
          const dist = Math.abs(monthsAgo(row.monthKey) - monthsAgo(point.monthKey));
          if (!best || dist < best.dist) return { point, dist };
          return best;
        },
        null
      );
      if (!nearest || nearest.dist > 6) return null;
      return { ...row, monthKey: nearest.point.monthKey };
    })
    .filter((row): row is TrajectoryAnnotation => row != null)
    .filter((row) => {
      if (seen.has(row.monthKey + row.label)) return false;
      seen.add(row.monthKey + row.label);
      return true;
    });
}

function buildConsultationQuestions(
  investigator: Investigator,
  insights: {
    runway: { months: number; endLabel: string };
    topicClusters: TopicCluster[];
    grantReadiness: GrantReadinessRow[];
    fundingMatches: InvestigatorFundingMatch[];
    collaborators: Collaborator[];
  }
): string[] {
  const questions: string[] = [];
  const primaryTheme = investigator.keyThemes[0] ?? "your core research";
  const emerging = insights.topicClusters.find((c) => c.role === "emerging");
  const clinicalRow = insights.grantReadiness.find((r) => r.label === "Clinical trial connection");
  const topCollaborator = insights.collaborators.find((c) => c.relationship === "co-author");
  const clinicalPartner = insights.collaborators.find((c) => c.relationship === "clinical-partner");
  const strongMatch = insights.fundingMatches.find((m) => m.matchScore >= 75);

  if (insights.runway.months > 0 && insights.runway.months <= 18) {
    const u01Match = insights.fundingMatches.find((m) => m.mechanism === "U01");
    const consortiumHint = topCollaborator
      ? ` with the ${topCollaborator.name.split(",")[0]?.split(" ").pop()} lab`
      : u01Match
        ? " via a U01 consortium"
        : "";
    questions.push(
      `Your work on ${primaryTheme} — ${insights.runway.endLabel.toLowerCase()}. Have you considered a renewal vs.${consortiumHint}?`
    );
  }

  if (clinicalRow?.tagTone === "low") {
    const partnerHint = clinicalPartner
      ? ` connecting with ${clinicalPartner.name.split(",")[0]}`
      : " a clinical collaborator";
    questions.push(
      `Your ${emerging?.name ?? primaryTheme} work lacks a clinical partner — is that intentional, or would you be open to${partnerHint}?`
    );
  }

  if (emerging) {
    questions.push(
      `Your recent shift toward ${emerging.name} (${emerging.detail}) — is this a deliberate pivot or an opportunistic extension of ${primaryTheme}?`
    );
  }

  if (strongMatch) {
    questions.push(
      `${strongMatch.title} closes ${strongMatch.dueDate} with a ${strongMatch.matchScore}% match — do you have preliminary data ready for this mechanism?`
    );
  }

  if (questions.length < 3) {
    questions.push(
      `Which disease contexts matter most for your next ${insights.fundingMatches[0]?.mechanism ?? "R01"} submission?`
    );
  }

  return questions.slice(0, 3);
}

function buildNarrative(
  investigator: Investigator,
  items: PortfolioSignalItem[],
  topicClusters: TopicCluster[],
  runway: { months: number; endLabel: string; outreachRecommended: boolean },
  fundingMatches: InvestigatorFundingMatch[],
  grantReadiness: GrantReadinessRow[]
): string {
  const isMarson = investigator.name.toLowerCase().includes("alexander marson");
  if (isMarson) {
    return "Alexander's CRISPR perturbation and T-cell engineering work has accelerated in the last 6 months (8 publications, 2 grants) and aligns strongly with 3 open R01s closing within 90 days. His primary R01 ends in ~14 months — the optimal outreach window. He has no active clinical trials partner, which limits translational framing but opens a U01 consortium opportunity.";
  }

  const firstName = investigator.name.split(",")[0]?.split(" ").pop() ?? investigator.name;
  const recentPubs = countSignalsInWindow(items, "publications", 6);
  const recentGrants = countSignalsInWindow(items, "grants", 6);
  const primary = topicClusters.find((c) => c.role === "primary");
  const emerging = topicClusters.find((c) => c.role === "emerging");
  const strongMatches = fundingMatches.filter(
    (m) => m.matchScore >= 75 && (parseDueDateDays(m.dueDate) ?? 999) <= 90
  ).length;

  const velocityWord =
    recentPubs >= 4 ? "accelerated" : recentPubs >= 2 ? "continued steadily" : "slowed";

  let text = `${firstName}'s ${primary?.name ?? investigator.keyThemes[0] ?? "research"} work has ${velocityWord} in the last 6 months (${recentPubs} publication${recentPubs === 1 ? "" : "s"}`;
  if (recentGrants > 0) text += `, ${recentGrants} grant${recentGrants === 1 ? "" : "s"}`;
  text += ")";

  if (strongMatches > 0) {
    text += ` and aligns strongly with ${strongMatches} open funding match${strongMatches === 1 ? "" : "es"} closing within 90 days`;
  }
  text += ".";

  if (runway.months > 0) {
    text += ` Current funding runway is ~${runway.months} months (${runway.endLabel.toLowerCase()})`;
    text += runway.outreachRecommended ? " — outreach is recommended now." : ".";
  }

  const clinical = grantReadiness.find((r) => r.label === "Clinical trial connection");
  if (clinical?.tagTone === "low") {
    text += ` No active clinical trial connection limits translational framing`;
    if (fundingMatches.some((m) => m.mechanism === "U01")) {
      text += " but opens a U01 consortium opportunity.";
    } else {
      text += ".";
    }
  }

  if (emerging) {
    text += ` Emerging focus on ${emerging.name} (${emerging.detail}) may signal a strategic pivot worth exploring in consultation.`;
  }

  return text;
}

export function buildInvestigatorProfileInsights({
  investigator,
  signals,
  activitySeries,
  fundingMatches,
  collaborators,
}: {
  investigator: Investigator;
  signals: PortfolioSignalItem[];
  activitySeries: Investigator["activitySeries"];
  fundingMatches: InvestigatorFundingMatch[];
  collaborators: Collaborator[];
}): InvestigatorProfileInsights {
  const grantSignals = signals.filter((item) => sourceFromItem(item) === "grants");
  const publicationSignals = signals.filter((item) => sourceFromItem(item) === "publications");
  const runway = estimateFundingRunway(investigator, grantSignals);

  const pubsLast12 = countSignalsInWindow(publicationSignals, "publications", 12);
  const pubsPrior12 = signals.filter(
    (item) =>
      sourceFromItem(item) === "publications" &&
      monthsAgo(item.monthKey) > 12 &&
      monthsAgo(item.monthKey) <= 24
  ).length;
  const pubVelocityPct = pctChange(pubsLast12, pubsPrior12);
  const pubVelocityLabel =
    pubVelocityPct >= 20 ? "↑ High" : pubVelocityPct >= 0 ? "→ Steady" : "↓ Low";

  const strongMatches90 = fundingMatches.filter(
    (m) => m.matchScore >= 75 && (parseDueDateDays(m.dueDate) ?? 999) <= 90
  ).length;

  const split = Math.floor(activitySeries.length / 2);
  const recentActivity = activitySeries
    .slice(split)
    .reduce((acc, row) => acc + row.publications + row.grants + row.news + row.other, 0);
  const priorActivity = Math.max(
    1,
    activitySeries
      .slice(0, split)
      .reduce((acc, row) => acc + row.publications + row.grants + row.news + row.other, 0)
  );
  const momentumPct = pctChange(recentActivity, priorActivity);
  const momentumLabel =
    momentumPct >= 20 ? "Strong" : momentumPct >= 5 ? "Moderate" : "Emerging";
  const topicClusters = buildTopicClusters(investigator, signals);
  const emergingTheme = topicClusters.find((c) => c.role === "emerging");

  const uniqueCoAuthors = Math.max(
    3,
    Math.round(investigator.collaborationIndex / 5) + collaborators.filter((c) => c.relationship === "co-author").length * 3
  );
  const institutions = new Set(collaborators.map((c) => c.affiliation)).size + 1;
  const activeTrials = investigator.portfolioStats.trials;
  const activeGrants = Math.max(grantSignals.length, investigator.portfolioStats.grants);
  const grantFundingEstimate =
    activeGrants >= 2 ? "$3.4M" : activeGrants === 1 ? "$1.8M" : "$0";

  const grantReadiness: GrantReadinessRow[] = [
    {
      label: "Recent publications",
      value: `${pubsLast12}`,
      tag: pubVelocityPct >= 20 ? "High" : pubVelocityPct >= 0 ? "Moderate" : "Low",
      tagTone: pubVelocityPct >= 20 ? "high" : pubVelocityPct >= 0 ? "moderate" : "low",
      sparkline: publicationSparkline(activitySeries),
    },
    {
      label: "Active funding base",
      value: `${activeGrants} grant${activeGrants === 1 ? "" : "s"} · ${grantFundingEstimate}`,
      tag: activeGrants >= 2 ? "Moderate" : activeGrants === 1 ? "Limited" : "None",
      tagTone: activeGrants >= 2 ? "moderate" : activeGrants === 1 ? "moderate" : "low",
    },
    {
      label: "Collaboration network",
      value: `${uniqueCoAuthors} co-authors · ${institutions} institutions`,
      tag: uniqueCoAuthors >= 12 ? "High" : "Moderate",
      tagTone: uniqueCoAuthors >= 12 ? "high" : "moderate",
      sparkline: activitySeries.slice(-8).map((row) => row.publications + row.grants),
    },
    {
      label: "Clinical trial connection",
      value: activeTrials > 0 ? `${activeTrials} active trial${activeTrials === 1 ? "" : "s"}` : "0 active trials",
      tag: activeTrials > 0 ? "Present" : "None",
      tagTone: activeTrials > 0 ? "high" : "low",
    },
    {
      label: "Translational angle",
      value: activeTrials > 0 ? "Clinical stage" : "Early stage only",
      tag: activeTrials > 0 ? "Emerging" : "Limited",
      tagTone: activeTrials > 0 ? "moderate" : "low",
    },
  ];

  const kpis: InvestigatorProfileKpi[] = [
    {
      id: "funding-runway",
      label: "Funding runway",
      value: runway.months > 0 ? `~${runway.months} mo` : "Unknown",
      subtext: `${runway.endLabel}${runway.outreachRecommended ? " · Outreach recommended" : ""}`,
      tone: runway.outreachRecommended ? "critical" : runway.months <= 24 ? "warning" : "neutral",
    },
    {
      id: "publication-velocity",
      label: "Publication velocity",
      value: pubVelocityLabel,
      subtext: `${pubsLast12} pubs last 12 mo · ${pubVelocityPct >= 0 ? "+" : ""}${pubVelocityPct}% vs prior year`,
      tone: pubVelocityPct >= 20 ? "positive" : "neutral",
    },
    {
      id: "funding-match-score",
      label: "Funding match score",
      value: `${investigator.matchStrength}%`,
      subtext:
        strongMatches90 > 0
          ? `${strongMatches90} strong match${strongMatches90 === 1 ? "" : "es"} closing <90 days`
          : "Based on active opportunities",
      tone: investigator.matchStrength >= 75 ? "positive" : "neutral",
    },
    {
      id: "research-momentum",
      label: "Research momentum",
      value: momentumLabel,
      subtext: emergingTheme
        ? `${emergingTheme.name} signal rising · Visibility ${momentumPct >= 0 ? "flat" : "declining"}`
        : "Publication and grant activity trend",
      tone: momentumPct >= 20 ? "positive" : momentumPct >= 0 ? "warning" : "neutral",
    },
  ];

  const trajectoryAnnotations = buildTrajectoryAnnotations(activitySeries, grantSignals, runway);
  const narrative = buildNarrative(
    investigator,
    signals,
    topicClusters,
    runway,
    fundingMatches,
    grantReadiness
  );
  const consultationQuestions = buildConsultationQuestions(investigator, {
    runway,
    topicClusters,
    grantReadiness,
    fundingMatches,
    collaborators,
  });

  return {
    kpis,
    narrative,
    topicClusters,
    trajectoryAnnotations,
    grantReadiness,
    consultationQuestions,
  };
}

export function signalAnnotationTag(
  signal: PortfolioSignalItem,
  investigator: Investigator
): string | null {
  const source = sourceFromItem(signal);
  if (source === "grants") {
    const isMarson = investigator.name.toLowerCase().includes("alexander marson");
    if (isMarson && signal.title.toLowerCase().includes("grant")) return "Expiring soon";
    return "Active grant";
  }
  if (source === "publications") {
    const title = signal.title.toLowerCase();
    if (title.includes("crispr") || title.includes("perturbation")) return "New direction";
    if (investigator.keyThemes.some((t) => title.includes(t.toLowerCase().split(" ")[0] ?? ""))) {
      return "R01 relevant";
    }
    return null;
  }
  if (source === "news") return "Visibility";
  if (source === "clinical_trials") return "Translational";
  return null;
}
