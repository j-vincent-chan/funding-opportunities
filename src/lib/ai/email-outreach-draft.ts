import OpenAI from "openai";

const MODEL = "gpt-4o-mini";

export type EmailDraftTransform = "shorten" | "lengthen" | "revise";

export async function transformOutreachEmailDraft(
  body: string,
  mode: EmailDraftTransform,
  instruction?: string
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY is not configured." };
  }
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Nothing to transform." };

  const openai = new OpenAI({ apiKey });
  const sys =
    mode === "shorten"
      ? "You tighten professional outreach emails. Preserve meaning and tone. Output only the revised email body, no quotes or preamble. Aim for roughly 40% fewer words unless that would omit a key deadline or title."
      : mode === "lengthen"
        ? "You expand professional outreach emails with one brief clarifying sentence where helpful. Output only the revised email body, no quotes or preamble. Add at most 3–4 sentences."
        : "You revise professional outreach emails per the user's instruction. Output only the revised email body, no quotes or preamble.";

  const user =
    mode === "revise" && instruction?.trim()
      ? `Instruction:\n${instruction.trim()}\n\nEmail:\n${trimmed}`
      : `Email:\n${trimmed}`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 1_200,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: "Empty model response." };
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
