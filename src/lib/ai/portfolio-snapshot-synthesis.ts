import OpenAI from "openai";

type InvestigatorSynthesisInput = {
  investigatorName: string;
  topThemes: string[];
  topMethods: string[];
  topDiseases: string[];
  translationalStage: string;
  signalCounts: {
    publications: number;
    grants: number;
    news: number;
    honors: number;
    trials: number;
    social: number;
  };
  annotationSummaries: string[];
  evidenceQuotes: string[];
};

type CommunitySynthesisInput = {
  communityName: string;
  investigatorCount: number;
  signalCount: number;
  topThemes: string[];
  topMethods: string[];
  topDiseases: string[];
  translationalMix: Record<string, number>;
  annotationSummaries: string[];
};

const DEFAULT_MODEL = "gpt-4o-mini";

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function maybeOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function deterministicInvestigatorBrief(input: InvestigatorSynthesisInput): string {
  const topTheme = input.topThemes[0] ?? "priority portfolio themes";
  const diseaseText = input.topDiseases.length > 0 ? input.topDiseases.slice(0, 2).join(" and ") : "key disease priorities";
  const methodsText = input.topMethods.length > 0 ? input.topMethods.slice(0, 2).join(" and ") : "strong mechanistic approaches";
  return compact(
    `${input.investigatorName}'s portfolio shows strongest concentration in ${topTheme}, with ${
      input.signalCounts.publications
    } publication signals and ${input.signalCounts.grants} grant signals in the selected window. ` +
      `Evidence points to ${methodsText}, with translational stage leaning ${input.translationalStage}. ` +
      `Near-term funding framing should emphasize ${diseaseText} and clear milestone-driven aims.`
  );
}

function deterministicCommunityBrief(input: CommunitySynthesisInput): string {
  const topTheme = input.topThemes[0] ?? "community priority themes";
  const secondTheme = input.topThemes[1] ?? topTheme;
  const topDisease = input.topDiseases[0] ?? "high-priority disease contexts";
  return compact(
    `${input.communityName} shows a concentrated portfolio in ${topTheme} and ${secondTheme} across ${
      input.signalCount
    } signals from ${input.investigatorCount} investigators. ` +
      `The evidence base suggests strongest near-term strategy around ${topDisease} and coordinated opportunity matching for multi-investigator teams.`
  );
}

export async function synthesizeInvestigatorAiBrief(
  input: InvestigatorSynthesisInput,
  opts?: { model?: string }
): Promise<string> {
  const openai = maybeOpenAiClient();
  if (!openai) return deterministicInvestigatorBrief(input);
  const model = opts?.model ?? DEFAULT_MODEL;
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 260,
    messages: [
      {
        role: "system",
        content:
          "You are a research development strategist. Write concise, evidence-grounded investigator portfolio briefs for grant planning.",
      },
      {
        role: "user",
        content:
          "Write a 2-3 sentence briefing summary (max 110 words). " +
          "Do not use markdown. Focus on research identity, momentum, translational stage, and funding strategy.\n\n" +
          `Investigator: ${input.investigatorName}\n` +
          `Top themes: ${input.topThemes.join(", ") || "N/A"}\n` +
          `Top methods: ${input.topMethods.join(", ") || "N/A"}\n` +
          `Top diseases: ${input.topDiseases.join(", ") || "N/A"}\n` +
          `Translational stage: ${input.translationalStage}\n` +
          `Signal counts: ${JSON.stringify(input.signalCounts)}\n` +
          `Annotation summaries: ${input.annotationSummaries.join(" | ") || "N/A"}\n` +
          `Evidence quotes: ${input.evidenceQuotes.join(" | ") || "N/A"}`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  return text ? compact(text) : deterministicInvestigatorBrief(input);
}

export async function synthesizeCommunityAiBrief(
  input: CommunitySynthesisInput,
  opts?: { model?: string }
): Promise<string> {
  const openai = maybeOpenAiClient();
  if (!openai) return deterministicCommunityBrief(input);
  const model = opts?.model ?? DEFAULT_MODEL;
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 320,
    messages: [
      {
        role: "system",
        content:
          "You are a research portfolio strategist. Write concise community strategy briefs grounded in provided evidence.",
      },
      {
        role: "user",
        content:
          "Write a 3 sentence strategic brief (max 130 words). " +
          "Do not use markdown. Include key strengths, translational posture, and immediate funding coordination action.\n\n" +
          `Community: ${input.communityName}\n` +
          `Investigators: ${input.investigatorCount}\n` +
          `Signals: ${input.signalCount}\n` +
          `Top themes: ${input.topThemes.join(", ") || "N/A"}\n` +
          `Top methods: ${input.topMethods.join(", ") || "N/A"}\n` +
          `Top diseases: ${input.topDiseases.join(", ") || "N/A"}\n` +
          `Translational mix: ${JSON.stringify(input.translationalMix)}\n` +
          `Annotation summaries: ${input.annotationSummaries.join(" | ") || "N/A"}`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  return text ? compact(text) : deterministicCommunityBrief(input);
}
