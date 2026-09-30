/**
 * Reject if a promise does not settle within `ms` milliseconds.
 * When an AbortController is provided, abort the underlying HTTP on timeout
 * so the request does not keep running after the client has moved on.
 */
import { runWithAbortSignal } from '@/lib/supabase-http';

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Request',
  options?: { abort?: AbortController }
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        options?.abort?.abort();
      } catch {
        // ignore
      }
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

/**
 * Run a factory under an AbortSignal that fires when the timeout expires.
 * Prefer this for Supabase queries so PostgREST HTTP is cancelled.
 */
export async function withAbortableTimeout<T>(
  factory: () => Promise<T>,
  ms: number,
  label = 'Request'
): Promise<T> {
  const abort = new AbortController();
  return runWithAbortSignal(abort.signal, () =>
    withTimeout(factory(), ms, label, { abort })
  );
}

/**
 * Like withTimeout, but retries once after `retryDelayMs` if maxRetries >= 1.
 * Does not run a connection reconnect before the retry.
 */
export async function withRetryOnTimeout<T>(
  factory: () => Promise<T>,
  ms: number,
  label = 'Request',
  retryDelayMs = 2000,
  options?: { maxRetries?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 0;

  try {
    return await withAbortableTimeout(factory, ms, label);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('timed out')) {
      throw err;
    }
    if (maxRetries < 1) {
      throw err;
    }

    const { isFinancialMutationActive } = await import(
      '@/lib/financial-mutation-gate'
    );
    // Don't queue a second hung request while create-payout needs bandwidth.
    if (isFinancialMutationActive()) {
      throw err;
    }

    await new Promise<void>((r) => setTimeout(r, retryDelayMs));
    return withAbortableTimeout(factory, ms, `${label} (retry)`);
  }
}
