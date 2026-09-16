/**

 * Pure contracts for Phase 1 payout create.

 * Keep free of React Native / Supabase so Node can unit-test.

 */



export type PayoutErrorCode =

  | 'OK'

  | 'INSUFFICIENT_BALANCE'

  | 'INVALID_INPUT'

  | 'INVALID_ACCOUNT'

  | 'UNAUTHENTICATED'

  | 'WALLET_NOT_FOUND'

  | 'LOCK_FAILED'

  | 'POST_NO_DEBIT'

  | 'CREATE_FAILED'

  | 'TIMEOUT'

  | 'UNKNOWN_RESULT'

  | 'NETWORK'

  | 'CONFLICT';



/** Server money semantics: available must cover total; lock net only. */

export function validateCreateAmountSemantics(opts: {

  totalAmount: number;

  feeAmount: number;

  netPayoutAmount: number;

  availableBalance: number;

  tolerance?: number;

}): { ok: boolean; code?: PayoutErrorCode; error?: string } {

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



/** What amount is reserved (locked) vs required from available. */

export function reservationAmounts(opts: {

  totalAmount: number;

  feeAmount: number;

  netPayoutAmount: number;

}): { requireAvailable: number; lockAmount: number } {

  return {

    requireAvailable: opts.totalAmount,

    lockAmount: opts.netPayoutAmount,

  };

}



export function classifyCreateErrorMessage(message: string): PayoutErrorCode {

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



/**

 * After RPC timeout: look up same idempotency key before minting a new attempt.

 * Returns next client action.

 */

export function resolveTimeoutRecovery(opts: {

  existingPlanId: string | null;

}): 'show_plan' | 'unknown_result_keep_key' {

  if (opts.existingPlanId) return 'show_plan';

  return 'unknown_result_keep_key';

}



/**

 * Idempotent RPC replay: same key must never create a second plan.

 */

export function resolveIdempotentReplay(opts: {

  existingPlanId: string | null;

  requestedKey: string;

}): { createNew: boolean; planId: string | null } {

  if (opts.existingPlanId) {

    return { createNew: false, planId: opts.existingPlanId };

  }

  return { createNew: true, planId: null };

}



/**

 * Concurrent creates with different keys against the same final balance:

 * only one can succeed if each needs the full available.

 */

export function simulateConcurrentSpend(opts: {

  available: number;

  attempts: Array<{ key: string; total: number }>;

}): Array<{ key: string; success: boolean; code: PayoutErrorCode }> {

  let remaining = opts.available;

  return opts.attempts.map((a) => {

    if (remaining >= a.total) {

      remaining -= a.total;

      return { key: a.key, success: true, code: 'OK' as const };

    }

    return { key: a.key, success: false, code: 'INSUFFICIENT_BALANCE' as const };

  });

}



/**

 * Atomic failure: if any step fails after lock, nothing remains

 * (plan row + reservation rolled back). Modeled as outcome only.

 */

export function atomicFailureLeavesNoReservation(opts: {

  stepFailed: 'fee' | 'custom_dates' | 'insert';

}): { planCreated: boolean; fundsReserved: boolean } {

  // In one DB transaction, any failure rolls back lock + insert + dates.

  void opts.stepFailed;

  return { planCreated: false, fundsReserved: false };

}



/** Realtime money-critical policy: invalidate once, do not stack refreshes. */

export function realtimeWalletUpdateAction(): 'invalidate_once' {

  return 'invalidate_once';

}



/**

 * Single-flight submission simulator for N rapid taps.

 */

export function simulateRapidTaps(tapCount: number): { started: number; ignored: number } {

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

    // first tap holds the lock for the attempt

  }

  return { started, ignored };

}



/** Back during submission must not navigate to success when result arrives late. */

export function outcomeAfterBackDuringSubmit(opts: {

  createdOnServer: boolean;

  abandoned: boolean;

  isMounted: boolean;

}): 'navigate_success' | 'toast_only' | 'no_op' {

  if (!opts.createdOnServer) return 'no_op';

  if (opts.abandoned || !opts.isMounted) return 'toast_only';

  return 'navigate_success';

}


