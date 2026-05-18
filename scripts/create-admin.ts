/**
 * One-off: create or update an admin user via Supabase Admin API.
 *
 * Usage:
 *   ADMIN_EMAIL=x ADMIN_PASSWORD=y npx tsx scripts/create-admin.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL?.trim() ?? "";
const adminPassword = process.env.ADMIN_PASSWORD ?? "";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!adminEmail || !adminPassword) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(target: string): Promise<string | null> {
  const normalized = target.toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: "ImmunoX",
      role: "admin",
    },
  });

  let userId: string;

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (
      !msg.includes("already") &&
      !msg.includes("registered") &&
      !msg.includes("exists")
    ) {
      console.error("createUser failed:", createErr.message);
      process.exit(1);
    }
    const existingId = await findUserIdByEmail(adminEmail);
    if (!existingId) {
      console.error("User appears to exist but could not be found by email.");
      process.exit(1);
    }
    userId = existingId;
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "ImmunoX",
        role: "admin",
      },
    });
    if (updErr) {
      console.error("updateUserById failed:", updErr.message);
      process.exit(1);
    }
    console.log("Updated existing user:", adminEmail);
  } else {
    userId = created.user.id;
    console.log("Created user:", adminEmail);
  }

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ role: "admin", full_name: "ImmunoX" })
    .eq("id", userId);

  if (pErr) {
    console.error("profiles update failed:", pErr.message);
    process.exit(1);
  }

  console.log("Profile role set to admin. User id:", userId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
