/**
 * Global fetch for Supabase with optional AbortSignal.
 * Timeouts abort the underlying HTTP so hung PostgREST calls do not keep
 * occupying the connection after the client has moved on.
 *
 * Mass abort remains a no-op (unsafe). Per-request abort is opt-in via
 * runWithAbortSignal / withTimeout's AbortController.
 */

type AbortContext = {
  signal: AbortSignal;
};

const abortStack: AbortContext[] = [];

export function getActiveAbortSignal(): AbortSignal | undefined {
  return abortStack.length > 0 ? abortStack[abortStack.length - 1]!.signal : undefined;
}

export async function runWithAbortSignal<T>(
  signal: AbortSignal,
  fn: () => Promise<T>
): Promise<T> {
  abortStack.push({ signal });
  try {
    return await fn();
  } finally {
    abortStack.pop();
  }
}

function combineSignals(
  external: AbortSignal | undefined,
  internal: AbortController
): AbortSignal {
  if (!external) return internal.signal;
  if (external.aborted) {
    internal.abort();
    return internal.signal;
  }
  const onAbort = () => {
    try {
      internal.abort();
    } catch {
      // ignore
    }
  };
  external.addEventListener('abort', onAbort, { once: true });
  internal.signal.addEventListener(
    'abort',
    () => external.removeEventListener('abort', onAbort),
    { once: true }
  );
  return internal.signal;
}

export async function supabaseGlobalFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const signal = combineSignals(init?.signal ?? getActiveAbortSignal(), controller);
  return fetch(input, {
    ...init,
    signal,
  });
}

/** @deprecated Mass abort is unsafe — prefer per-request AbortSignal. */
export function abortAllSupabaseFetches(): void {
  // No-op: mass abort was killing active loads and leaving spinners stuck.
}
