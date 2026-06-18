/**
 * Reject if a promise does not settle within `ms` milliseconds.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Request'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Like withTimeout, but retries once after `retryDelayMs` if the first attempt
 * times out. On timeout, reconnects before retry.
 */
export async function withRetryOnTimeout<T>(
  factory: () => Promise<T>,
  ms: number,
  label = 'Request',
  retryDelayMs = 2000
): Promise<T> {
  try {
    return await withTimeout(factory(), ms, label);
  } catch (err) {
    if (err instanceof Error && err.message.includes('timed out')) {
      await new Promise<void>((r) => setTimeout(r, retryDelayMs));

      const { ensureSupabaseConnection } = await import('@/lib/supabase-connection');
      await ensureSupabaseConnection({ skipProbe: true, lightweight: true });

      return withTimeout(factory(), ms, `${label} (retry)`);
    }
    throw err;
  }
}
