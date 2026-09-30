/**
 * Cold-start wallet refresh rules.
 * Run: node --test lib/wallet-refresh-policy.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WALLET_REFETCH_INTERVAL,
  WALLET_REFETCH_ON_WINDOW_FOCUS,
  WALLET_STALE_MS,
  countWalletFetches,
  isExternalAppFlowActive,
  shouldEnsureConnectionOnFetchTimeout,
  shouldInvalidateWalletOnAuthEvent,
  shouldRefreshWalletOnResume,
  shouldRunConnectionGateOnColdStart,
  beginExternalAppFlow,
  endExternalAppFlow,
} from './wallet-refresh-policy.mjs';

describe('first open: one wallet fetch, no connection gate', () => {
  it('skips the connection gate and does not refetch on token refresh', () => {
    assert.equal(shouldRunConnectionGateOnColdStart(), false);
    assert.equal(shouldInvalidateWalletOnAuthEvent('INITIAL_SESSION'), false);
    assert.equal(shouldInvalidateWalletOnAuthEvent('TOKEN_REFRESHED'), false);
    assert.equal(shouldInvalidateWalletOnAuthEvent('SIGNED_IN'), true);

    const fetches = countWalletFetches([
      'cold_start',
      'INITIAL_SESSION',
      'TOKEN_REFRESHED',
      'navigation',
    ]);
    assert.equal(fetches, 1);
  });

  it('does not poll every 15 seconds or reconnect after a timeout', () => {
    assert.equal(WALLET_REFETCH_INTERVAL, false);
    assert.equal(WALLET_STALE_MS, 30_000);
    assert.equal(shouldEnsureConnectionOnFetchTimeout(), false);

    const fetches = countWalletFetches([
      'cold_start',
      'poll_15s',
      'poll_15s',
      'poll_15s',
      'fetch_timeout',
    ]);
    assert.equal(fetches, 1);
  });

  it('matches the cold-start log target: one fetch, silence on refresh, one fetch on resume', () => {
    const launches = countWalletFetches(['cold_start', 'INITIAL_SESSION']);
    assert.equal(launches, 1);

    const afterTokenRefresh = countWalletFetches([
      'cold_start',
      'INITIAL_SESSION',
      'TOKEN_REFRESHED',
    ]);
    assert.equal(afterTokenRefresh, 1);

    const afterResume = countWalletFetches([
      'cold_start',
      'TOKEN_REFRESHED',
      'foreground_after_away',
      'poll_15s',
      'navigation',
    ]);
    assert.equal(afterResume, 2);
  });

  it('refreshes the wallet once after a real resume, and not while Paystack is open', () => {
    assert.equal(WALLET_REFETCH_ON_WINDOW_FOCUS, false);
    assert.equal(shouldRefreshWalletOnResume(20_000), true);
    assert.equal(shouldRefreshWalletOnResume(2_000), false);

    beginExternalAppFlow();
    assert.equal(isExternalAppFlowActive(), true);
    assert.equal(shouldRefreshWalletOnResume(60_000), false);
    endExternalAppFlow();
    assert.equal(shouldRefreshWalletOnResume(20_000), true);
  });

  it('still fetches for a new login, a deposit, pull-to-refresh, and a real resume', () => {
    const fetches = countWalletFetches([
      'cold_start',
      'TOKEN_REFRESHED',
      'deposit',
      'pull_to_refresh',
      'foreground_after_away',
      'SIGNED_IN',
    ]);
    assert.equal(fetches, 5);
  });
});
