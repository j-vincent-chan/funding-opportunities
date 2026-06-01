import OpenAI from "openai";
import { z } from "zod";
import type { SourceDocumentRow } from "@/lib/portfolio-intelligence/intelligence-types";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_INPUT_CHARS = 20_000;

const annotationSchema = z.object({
  summary: z.string().min(1).max(2500),
  themes: z.array(z.string().min(1)).max(20),
  methods: z.array(z.string().min(1)).max(20),
  diseases: z.array(z.string().min(1)).max(20),
  translational_stage: z
    .enum(["basic", "preclinical", "clinical", "implementation", "mixed", "unknown"])
    .default("unknown"),
  funding_relevance_tags: z.array(z.string().min(1)).max(20),
  evidence_quotes: z.array(z.string().min(1)).max(12),
  confidence: z.number().min(0).max(1),
});

export type PortfolioDocumentAnnotation = z.infer<typeof annotationSchema>;

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function sliceForModel(doc: SourceDocumentRow): string {
  const parts = [
    `Title: ${doc.title}`,
    doc.abstract_text ? `Abstract: ${doc.abstract_text}` : null,
    doc.full_text ? `Full text: ${doc.full_text}` : null,
    doc.source_url ? `Source URL: ${doc.source_url}` : null,
    doc.published_at ? `Published at: ${doc.published_at}` : null,
    `Kind: ${doc.document_kind}`,
  ].filter(Boolean);
  return compactText(parts.join("\n\n")).slice(0, MAX_INPUT_CHARS);
}

function parseJsonObject(raw: string): unknown {
  const txt = raw.trim();
  try {
    return JSON.parse(txt);
  } catch {
    const first = txt.indexOf("{");
    const last = txt.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const maybe = txt.slice(first, last + 1);
      return JSON.parse(maybe);
    }
    throw new Error("Model output is not valid JSON.");
  }
}

export async function extractPortfolioDocumentAnnotation(
  doc: SourceDocumentRow,
  opts?: { model?: string }
): Promise<PortfolioDocumentAnnotation> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const openai = new OpenAI({ apiKey });
  const model = opts?.model ?? DEFAULT_MODEL;
  const inputText = sliceForModel(doc);

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 800,
    messages: [
      {
        role: "system",
        content:
          "You extract structured research intelligence from scientific/funding/news documents. " +
          "Return JSON only, with no markdown and no prose outside JSON.",
      },
      {
        role: "user",
        content:
          "Extract a structured annotation with this schema:\n" +
          "{summary:string,themes:string[],methods:string[],diseases:string[]," +
          "translational_stage:'basic'|'preclinical'|'clinical'|'implementation'|'mixed'|'unknown'," +
          "funding_relevance_tags:string[],evidence_quotes:string[],confidence:number}\n\n" +
          "Rules:\n" +
          "- Base all fields only on provided text.\n" +
          "- Keep themes/methods/diseases concise canonical labels.\n" +
          "- evidence_quotes should be short verbatim snippets.\n" +
          "- confidence is 0..1.\n\n" +
          `Document:\n${inputText}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty model response.");
  const parsed = parseJsonObject(raw);
  return annotationSchema.parse(parsed);
}
