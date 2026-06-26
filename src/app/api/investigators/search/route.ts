import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

type InvHit = { id: string; full_name: string; email: string | null };

function nameSearchTokens(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function applyFullNameTokenSearch<T extends { ilike: (col: string, pattern: string) => T }>(
  query: T,
  q: string
): T {
  let next = query;
  for (const token of nameSearchTokens(q)) {
    next = next.ilike("full_name", `%${token}%`);
  }
  return next;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const communityRaw = (searchParams.get("communityId") ?? "").trim();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (communityRaw) {
    const cid = uuid.safeParse(communityRaw);
    if (!cid.success) {
      return NextResponse.json({ error: "Invalid communityId" }, { status: 400 });
    }

    let query = supabase
      .from("investigators")
      .select("id, full_name, email")
      .eq("research_community_id", cid.data)
      .order("full_name", { ascending: true })
      .limit(300);

    if (q.length >= 1) {
      query = applyFullNameTokenSearch(query, q);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      results: (data ?? []) as InvHit[],
    });
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [] as InvHit[] });
  }

  let query = supabase
    .from("investigators")
    .select("id, full_name, email")
    .order("full_name", { ascending: true })
    .limit(25);

  query = applyFullNameTokenSearch(query, q);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    results: (data ?? []) as InvHit[],
  });
}
