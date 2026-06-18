/**
 * Tracks in-flight Supabase HTTP requests so they can be aborted on timeout
 * or during reconnect (prevents zombie requests after background resume).
 */
const activeControllers = new Set<AbortController>();

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([a, b]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

export async function supabaseGlobalFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  activeControllers.add(controller);

  const signal = init?.signal
    ? mergeAbortSignals(controller.signal, init.signal)
    : controller.signal;

  try {
    const response = await fetch(input, { ...init, signal });
    return response;
  } finally {
    activeControllers.delete(controller);
  }
}

export function abortAllSupabaseFetches(): void {
  activeControllers.forEach((controller) => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  });
  activeControllers.clear();
}
