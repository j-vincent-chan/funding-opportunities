/**
 * Serializes async work with a minimum spacing between starts.
 * Safe under concurrent callers (unlike a bare lastRequestAt timestamp).
 */
export class AsyncRateLimiter {
  private lastAt = 0;
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  /** Wait for the next slot, then run `fn`. Concurrent callers queue in order. */
  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const now = Date.now();
      const wait = this.minIntervalMs - (now - this.lastAt);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastAt = Date.now();
      return fn();
    };

    const result = this.tail.then(run, run);
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

export async function runWorkerPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const workers = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  async function runOneWorker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => runOneWorker()));
}
