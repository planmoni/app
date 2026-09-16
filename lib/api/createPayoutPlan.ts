/**
 * Thin client API for payout plan creation.
 * Screen → createPayoutPlan() → create_payout_plan_atomic RPC.
 * No client-side lock_funds / insert / fee / dates orchestration.
 */

import { supabase } from '@/lib/supabase';
import { withAbortableTimeout } from '@/lib/with-timeout';
import { timedOperation } from '@/lib/supabase-timing';
import { makeIdempotencyKey } from '@/lib/create-payout-guard';

export const CREATE_PAYOUT_RPC_TIMEOUT_MS = 20_000;
export const IDEMPOTENCY_LOOKUP_TIMEOUT_MS = 8_000;

export type CreatePayoutPlanInput = {
  name: string;
  description?: string;
  totalAmount: number;
  payoutAmount: number;
  feeAmount: number;
  netPayoutAmount: number;
  feePercentage: number;
  frequency: string;
  duration: number;
  startDate: string;
  nextPayoutDate: string;
  payoutAccountId?: string | null;
  bankAccountId?: string | null;
  emergencyWithdrawalEnabled?: boolean;
  dayOfWeek?: number;
  payoutHour?: number;
  payoutMinute?: number;
  purpose?: string;
  purposeOther?: string;
  metadata?: Record<string, unknown>;
  customDates?: string[];
  customDateAmounts?: Record<string, string>;
  customDateTimes?: Record<string, string>;
  /** Required for retries — must be stable for one attempt. */
  idempotencyKey: string;
  flowId?: string;
  requestId?: string;
};

export type CreatePayoutPlanCode =
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
  | 'NETWORK';

export type CreatePayoutPlanResult = {
  success: boolean;
  code: CreatePayoutPlanCode;
  error?: string;
  idempotent?: boolean;
  planId?: string;
  plan?: Record<string, unknown> | null;
  wallet?: {
    balance: number;
    locked_balance: number;
    available_balance: number;
  } | null;
  idempotencyKey: string;
  flowId: string;
  requestId: string;
};

export class CreatePayoutPlanError extends Error {
  code: CreatePayoutPlanCode;
  flowId: string;
  requestId: string;
  idempotencyKey: string;

  constructor(
    message: string,
    code: CreatePayoutPlanCode,
    ctx: { flowId: string; requestId: string; idempotencyKey: string }
  ) {
    super(message);
    this.name = 'CreatePayoutPlanError';
    this.code = code;
    this.flowId = ctx.flowId;
    this.requestId = ctx.requestId;
    this.idempotencyKey = ctx.idempotencyKey;
  }
}

function makeRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeFlowId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizePayoutError(
  err: unknown,
  ctx: { flowId: string; requestId: string; idempotencyKey: string }
): CreatePayoutPlanError {
  if (err instanceof CreatePayoutPlanError) return err;

  const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const lower = message.toLowerCase();

  let code: CreatePayoutPlanCode = 'CREATE_FAILED';
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('abort')) {
    code = 'TIMEOUT';
  } else if (
    lower.includes('post_no_debit') ||
    lower.includes('post no debit') ||
    lower.includes('account is restricted')
  ) {
    code = 'POST_NO_DEBIT';
  } else if (lower.includes('insufficient')) {
    code = 'INSUFFICIENT_BALANCE';
  } else if (lower.includes('network') || lower.includes('fetch failed')) {
    code = 'NETWORK';
  }

  return new CreatePayoutPlanError(message, code, ctx);
}

type RpcPayload = {
  success?: boolean;
  code?: string;
  error?: string;
  idempotent?: boolean;
  plan_id?: string;
  plan?: Record<string, unknown> | null;
  wallet?: {
    balance?: number;
    locked_balance?: number;
    available_balance?: number;
  } | null;
};

function mapRpcResult(
  data: RpcPayload | null,
  ctx: { flowId: string; requestId: string; idempotencyKey: string }
): CreatePayoutPlanResult {
  if (!data) {
    return {
      success: false,
      code: 'CREATE_FAILED',
      error: 'Empty RPC response',
      idempotencyKey: ctx.idempotencyKey,
      flowId: ctx.flowId,
      requestId: ctx.requestId,
    };
  }

  const code = (data.code as CreatePayoutPlanCode) || (data.success ? 'OK' : 'CREATE_FAILED');
  return {
    success: !!data.success,
    code,
    error: data.error,
    idempotent: data.idempotent,
    planId: data.plan_id,
    plan: data.plan ?? null,
    wallet: data.wallet
      ? {
          balance: Number(data.wallet.balance) || 0,
          locked_balance: Number(data.wallet.locked_balance) || 0,
          available_balance: Number(data.wallet.available_balance) || 0,
        }
      : null,
    idempotencyKey: ctx.idempotencyKey,
    flowId: ctx.flowId,
    requestId: ctx.requestId,
  };
}

/** Lookup existing plan by idempotency key (timeout recovery). */
export async function findPayoutPlanByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
  opts?: { flowId?: string; requestId?: string }
): Promise<{ id: string; plan: Record<string, unknown> } | null> {
  const flowId = opts?.flowId ?? makeFlowId();
  const requestId = opts?.requestId ?? makeRequestId();

  console.log('[createPayoutPlan] idempotency lookup', {
    flowId,
    requestId,
    idempotencyKey,
    userId,
  });

  const { data, error } = (await withAbortableTimeout(
    () =>
      supabase
        .from('payout_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle(),
    IDEMPOTENCY_LOOKUP_TIMEOUT_MS,
    'Idempotency lookup'
  )) as { data: Record<string, unknown> | null; error: { message?: string } | null };

  if (error) {
    console.warn('[createPayoutPlan] idempotency lookup failed', {
      flowId,
      requestId,
      idempotencyKey,
      error: error.message,
    });
    return null;
  }
  if (!data?.id) return null;
  return { id: String(data.id), plan: data };
}

/**
 * Create (or reuse) a payout plan via the atomic RPC.
 * Caller owns the idempotency key for the attempt.
 */
export async function createPayoutPlan(
  input: CreatePayoutPlanInput
): Promise<CreatePayoutPlanResult> {
  const idempotencyKey = input.idempotencyKey || makeIdempotencyKey();
  const flowId = input.flowId || makeFlowId();
  const requestId = input.requestId || makeRequestId();
  const logCtx = { flowId, requestId, idempotencyKey };

  console.log('[createPayoutPlan] start', {
    ...logCtx,
    totalAmount: input.totalAmount,
    netPayoutAmount: input.netPayoutAmount,
    feeAmount: input.feeAmount,
    frequency: input.frequency,
    duration: input.duration,
  });

  try {
    const { data, error } = (await timedOperation(
      'rpc.create_payout_plan_atomic',
      () =>
        withAbortableTimeout(
          () =>
            supabase.rpc('create_payout_plan_atomic', {
              p_name: input.name,
              p_description: input.description ?? '',
              p_total_amount: input.totalAmount,
              p_payout_amount: input.payoutAmount,
              p_fee_amount: input.feeAmount,
              p_net_payout_amount: input.netPayoutAmount,
              p_fee_percentage: input.feePercentage,
              p_frequency: input.frequency,
              p_duration: input.duration,
              p_start_date: input.startDate,
              p_next_payout_date: input.nextPayoutDate,
              p_payout_account_id: input.payoutAccountId ?? null,
              p_bank_account_id: input.bankAccountId ?? null,
              p_emergency_withdrawal_enabled: input.emergencyWithdrawalEnabled ?? true,
              p_day_of_week: input.dayOfWeek ?? null,
              p_payout_hour: input.payoutHour ?? null,
              p_payout_minute: input.payoutMinute ?? null,
              p_purpose: input.purpose ?? null,
              p_purpose_other_text: input.purposeOther ?? null,
              p_metadata: input.metadata ?? {},
              p_custom_dates: input.customDates ?? [],
              p_custom_date_amounts: input.customDateAmounts ?? {},
              p_custom_date_times: input.customDateTimes ?? {},
              p_idempotency_key: idempotencyKey,
            }),
          CREATE_PAYOUT_RPC_TIMEOUT_MS,
          'Create payout plan'
        ),
      { hasSession: true }
    )) as { data: RpcPayload | null; error: { message?: string } | null };

    if (error) {
      throw new CreatePayoutPlanError(
        error.message || 'RPC failed',
        'CREATE_FAILED',
        logCtx
      );
    }

    const result = mapRpcResult(data, logCtx);
    console.log('[createPayoutPlan] rpc result', {
      ...logCtx,
      success: result.success,
      code: result.code,
      planId: result.planId,
      idempotent: result.idempotent,
    });

    if (!result.success) {
      throw new CreatePayoutPlanError(
        result.error || 'Failed to create payout plan',
        result.code,
        logCtx
      );
    }

    return result;
  } catch (err) {
    const normalized = normalizePayoutError(err, logCtx);
    console.warn('[createPayoutPlan] failed', {
      ...logCtx,
      code: normalized.code,
      message: normalized.message,
    });
    throw normalized;
  }
}
