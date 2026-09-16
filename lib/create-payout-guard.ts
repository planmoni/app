/**

 * Pure helpers for create-payout single-flight / abandon safety / review phases.

 * Keep free of React Native imports so Node can unit-test these.

 */



export type CreatePayoutPhase =

  | 'idle'

  | 'checking_balance'

  | 'ready'

  | 'submitting'

  | 'created'

  | 'insufficient_balance'

  | 'balance_error'

  | 'unknown_result'

  | 'failed';



export type ReviewBalancePhase = 'checking' | 'ready' | 'insufficient' | 'error';



export function shouldBlockClientInsufficientCheck(opts: {

  hasWalletData: boolean;

  isWalletStale: boolean;

  availableBalance: number | null | undefined;

}): boolean {

  // Review must use a fresh verify — never treat stale cache as authoritative.

  if (!opts.hasWalletData || opts.isWalletStale) return false;

  if (opts.availableBalance == null) return false;

  return true;

}



export function deriveReviewBalancePhase(opts: {

  isChecking: boolean;

  verifyError: boolean;

  freshAvailable: number | null;

  requiredTotal: number;

}): ReviewBalancePhase {

  if (opts.isChecking) return 'checking';

  if (opts.verifyError || opts.freshAvailable == null) return 'error';

  if (opts.freshAvailable < opts.requiredTotal) return 'insufficient';

  return 'ready';

}



export function canSubmitPayoutReview(opts: {

  balancePhase: ReviewBalancePhase;

  isSubmitting: boolean;

}): boolean {

  if (opts.isSubmitting) return false;

  return opts.balancePhase === 'ready' || opts.balancePhase === 'insufficient';

}



/** Continue enabled only when fresh balance is ready and sufficient. */

export function isContinueEnabled(opts: {

  balancePhase: ReviewBalancePhase;

  isSubmitting: boolean;

}): boolean {

  if (opts.isSubmitting) return false;

  return opts.balancePhase === 'ready';

}



export function shouldNavigateToSuccess(opts: {

  attemptId: number;

  currentAttemptId: number;

  isMounted: boolean;

  abandoned: boolean;

}): boolean {

  if (!opts.isMounted) return false;

  if (opts.abandoned) return false;

  if (opts.attemptId !== opts.currentAttemptId) return false;

  return true;

}



export function shouldReuseIdempotencyKeyOnRetry(opts: {

  lastErrorCode: string | null | undefined;

}): boolean {

  const code = (opts.lastErrorCode || '').toUpperCase();

  return code === 'TIMEOUT' || code === 'UNKNOWN_RESULT' || code === 'NETWORK';

}



export function nextAttemptId(current: number): number {

  return current + 1;

}



export function makeIdempotencyKey(): string {

  try {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any

    const c = (globalThis as any).crypto;

    if (c?.randomUUID) return c.randomUUID();

  } catch {

    // ignore

  }

  return `payout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

}



/** Single-flight gate for duplicate taps. */

export function canStartSubmission(alreadySubmitting: boolean): boolean {

  return !alreadySubmitting;

}


