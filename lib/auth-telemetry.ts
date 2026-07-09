import { logAnalyticsEvent } from '@/lib/firebase';

type AuthTelemetryParams = Record<string, string | number | boolean | undefined>;

export function logAuthTelemetry(event: string, params?: AuthTelemetryParams): void {
  void logAnalyticsEvent(`auth_flow_${event}`, {
    ...params,
    ts: Date.now(),
  });
}

/** Defensive: should never fire while enabled: isAuthReady && !!userId holds. */
export function logAuthQueryGateViolation(
  query: string,
  isAuthReady: boolean,
  userId?: string
): void {
  if (isAuthReady) return;

  logAuthTelemetry('query_gate_violation', {
    query,
    isAuthReady,
    userId,
  });

  if (__DEV__) {
    console.warn(`[auth] query_gate_violation: ${query}`, { isAuthReady, userId });
  }
}
