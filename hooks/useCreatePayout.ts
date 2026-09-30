import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useToast } from '@/contexts/ToastContext';
import { calculatePayoutFees } from '@/lib/payout-fee-calculator';
import { PLAN_CREATION_FEE_PERCENT } from '@/types/payout-fees';
import {
  buildCustomDateTimesMap,
  buildDateTimeISO,
  parseTimeString,
  formatTimeString,
} from '@/lib/payout-time';
import {
  makeIdempotencyKey,
  shouldNavigateToSuccess,
} from '@/lib/create-payout-guard';
import {
  beginFinancialMutation,
  endFinancialMutation,
} from '@/lib/financial-mutation-gate';
import { queryClient } from '@/contexts/QueryClientProvider';
import { financialQueryKeys, isFinancialQueryKey } from '@/lib/queries/keys';
import {
  createPayoutPlan,
  findPayoutPlanByIdempotencyKey,
  CreatePayoutPlanError,
} from '@/lib/api/createPayoutPlan';

function computeNextPayoutDateIso(opts: {
  frequency: string;
  startDate: string;
  dayOfWeek?: number;
  payoutHour?: number;
  payoutMinute?: number;
  customDates?: string[];
  customDateTimes?: Record<string, string>;
}): string {
  const {
    frequency,
    startDate,
    dayOfWeek,
    payoutHour,
    payoutMinute,
    customDates,
    customDateTimes,
  } = opts;

  const resolvedCustomDateTimes =
    frequency === 'custom' && customDates?.length
      ? buildCustomDateTimesMap(customDates, customDateTimes)
      : undefined;

  if (resolvedCustomDateTimes && customDates?.length) {
    const firstCustomDate = [...customDates].sort()[0];
    return buildDateTimeISO(firstCustomDate, resolvedCustomDateTimes[firstCustomDate]);
  }

  const startDateObj = new Date(startDate);
  const nextPayoutDate = new Date(startDateObj);

  if (frequency === 'daily') {
    if (payoutHour !== undefined && payoutMinute !== undefined) {
      nextPayoutDate.setHours(payoutHour, payoutMinute, 0, 0);
    }
  } else if (frequency === 'weekly') {
    nextPayoutDate.setDate(startDateObj.getDate() + 7);
  } else if (frequency === 'weekly_specific' && dayOfWeek !== undefined) {
    const currentDayOfWeek = startDateObj.getDay();
    const daysToAdd = (7 + dayOfWeek - currentDayOfWeek) % 7;
    nextPayoutDate.setDate(startDateObj.getDate() + daysToAdd);
  } else if (frequency === 'monthly') {
    nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
  } else if (frequency === 'end_of_month') {
    nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
    nextPayoutDate.setDate(0);
  }

  return nextPayoutDate.toISOString();
}

export function useCreatePayout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const { showToast } = useToast();

  const submittingRef = useRef(false);
  const attemptIdRef = useRef(0);
  const abandonedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abandonedRef.current = true;
      attemptIdRef.current += 1;
    };
  }, []);

  const abandonCreate = useCallback(() => {
    abandonedRef.current = true;
    attemptIdRef.current += 1;
  }, []);

  const createPayout = async ({
    name,
    description,
    totalAmount,
    payoutAmount,
    frequency,
    duration,
    startDate,
    bankAccountId,
    payoutAccountId,
    customDates,
    customDateAmounts,
    customDateTimes,
    emergencyWithdrawalEnabled = true,
    dayOfWeek,
    payoutHour,
    payoutMinute,
    purpose,
    purposeOther,
    idempotencyKey: idempotencyKeyProp,
  }: {
    name: string;
    description?: string;
    totalAmount: number;
    payoutAmount: number;
    frequency:
      | 'daily'
      | 'weekly'
      | 'biweekly'
      | 'monthly'
      | 'custom'
      | 'weekly_specific'
      | 'end_of_month'
      | 'quarterly'
      | 'biannual'
      | 'annually';
    duration: number;
    startDate: string;
    bankAccountId?: string | null;
    payoutAccountId?: string | null;
    customDates?: string[];
    customDateAmounts?: Record<string, string>;
    customDateTimes?: Record<string, string>;
    emergencyWithdrawalEnabled?: boolean;
    dayOfWeek?: number;
    payoutHour?: number;
    payoutMinute?: number;
    purpose?: string;
    purposeOther?: string;
    idempotencyKey?: string;
  }) => {
    if (submittingRef.current) {
      console.warn('Payout creation already in progress, ignoring duplicate request');
      return;
    }
    submittingRef.current = true;
    abandonedRef.current = false;
    const attemptId = ++attemptIdRef.current;
    const idempotencyKey = idempotencyKeyProp || makeIdempotencyKey();
    const startedAt = Date.now();
    beginFinancialMutation();
    void queryClient.cancelQueries({
      predicate: (q) => isFinancialQueryKey(q.queryKey),
    });

    try {
      setIsLoading(true);
      setError(null);

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      const numPayouts =
        frequency === 'custom' && customDates?.length ? customDates.length : duration;
      const { totalFees, netPayoutAmount, perPayoutAmount: perPayoutForPlan } =
        calculatePayoutFees(totalAmount, numPayouts);
      const feeAmount = totalFees;

      if (frequency === 'custom' && customDates?.length && customDateAmounts) {
        let totalCustom = 0;
        for (const d of customDates) {
          const raw = customDateAmounts[d];
          const num =
            typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) : Number(raw ?? 0);
          if (isNaN(num) || num < 1) {
            throw new Error(
              `Each custom payout date must have an amount of at least ₦1. Check the date: ${d}.`
            );
          }
          if (num > totalAmount) {
            throw new Error(
              `Single payout amount (₦${num.toLocaleString()}) cannot exceed the plan total (₦${totalAmount.toLocaleString()}).`
            );
          }
          totalCustom += num;
        }
        if (totalCustom > netPayoutAmount + 1) {
          throw new Error(
            `Total custom payout amounts (₦${totalCustom.toLocaleString('en-NG', {
              minimumFractionDigits: 2,
            })}) exceed the net payout amount (₦${netPayoutAmount.toLocaleString('en-NG', {
              minimumFractionDigits: 2,
            })}).`
          );
        }
      }

      const resolvedCustomDateTimes =
        frequency === 'custom' && customDates?.length
          ? buildCustomDateTimesMap(customDates, customDateTimes)
          : undefined;

      const nextPayoutDateStr = computeNextPayoutDateIso({
        frequency,
        startDate,
        dayOfWeek,
        payoutHour,
        payoutMinute,
        customDates,
        customDateTimes: resolvedCustomDateTimes,
      });

      // Normalize custom times to HH:MM for the RPC
      const customTimesForRpc: Record<string, string> = {};
      if (resolvedCustomDateTimes && customDates?.length) {
        for (const d of customDates) {
          const { hour: h, minute: m } = parseTimeString(resolvedCustomDateTimes[d]);
          customTimesForRpc[d] = formatTimeString(h, m);
        }
      }

      let result;
      try {
        result = await createPayoutPlan({
          name,
          description: description || '',
          totalAmount,
          payoutAmount: perPayoutForPlan,
          feeAmount,
          netPayoutAmount,
          feePercentage: PLAN_CREATION_FEE_PERCENT,
          frequency,
          duration,
          startDate,
          nextPayoutDate: nextPayoutDateStr,
          payoutAccountId: payoutAccountId || null,
          bankAccountId: bankAccountId || null,
          emergencyWithdrawalEnabled,
          dayOfWeek,
          payoutHour,
          payoutMinute,
          purpose: purpose || undefined,
          purposeOther: purposeOther || undefined,
          metadata: {
            originalFrequency: frequency,
            dayOfWeek,
            payoutHour,
            payoutMinute,
            idempotency_key: idempotencyKey,
          },
          customDates: customDates || [],
          customDateAmounts: customDateAmounts || {},
          customDateTimes: customTimesForRpc,
          idempotencyKey,
        });
      } catch (err) {
        // Timeout / unknown: look up same idempotency key before failing
        if (
          err instanceof CreatePayoutPlanError &&
          (err.code === 'TIMEOUT' || err.code === 'NETWORK')
        ) {
          const found = await findPayoutPlanByIdempotencyKey(
            session.user.id,
            idempotencyKey,
            { flowId: err.flowId, requestId: err.requestId }
          );
          if (found) {
            result = {
              success: true,
              code: 'OK' as const,
              idempotent: true,
              planId: found.id,
              plan: found.plan,
              wallet: null,
              idempotencyKey,
              flowId: err.flowId,
              requestId: err.requestId,
            };
          } else {
            throw new CreatePayoutPlanError(
              "We're still confirming your payout plan. Please wait a moment, then check Plans — do not create again yet.",
              'UNKNOWN_RESULT',
              {
                flowId: err.flowId,
                requestId: err.requestId,
                idempotencyKey,
              }
            );
          }
        } else {
          throw err;
        }
      }

      const planId = result.planId;
      if (!planId) {
        throw new Error('Create succeeded without plan id');
      }

      console.log(`[create-payout] atomic create done in ${Date.now() - startedAt}ms`, {
        planId,
        idempotent: result.idempotent,
        flowId: result.flowId,
        requestId: result.requestId,
        idempotencyKey,
      });

      // Apply wallet snapshot from RPC if present (no extra refresh)
      if (result.wallet && session.user.id) {
        const walletData = {
          balance: result.wallet.balance,
          lockedBalance: result.wallet.locked_balance,
          availableBalance: result.wallet.available_balance,
        };
        queryClient.setQueryData(financialQueryKeys.wallet(session.user.id), walletData);
      } else if (session.user.id) {
        void queryClient.invalidateQueries({
          queryKey: financialQueryKeys.wallet(session.user.id),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ['payoutPlans', session.user.id],
      });

      // Best-effort in-app event (non-money; outside atomic RPC)
      void supabase.from('events').insert({
        user_id: session.user.id,
        type: 'payout_scheduled',
        title: 'New Payout Plan Created',
        description: `Your payout plan "${name}" has been created successfully.`,
        status: 'unread',
        payout_plan_id: planId,
      });

      if (
        !shouldNavigateToSuccess({
          attemptId,
          currentAttemptId: attemptIdRef.current,
          isMounted: mountedRef.current,
          abandoned: abandonedRef.current,
        })
      ) {
        console.warn('Payout created but screen abandoned — skipping success navigation', planId);
        showToast?.('Payout plan created successfully!', 'success');
        return;
      }

      showToast?.('Payout plan created successfully!', 'success');

      let accountNumber = '';
      let bankName = '';
      try {
      if (payoutAccountId) {
          const { data } = await supabase
            .from('payout_accounts')
            .select('account_number, bank_name')
            .eq('id', payoutAccountId)
          .single();
          if (data) {
            accountNumber = data.account_number;
            bankName = data.bank_name;
        }
      } else if (bankAccountId) {
          const { data } = await supabase
            .from('bank_accounts')
            .select('account_number, bank_name')
            .eq('id', bankAccountId)
          .single();
          if (data) {
            accountNumber = data.account_number;
            bankName = data.bank_name;
          }
        }
      } catch {
        // non-fatal
      }

      if (
        !shouldNavigateToSuccess({
          attemptId,
          currentAttemptId: attemptIdRef.current,
          isMounted: mountedRef.current,
          abandoned: abandonedRef.current,
        })
      ) {
        return;
      }

      router.replace({
        pathname: '/create-payout/success',
        params: {
          planId,
          totalAmount: totalAmount.toString(),
          frequency,
          payoutAmount: payoutAmount.toString(),
          startDate,
          bankName: bankName || 'Your bank account',
          accountNumber: accountNumber || '',
          emergencyWithdrawalEnabled: emergencyWithdrawalEnabled.toString(),
          ...(frequency === 'custom' && customDates?.length
            ? {
                customDates: JSON.stringify(customDates),
                customDateAmounts:
                  customDateAmounts && Object.keys(customDateAmounts).length > 0
                    ? JSON.stringify(customDateAmounts)
                    : '',
              }
            : {}),
        },
      });
    } catch (err) {
      let errorMessage = 'Failed to create payout plan';
      const isExpectedRestriction =
        err instanceof CreatePayoutPlanError &&
        (err.code === 'POST_NO_DEBIT' || err.code === 'INSUFFICIENT_BALANCE');

      if (err instanceof CreatePayoutPlanError) {
        if (err.code === 'POST_NO_DEBIT') {
          errorMessage =
            'Account restricted — you cannot create payout plans. Please contact support.';
        } else if (err.code === 'INSUFFICIENT_BALANCE') {
          errorMessage =
            'Insufficient available balance. Your wallet balance may have changed. Please try again.';
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      if (isExpectedRestriction) {
        console.warn('[create-payout] blocked:', err instanceof CreatePayoutPlanError ? err.code : errorMessage);
      } else {
        console.error('Error creating payout plan:', err);
      }

      if (
        shouldNavigateToSuccess({
          attemptId,
          currentAttemptId: attemptIdRef.current,
          isMounted: mountedRef.current,
          abandoned: abandonedRef.current,
        })
      ) {
      setError(errorMessage);
        showToast?.(errorMessage, 'error');
      }
      throw err;
    } finally {
      submittingRef.current = false;
      endFinancialMutation();
      if (mountedRef.current && attemptId === attemptIdRef.current) {
      setIsLoading(false);
      }
    }
  };

  return {
    createPayout,
    isLoading,
    error,
    abandonCreate,
  };
}
