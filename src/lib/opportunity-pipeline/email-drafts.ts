import type { EmailDraftMode } from "@/lib/opportunity-pipeline/constants";

export type EmailDraftContext = {
  piName: string;
  piEmail?: string | null;
  opportunityTitle: string;
  sponsorOrMechanism: string;
  deadlineLine: string;
  fitRationale: string;
  senderSignoff?: string;
};

function greeting(ctx: EmailDraftContext) {
  const first = ctx.piName.trim().split(/\s+/)[0] ?? "there";
  return `Dear ${first},`;
}

export function buildOutreachEmailDraft(mode: EmailDraftMode, ctx: EmailDraftContext): string {
  const g = greeting(ctx);
  const sign = ctx.senderSignoff?.trim() || "Best regards";

  const core = [
    "",
    `Opportunity: ${ctx.opportunityTitle}`,
    `Sponsor / mechanism: ${ctx.sponsorOrMechanism}`,
    `Deadline: ${ctx.deadlineLine}`,
    "",
    ctx.fitRationale.trim() ? `Context: ${ctx.fitRationale.trim()}` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  if (mode === "exploratory") {
    return [
      g,
      "",
      "I hope you are well. I came across a funding notice that may be relevant to your work and wanted to surface it in case it is worth a quick look.",
      core,
      "If this does not fit your current priorities, no need to reply—just let me know if you would like a brief call to discuss.",
      "",
      sign,
    ].join("\n");
  }

  if (mode === "recommended") {
    return [
      g,
      "",
      "I believe the attached notice aligns strongly with your research program and may be worth prioritizing while timing allows.",
      core,
      "If you are open to it, I can help sketch a one-page fit summary or connect you with RDSG resources for a deeper read.",
      "",
      sign,
    ].join("\n");
  }

  return [
    g,
    "",
    "This opportunity may benefit from a collaborative team, and your expertise came to mind as a natural anchor or partner depending on how the science evolves.",
    core,
    "If you see complementary angles with colleagues in your division, we can help coordinate an initial conversation.",
    "",
    sign,
  ].join("\n");
}
