import OpenAI from "openai";
import type { PiCommunityAggregates } from "@/lib/tracked-pis/community-aggregates";
import { topCounts } from "@/lib/tracked-pis/community-aggregates";

const MODEL = "gpt-4o-mini";
const MAX_OUT = 2_500;

function formatTop(
  label: string,
  m: Map<string, number>,
  n: number
): string {
  const rows = topCounts(m, n);
  if (!rows.length) return `${label}: (none)`;
  return `${label}: ${rows.map((r) => `${r.name} (${r.count})`).join("; ")}`;
}

/** Narrative overview of the aggregated PI directory for leadership / comms. */
export async function generatePiCommunityNarrative(
  agg: PiCommunityAggregates
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const facts = [
    `Total PIs in directory: ${agg.totalPis}`,
    `With primary research area tag: ${agg.withPrimaryResearchArea}`,
    `With primary disease focus tag: ${agg.withPrimaryDisease}`,
    formatTop("Primary research areas (top)", agg.primaryResearchArea, 20),
    formatTop("Secondary research theme tokens (top)", agg.secondaryResearchTokens, 25),
    formatTop("Primary disease focus (top)", agg.primaryDisease, 20),
    formatTop("Secondary disease tokens (top)", agg.secondaryDiseaseTokens, 25),
    formatTop("Institution (top)", agg.byInstitution, 15),
  ].join("\n");

  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.25,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `You summarize aggregate faculty / PI directory statistics for a research office. Write plain text only (no markdown), 4–6 short paragraphs separated by a blank line. Interpret research-area and disease distributions at a high level (themes, clusters, gaps). Note that secondary fields are comma-split tokens and may overlap primary labels. Be factual; do not invent numbers or faculty not implied by the counts. If a category is sparse, say so.`,
        },
        { role: "user", content: `Summarize this PI community snapshot:\n\n${facts}` },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;
    return text.length > MAX_OUT ? `${text.slice(0, MAX_OUT)}…` : text;
  } catch {
    return null;
  }
}
