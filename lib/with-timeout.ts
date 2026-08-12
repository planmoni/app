/**
 * Reject if a promise does not settle within `ms` milliseconds.
 * Settles at most once — late underlying resolve/reject cannot cause
 * unhandled rejections after the timeout already fired.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Request'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Min gap between ensure calls triggered by fetch timeouts (ms). */
const RETRY_ENSURE_COOLDOWN_MS = 15_000;
let lastRetryEnsureAt = 0;

/**
 * Like withTimeout, but retries once after `retryDelayMs` if the first attempt
 * times out. Only lightly reconnects if we have not just done so (avoids
 * getSession stampede on resume).
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

      const now = Date.now();
      if (now - lastRetryEnsureAt >= RETRY_ENSURE_COOLDOWN_MS) {
        lastRetryEnsureAt = now;
        try {
          const { ensureSupabaseConnection } = await import('@/lib/supabase-connection');
          await ensureSupabaseConnection({ skipProbe: true, lightweight: true });
        } catch {
          // Non-fatal — still attempt the data retry.
        }
      }

      return withTimeout(factory(), ms, `${label} (retry)`);
    }
    throw err;
  }
}
