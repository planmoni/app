/**
 * Global fetch for Supabase — passthrough to native fetch.
 * Per-request abort tracking was causing mass-abort of in-flight loads on reconnect.
 */
export async function supabaseGlobalFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, init);
}

export function abortAllSupabaseFetches(): void {
  // No-op: mass abort was killing active loads and leaving spinners stuck.
}
