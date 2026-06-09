"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin-service";
import { createClient } from "@/lib/supabase/server";

const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name is too long");

const emailSchema = z
  .string()
  .trim()
  .max(320, "Email is too long")
  .transform((value) => (value === "" ? null : value.toLowerCase()))
  .refine((value) => value === null || z.string().email().safeParse(value).success, "Invalid email");

const rdsgOwnerIdSchema = z.string().uuid("Invalid RDSG id");

type ActionResult = { ok: true } | { ok: false; error: string };

async function adminWriteClient(): Promise<
  | { ok: true; supabase: NonNullable<ReturnType<typeof createServiceRoleClient>> }
  | { ok: false; error: string }
> {
  const sessionClient = createClient();
  const admin = await requireAdmin(sessionClient);
  if (!admin.ok) return { ok: false, error: admin.error };

  const supabase = createServiceRoleClient();
  if (!supabase) return { ok: false, error: "Service role client is not configured." };

  return { ok: true, supabase };
}

function mapRdsgOwnerError(message: string): string {
  if (/rdsg_owners_full_name_unique/i.test(message) || /duplicate key.*full_name/i.test(message)) {
    return "An RDSG with this name already exists.";
  }
  if (/rdsg_owners_email_unique/i.test(message) || /duplicate key.*email/i.test(message)) {
    return "This email is already assigned to another RDSG.";
  }
  return message;
}

export async function createRdsgOwnerAction(input: {
  fullName: string;
  email?: string;
}): Promise<ActionResult & { id?: string }> {
  const parsedName = fullNameSchema.safeParse(input.fullName);
  if (!parsedName.success) {
    return { ok: false, error: parsedName.error.issues[0]?.message ?? "Invalid name" };
  }

  const parsedEmail = emailSchema.safeParse(input.email ?? "");
  if (!parsedEmail.success) {
    return { ok: false, error: parsedEmail.error.issues[0]?.message ?? "Invalid email" };
  }

  const clientRes = await adminWriteClient();
  if (!clientRes.ok) return clientRes;

  const { data, error } = await clientRes.supabase
    .from("rdsg_owners")
    .insert({
      full_name: parsedName.data,
      email: parsedEmail.data,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: mapRdsgOwnerError(error.message) };

  revalidatePath("/settings");
  revalidatePath("/funding-opportunities");
  revalidatePath("/match/saved");
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateRdsgOwnerAction(input: {
  id: string;
  fullName: string;
  email?: string;
}): Promise<ActionResult> {
  const parsedId = rdsgOwnerIdSchema.safeParse(input.id);
  if (!parsedId.success) return { ok: false, error: "Invalid RDSG id." };

  const parsedName = fullNameSchema.safeParse(input.fullName);
  if (!parsedName.success) {
    return { ok: false, error: parsedName.error.issues[0]?.message ?? "Invalid name" };
  }

  const parsedEmail = emailSchema.safeParse(input.email ?? "");
  if (!parsedEmail.success) {
    return { ok: false, error: parsedEmail.error.issues[0]?.message ?? "Invalid email" };
  }

  const clientRes = await adminWriteClient();
  if (!clientRes.ok) return clientRes;

  const { error } = await clientRes.supabase
    .from("rdsg_owners")
    .update({
      full_name: parsedName.data,
      email: parsedEmail.data,
    })
    .eq("id", parsedId.data);

  if (error) return { ok: false, error: mapRdsgOwnerError(error.message) };

  revalidatePath("/settings");
  revalidatePath("/funding-opportunities");
  revalidatePath("/match/saved");
  return { ok: true };
}

export async function deleteRdsgOwnerAction(input: { id: string }): Promise<ActionResult> {
  const parsedId = rdsgOwnerIdSchema.safeParse(input.id);
  if (!parsedId.success) return { ok: false, error: "Invalid RDSG id." };

  const clientRes = await adminWriteClient();
  if (!clientRes.ok) return clientRes;

  const { error } = await clientRes.supabase
    .from("rdsg_owners")
    .update({ is_active: false })
    .eq("id", parsedId.data);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/funding-opportunities");
  revalidatePath("/match/saved");
  return { ok: true };
}

export async function reactivateRdsgOwnerAction(input: { id: string }): Promise<ActionResult> {
  const parsedId = rdsgOwnerIdSchema.safeParse(input.id);
  if (!parsedId.success) return { ok: false, error: "Invalid RDSG id." };

  const clientRes = await adminWriteClient();
  if (!clientRes.ok) return clientRes;

  const { error } = await clientRes.supabase
    .from("rdsg_owners")
    .update({ is_active: true })
    .eq("id", parsedId.data);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/funding-opportunities");
  revalidatePath("/match/saved");
  return { ok: true };
}
