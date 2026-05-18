import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

type InvHit = { id: string; full_name: string; email: string | null };

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
      query = query.ilike("full_name", `%${q}%`);
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

  const { data, error } = await supabase
    .from("investigators")
    .select("id, full_name, email")
    .ilike("full_name", `%${q}%`)
    .order("full_name", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    results: (data ?? []) as InvHit[],
  });
}
