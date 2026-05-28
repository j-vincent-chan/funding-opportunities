import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runFundingChat, type FundingChatMessage } from "@/lib/ai/funding-chat";

export const maxDuration = 60;

const MAX_MESSAGES = 16;
const MAX_CONTENT_CHARS = 4_000;

function sanitizeMessages(input: unknown): FundingChatMessage[] | null {
  if (!Array.isArray(input)) return null;
  const out: FundingChatMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed.slice(0, MAX_CONTENT_CHARS) });
  }
  if (out.length === 0) return null;
  // Keep only the most recent turns to bound token usage.
  const recent = out.slice(-MAX_MESSAGES);
  if (recent[recent.length - 1].role !== "user") return null;
  return recent;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = sanitizeMessages((body as { messages?: unknown })?.messages);
  if (!messages) {
    return NextResponse.json(
      { ok: false, error: "Provide a non-empty messages array ending with a user message." },
      { status: 400 }
    );
  }

  const result = await runFundingChat(supabase, messages);
  if (!result.ok) {
    const status = result.error.includes("not configured") ? 503 : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
