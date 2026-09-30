/**
 * When the app may fetch the wallet after the first-open timeout fix.
 * Cold start: one fetch. Token refresh and the old 15s poll must not fetch again.
 */

export const WALLET_STALE_MS = 30_000;

/** No background interval. Realtime, deposits, and pull-to-refresh still refresh. */
export const WALLET_REFETCH_INTERVAL = false;

/** Resume owns the one foreground fetch. Focus must not start a second one. */
export const WALLET_REFETCH_ON_WINDOW_FOCUS = false;

/** Shorter than this is a shade blip or a quick app switch, not a resume. */
export const MIN_RESUME_AWAY_MS = 10_000;

let externalAppFlowDepth = 0;

export function beginExternalAppFlow() {
  externalAppFlowDepth += 1;
}

export function endExternalAppFlow() {
  externalAppFlowDepth = Math.max(0, externalAppFlowDepth - 1);
}

export function isExternalAppFlowActive() {
  return externalAppFlowDepth > 0;
}

export function shouldRefreshWalletOnResume(awayMs) {
  if (isExternalAppFlowActive()) return false;
  return awayMs >= MIN_RESUME_AWAY_MS;
}

export function shouldInvalidateWalletOnAuthEvent(event) {
  return event === 'SIGNED_IN';
}

export function shouldRunConnectionGateOnColdStart() {
  return false;
}

/** A timed-out read must not start ensure/reconnect/probe before retrying. */
export function shouldEnsureConnectionOnFetchTimeout() {
  return false;
}

/**
 * Count wallet network fetches for a sequence of app events.
 * Used to lock the cold-start behavior that the device logs showed.
 */
export function countWalletFetches(events) {
  let fetches = 0;
  for (const event of events) {
    if (event === 'cold_start') {
      fetches += 1;
    } else if (event === 'pull_to_refresh' || event === 'deposit' || event === 'foreground_after_away') {
      fetches += 1;
    } else if (event === 'SIGNED_IN') {
      fetches += 1;
    } else if (
      event === 'TOKEN_REFRESHED' ||
      event === 'INITIAL_SESSION' ||
      event === 'poll_15s' ||
      event === 'navigation' ||
      event === 'fetch_timeout'
    ) {
      // no extra fetch
    } else {
      throw new Error(`Unknown wallet event: ${event}`);
    }
  }
  return fetches;
}
