/** Normalize Supabase embedded relation (object | array) to a single row. */
export function singleRelation<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
