/**
 * Global fetch for Supabase with optional AbortSignal.
 * Timeouts abort the underlying HTTP so hung PostgREST calls do not keep
 * occupying the connection after the client has moved on.
 *
 * Every request registers its AbortController. abortAllSupabaseFetches()
 * drops sockets that iOS left hanging across a long background. New requests
 * after that abort get fresh controllers.
 */

type AbortContext = {
  signal: AbortSignal;
};

const abortStack: AbortContext[] = [];
const inFlight = new Set<AbortController>();

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
  inFlight.add(controller);
  const signal = combineSignals(init?.signal ?? getActiveAbortSignal(), controller);
  try {
    return await fetch(input, {
      ...init,
      signal,
    });
  } finally {
    inFlight.delete(controller);
  }
}

/**
 * Abort every in-flight Supabase HTTP call.
 * Used when the app leaves the foreground, and again before the resume refetch,
 * so a dead socket cannot hold the auth lock.
 */
export function abortAllSupabaseFetches(): void {
  const pending = [...inFlight];
  inFlight.clear();
  for (const controller of pending) {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }
}
