/**
 * Dev-facing timing / stage logs for Supabase cold-start diagnosis.
 * Never logs tokens.
 */

export type TimedOpMeta = {
  operation: string;
  userId?: string | null;
  hasSession?: boolean;
  sessionExpiresAt?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  [key: string]: unknown;
};

function newRequestId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function timedOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  meta: Omit<TimedOpMeta, 'operation'> = {}
): Promise<T> {
  const requestId = newRequestId();
  const started = Date.now();

  if (__DEV__) {
    console.log(`[supabase:op:start]`, {
      requestId,
      operation,
      userId: meta.userId ?? null,
      hasSession: meta.hasSession ?? null,
      sessionExpiresAt: meta.sessionExpiresAt ?? null,
    });
  }

  try {
    const result = await fn();
    if (__DEV__) {
      console.log(`[supabase:op:ok]`, {
        requestId,
        operation,
        elapsedMs: Date.now() - started,
        userId: meta.userId ?? null,
      });
    }
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err ?? '');
    const errorCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code ?? '')
        : null;

    if (__DEV__) {
      console.warn(`[supabase:op:fail]`, {
        requestId,
        operation,
        elapsedMs: Date.now() - started,
        userId: meta.userId ?? null,
        hasSession: meta.hasSession ?? null,
        sessionExpiresAt: meta.sessionExpiresAt ?? null,
        errorCode,
        errorMessage,
      });
    }
    throw err;
  }
}
