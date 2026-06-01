/** Paginate PostgREST queries (Supabase default max is 1000 rows per request). */

export const SUPABASE_PAGE_SIZE = 1000;

export const DEFAULT_FETCH_ALL_MAX_ROWS = 200_000;

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  opts: { pageSize?: number; maxRows?: number } = {}
): Promise<{ data: T[]; error: string | null; truncated: boolean }> {
  const pageSize = opts.pageSize ?? SUPABASE_PAGE_SIZE;
  const maxRows = opts.maxRows ?? DEFAULT_FETCH_ALL_MAX_ROWS;
  const all: T[] = [];
  let from = 0;
  let truncated = false;

  while (from < maxRows) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const { data, error } = await fetchPage(from, to);
    if (error) return { data: all, error: error.message, truncated: false };

    const page = data ?? [];
    all.push(...page);
    if (page.length < to - from + 1) break;
    from += pageSize;
    if (from >= maxRows) {
      truncated = true;
      break;
    }
  }

  return { data: all, error: null, truncated };
}

export async function fetchExactCount(
  runCount: () => Promise<{ count: number | null; error: { message: string } | null }>
): Promise<number | null> {
  const { count, error } = await runCount();
  if (error) return null;
  return count;
}
