/** Matches Signal `src/lib/investigator-headshots.ts` (public bucket + object path). */
export const SIGNAL_INVESTIGATOR_HEADSHOTS_BUCKET = "investigator-headshots";

export function signalInvestigatorHeadshotPublicUrl(
  storagePath: string | null | undefined,
  signalSupabaseUrl = process.env.NEXT_PUBLIC_SIGNAL_SUPABASE_URL?.trim().replace(/\/+$/, "") ?? ""
): string | null {
  const path = storagePath?.trim();
  if (!path || !signalSupabaseUrl) return null;
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${signalSupabaseUrl}/storage/v1/object/public/${SIGNAL_INVESTIGATOR_HEADSHOTS_BUCKET}/${encodedPath}`;
}

/** Storage-backed Signal headshot wins over external CSV `headshot_url`. */
export function resolveSignalHeadshotUrl(
  input: {
    headshot_url?: string | null;
    headshot_storage_path?: string | null;
  },
  signalSupabaseUrl?: string
): string | null {
  const fromStorage = signalInvestigatorHeadshotPublicUrl(
    input.headshot_storage_path,
    signalSupabaseUrl
  );
  if (fromStorage) return fromStorage;

  const external = input.headshot_url?.trim() ?? "";
  if (external && /^https?:\/\//i.test(external)) return external;

  return null;
}
