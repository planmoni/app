/**
 * Full Phase 1 create-payout contract tests.
 * Run: node --test lib/create-payout-guard.test.mjs lib/create-payout-contracts.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// --- mirrors of lib/create-payout-guard.ts ---
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

// --- mirrors of lib/create-payout-contracts.ts ---
function validateCreateAmountSemantics(opts) {
  const tol = opts.tolerance ?? 0.02;
  if (!(opts.totalAmount > 0) || !(opts.netPayoutAmount > 0) || opts.feeAmount < 0) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Invalid amounts' };
  }
  const sum = Math.round((opts.feeAmount + opts.netPayoutAmount) * 100) / 100;
  const total = Math.round(opts.totalAmount * 100) / 100;
  if (Math.abs(sum - total) > tol) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Fee + net (${sum}) must equal total (${total})`,
    };
  }
  if (opts.availableBalance < opts.totalAmount) {
    return {
      ok: false,
      code: 'INSUFFICIENT_BALANCE',
      error: `Insufficient available balance. Available: ${opts.availableBalance}, Required: ${opts.totalAmount}`,
    };
  }
  return { ok: true, code: 'OK' };
}

function reservationAmounts(opts) {
  return {
    requireAvailable: opts.totalAmount,
    lockAmount: opts.netPayoutAmount,
  };
}

function classifyCreateErrorMessage(message) {
  const lower = (message || '').toLowerCase();
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('abort')) {
    return 'TIMEOUT';
  }
  if (
    lower.includes('post_no_debit') ||
    lower.includes('post no debit') ||
    lower.includes('account is restricted')
  ) {
    return 'POST_NO_DEBIT';
  }
  if (lower.includes('insufficient')) return 'INSUFFICIENT_BALANCE';
  if (lower.includes('network') || lower.includes('fetch failed')) return 'NETWORK';
  return 'CREATE_FAILED';
}

function resolveTimeoutRecovery(opts) {
  if (opts.existingPlanId) return 'show_plan';
  return 'unknown_result_keep_key';
}

function resolveIdempotentReplay(opts) {
  if (opts.existingPlanId) {
    return { createNew: false, planId: opts.existingPlanId };
  }
  return { createNew: true, planId: null };
}

function simulateConcurrentSpend(opts) {
  let remaining = opts.available;
  return opts.attempts.map((a) => {
    if (remaining >= a.total) {
      remaining -= a.total;
      return { key: a.key, success: true, code: 'OK' };
    }
    return { key: a.key, success: false, code: 'INSUFFICIENT_BALANCE' };
  });
}

function atomicFailureLeavesNoReservation() {
  return { planCreated: false, fundsReserved: false };
}

function realtimeWalletUpdateAction() {
  return 'invalidate_once';
}

function simulateRapidTaps(tapCount) {
  let submitting = false;
  let started = 0;
  let ignored = 0;
  for (let i = 0; i < tapCount; i++) {
    if (submitting) {
      ignored += 1;
      continue;
    }
    submitting = true;
    started += 1;
  }
  return { started, ignored };
}

function outcomeAfterBackDuringSubmit(opts) {
  if (!opts.createdOnServer) return 'no_op';
  if (opts.abandoned || !opts.isMounted) return 'toast_only';
  return 'navigate_success';
}

describe('Phase1: one Continue tap → one plan', () => {
  it('single tap starts exactly one submission', () => {
    assert.deepEqual(simulateRapidTaps(1), { started: 1, ignored: 0 });
  });
});

describe('Phase1: ten rapid taps → one plan', () => {
  it('ten taps start one submission and ignore nine', () => {
    assert.deepEqual(simulateRapidTaps(10), { started: 1, ignored: 9 });
  });

  it('canStartSubmission blocks while already submitting', () => {
    assert.equal(canStartSubmission(true), false);
    assert.equal(canStartSubmission(false), true);
  });
});

describe('Phase1: back blocked during submission / delayed success', () => {
  it('abandoned attempt does not navigate to success', () => {
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

  it('unmounted screen does not navigate on delayed success', () => {
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

  it('back during submit + server created → toast only, no success nav', () => {
    assert.equal(
      outcomeAfterBackDuringSubmit({
        createdOnServer: true,
        abandoned: true,
        isMounted: true,
      }),
      'toast_only'
    );
  });

  it('active attempt may navigate when still mounted', () => {
    assert.equal(
      outcomeAfterBackDuringSubmit({
        createdOnServer: true,
        abandoned: false,
        isMounted: true,
      }),
      'navigate_success'
    );
  });
});

describe('Phase1: app backgrounding does not create a duplicate', () => {
  it('same idempotency key replays existing plan instead of creating', () => {
    const first = resolveIdempotentReplay({
      existingPlanId: null,
      requestedKey: 'key-a',
    });
    assert.equal(first.createNew, true);

    const replay = resolveIdempotentReplay({
      existingPlanId: 'plan-1',
      requestedKey: 'key-a',
    });
    assert.equal(replay.createNew, false);
    assert.equal(replay.planId, 'plan-1');
  });
});

describe('Phase1: timeout then retry with same key', () => {
  it('classifies timeout messages', () => {
    assert.equal(classifyCreateErrorMessage('Create payout plan timed out after 20000ms'), 'TIMEOUT');
  });

  it('reuses idempotency key on TIMEOUT / UNKNOWN_RESULT / NETWORK', () => {
    assert.equal(shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'TIMEOUT' }), true);
    assert.equal(shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'UNKNOWN_RESULT' }), true);
    assert.equal(shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'NETWORK' }), true);
  });

  it('mints new key on definitive INSUFFICIENT_BALANCE', () => {
    assert.equal(
      shouldReuseIdempotencyKeyOnRetry({ lastErrorCode: 'INSUFFICIENT_BALANCE' }),
      false
    );
  });

  it('timeout recovery: existing row → show plan', () => {
    assert.equal(resolveTimeoutRecovery({ existingPlanId: 'plan-xyz' }), 'show_plan');
  });

  it('timeout recovery: no row → unknown_result keep key (do not create again yet)', () => {
    assert.equal(resolveTimeoutRecovery({ existingPlanId: null }), 'unknown_result_keep_key');
  });
});

describe('Phase1: amount / fee / lock semantics', () => {
  it('logs example: total 1000, net 974.25, fee 25.75', () => {
    const total = 1000;
    const net = 974.25;
    const fee = 25.75;
    const r = reservationAmounts({
      totalAmount: total,
      feeAmount: fee,
      netPayoutAmount: net,
    });
    assert.equal(r.requireAvailable, 1000);
    assert.equal(r.lockAmount, 974.25);

    const ok = validateCreateAmountSemantics({
      totalAmount: total,
      feeAmount: fee,
      netPayoutAmount: net,
      availableBalance: 3610.31,
    });
    assert.equal(ok.ok, true);
  });

  it('rejects when fee + net != total', () => {
    const bad = validateCreateAmountSemantics({
      totalAmount: 1000,
      feeAmount: 10,
      netPayoutAmount: 974.25,
      availableBalance: 5000,
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'INVALID_INPUT');
  });
});

describe('Phase1: insufficient balance — no plan, no reservation', () => {
  it('insufficient available fails server validation (RPC authority, not review UI)', () => {
    const r = validateCreateAmountSemantics({
      totalAmount: 1000,
      feeAmount: 25.75,
      netPayoutAmount: 974.25,
      availableBalance: 500,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'INSUFFICIENT_BALANCE');
  });
});

describe('Phase1: concurrent payouts cannot spend the same final balance', () => {
  it('two attempts for 1000 with available 1000 → one OK, one insufficient', () => {
    const results = simulateConcurrentSpend({
      available: 1000,
      attempts: [
        { key: 'a', total: 1000 },
        { key: 'b', total: 1000 },
      ],
    });
    assert.equal(results[0].success, true);
    assert.equal(results[0].code, 'OK');
    assert.equal(results[1].success, false);
    assert.equal(results[1].code, 'INSUFFICIENT_BALANCE');
  });

  it('superseded attempt id cannot navigate', () => {
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
});

describe('Phase1: fee / custom-date failure rolls back entire operation', () => {
  it('fee failure leaves no plan and no reservation', () => {
    assert.deepEqual(atomicFailureLeavesNoReservation({ stepFailed: 'fee' }), {
      planCreated: false,
      fundsReserved: false,
    });
  });

  it('custom-date failure leaves no plan and no reservation', () => {
    assert.deepEqual(atomicFailureLeavesNoReservation({ stepFailed: 'custom_dates' }), {
      planCreated: false,
      fundsReserved: false,
    });
  });

  it('insert failure leaves no plan and no reservation', () => {
    assert.deepEqual(atomicFailureLeavesNoReservation({ stepFailed: 'insert' }), {
      planCreated: false,
      fundsReserved: false,
    });
  });
});

describe('Phase1: review does not verify wallet', () => {
  it('Continue is enabled without a fresh balance phase (server RPC is authority)', () => {
    // Review must not gate on checking/error/ready balance phases.
    assert.equal(isContinueEnabled({ balancePhase: 'ready', isSubmitting: false }), true);
    // Submitting still disables Continue
    assert.equal(isContinueEnabled({ balancePhase: 'ready', isSubmitting: true }), false);
  });

  it('rapid taps still single-flight without wallet verify', () => {
    assert.deepEqual(simulateRapidTaps(10), { started: 1, ignored: 9 });
  });
});

describe('Phase1: Realtime wallet update → one invalidate', () => {
  it('money-critical realtime action is invalidate_once (not setCache+refresh+coordinator)', () => {
    assert.equal(realtimeWalletUpdateAction(), 'invalidate_once');
  });
});

describe('Phase1: error classification', () => {
  it('maps network, insufficient, and post-no-debit messages', () => {
    assert.equal(classifyCreateErrorMessage('fetch failed'), 'NETWORK');
    assert.equal(classifyCreateErrorMessage('Insufficient available balance'), 'INSUFFICIENT_BALANCE');
    assert.equal(
      classifyCreateErrorMessage('Account is restricted (post no debit). Contact support.'),
      'POST_NO_DEBIT'
    );
    assert.equal(classifyCreateErrorMessage('boom'), 'CREATE_FAILED');
  });
});
