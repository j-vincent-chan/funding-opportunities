"use server";

import {
  transformOutreachEmailDraft,
  type EmailDraftTransform,
} from "@/lib/ai/email-outreach-draft";

export async function transformEmailOutreachDraftAction(input: {
  body: string;
  mode: EmailDraftTransform;
  instruction?: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  return transformOutreachEmailDraft(input.body, input.mode, input.instruction);
}
