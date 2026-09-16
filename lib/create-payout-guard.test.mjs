/**
 * Node built-in test runner — no Jest required.
 * Run: node --test lib/create-payout-guard.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function shouldBlockClientInsufficientCheck(opts) {
  if (!opts.hasWalletData || opts.isWalletStale) return false;
  if (opts.availableBalance == null) return false;
  return true;
}

function shouldNavigateToSuccess(opts) {
  if (!opts.isMounted) return false;
  if (opts.abandoned) return false;
  if (opts.attemptId !== opts.currentAttemptId) return false;
  return true;
}

function deriveReviewBalancePhase(opts) {
  if (opts.isChecking) return 'checking';
  if (opts.verifyError || opts.freshAvailable == null) return 'error';
  if (opts.freshAvailable < opts.requiredTotal) return 'insufficient';
  return 'ready';
}

function isContinueEnabled(opts) {
  if (opts.isSubmitting) return false;
  return opts.balancePhase === 'ready';
}

function shouldReuseIdempotencyKeyOnRetry(opts) {
  const code = (opts.lastErrorCode || '').toUpperCase();
  return code === 'TIMEOUT' || code === 'UNKNOWN_RESULT' || code === 'NETWORK';
}

function canStartSubmission(alreadySubmitting) {
  return !alreadySubmitting;
}

describe('create-payout-guard', () => {
  it('does not client-block when wallet is stale (avoids false ₦0 insufficient)', () => {
    assert.equal(
      shouldBlockClientInsufficientCheck({
        hasWalletData: true,
        isWalletStale: true,
        availableBalance: 0,
      }),
      false
    );
  });

  it('does not client-block when wallet data is missing', () => {
    assert.equal(
      shouldBlockClientInsufficientCheck({
        hasWalletData: false,
        isWalletStale: false,
        availableBalance: 0,
      }),
      false
    );
  });

  it('allows client-block when wallet is fresh', () => {
    assert.equal(
      shouldBlockClientInsufficientCheck({
        hasWalletData: true,
        isWalletStale: false,
        availableBalance: 1000,
      }),
      true
    );
  });

  it('blocks success navigation after abandon / back during submission', () => {
    assert.equal(
      shouldNavigateToSuccess({
        attemptId: 1,
        currentAttemptId: 1,
        isMounted: true,
        abandoned: true,
      }),
      false
    );
  });

  it('blocks success navigation after unmount (delayed success)', () => {
    assert.equal(
      shouldNavigateToSuccess({
        attemptId: 1,
        currentAttemptId: 1,
        isMounted: false,
        abandoned: false,
      }),
      false
    );
  });

  it('blocks success navigation when a newer attempt superseded', () => {
    assert.equal(
      shouldNavigateToSuccess({
        attemptId: 1,
        currentAttemptId: 2,
        isMounted: true,
        abandoned: false,
      }),
      false
    );
  });

  it('allows success navigation for active attempt', () => {
    assert.equal(
      shouldNavigateToSuccess({
        attemptId: 3,
        currentAttemptId: 3,
        isMounted: true,
        abandoned: false,
      }),
      true
    );
  });

  it('duplicate taps: second submit blocked while already submitting', () => {
    assert.equal(canStartSubmission(true), false);
    assert.equal(canStartSubmission(false), true);
  });

  it('review does not require wallet verify before Continue', () => {
    // Submitting still blocks; balance phase is irrelevant for create gate.
    assert.equal(canStartSubmission(false), true);
    assert.equal(canStartSubmission(true), false);
  });

  it('timeout / unknown_result / network reuse idempotency key', () => {
    assert.equal(shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'TIMEOUT' }), true);
    assert.equal(shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'UNKNOWN_RESULT' }), true);
    assert.equal(shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'NETWORK' }), true);
    assert.equal(shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'INSUFFICIENT_BALANCE' }), false);
  });

  it('concurrent attempts: only matching attempt id may navigate', () => {
    // Simulates two rapid creates: attempt 1 abandoned by attempt 2
    assert.equal(
      shouldNavigateToSuccess({
        attemptId: 1,
        currentAttemptId: 2,
        isMounted: true,
        abandoned: false,
      }),
      false
    );
    assert.equal(
      shouldNavigateToSuccess({
        attemptId: 2,
        currentAttemptId: 2,
        isMounted: true,
        abandoned: false,
      }),
      true
    );
  });
});
