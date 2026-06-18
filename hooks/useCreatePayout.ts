import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useBalance } from '@/contexts/BalanceContext';
import { useToast } from '@/contexts/ToastContext';
import { inAppNotificationService } from '@/lib/in-app-notifications';
import { calculatePayoutFees } from '@/lib/payout-fee-calculator';
import { PLAN_CREATION_FEE_PERCENT } from '@/types/payout-fees';
import { buildCustomDateTimesMap, buildDateTimeISO, parseTimeString, formatTimeString } from '@/lib/payout-time';

export function useCreatePayout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const { refreshWallet } = useBalance();
  const { showToast } = useToast();

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
    emergencyWithdrawalEnabled = true, // Default to enabled
    dayOfWeek,
    payoutHour,
    payoutMinute,
    purpose,
    purposeOther,
  }: {
    name: string;
    description?: string;
    totalAmount: number;
    payoutAmount: number;
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom' | 'weekly_specific' | 'end_of_month' | 'quarterly' | 'biannual' | 'annually';
    duration: number;
    startDate: string;
    bankAccountId?: string | null;
    payoutAccountId?: string | null;
    customDates?: string[];
    customDateAmounts?: Record<string, string>;
    customDateTimes?: Record<string, string>; // date -> "HH:mm", default 12:00
    emergencyWithdrawalEnabled?: boolean;
    dayOfWeek?: number;
    payoutHour?: number;
    payoutMinute?: number;
    purpose?: string;
    purposeOther?: string;
  }) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!session?.user?.id) {
        throw new Error("User not authenticated");
      }

      console.log("Creating payout plan with the following parameters:");
      console.log("- Name:", name);
      console.log("- Total amount:", totalAmount);
      console.log("- Payout amount:", payoutAmount);
      console.log("- Frequency:", frequency);
      console.log("- Day of week:", dayOfWeek);
      console.log("- Duration:", duration);
      console.log("- Start date:", startDate);
      console.log("- Bank account ID:", bankAccountId || null);
      console.log("- Payout account ID:", payoutAccountId || null);
      console.log("- Custom dates:", customDates);
      console.log(
        "- Emergency withdrawal enabled:",
        emergencyWithdrawalEnabled
      );

      // Get the most up-to-date wallet data from the database
      const walletData = await refreshWallet();
      // Client audit: before lock snapshot
      try {
        await supabase.from('client_audit_logs').insert({
          user_id: session.user.id,
          plan_id: null,
          stage: 'before_lock',
          context: {
            name,
            totalAmount,
            payoutAmount,
            frequency,
            duration,
            startDate,
            bankAccountId: bankAccountId || null,
            payoutAccountId: payoutAccountId || null,
            dayOfWeek,
            payoutHour,
            payoutMinute,
            wallet: walletData
          }
        });
      } catch (e) {
        console.warn('Client audit before_lock failed:', e);
      }

      if (!walletData) {
        throw new Error(
          "Unable to fetch current wallet balance. Please try again."
        );
      }

      const { balance, lockedBalance, availableBalance } = walletData;
      
      console.log('- Current Balance:', balance);
      console.log('- Locked Balance:', lockedBalance);

      // 💰 Compute fees (processing + stamp duty + transaction).
      // For custom-frequency plans, fees are always calculated on equal-split per payout.
      // This prevents users from gaming stamp duty by skewing per-date amounts.
      const numPayouts = frequency === 'custom' && customDates?.length
        ? customDates.length
        : duration;
      const { totalFees, netPayoutAmount, perPayoutAmount: perPayoutForPlan } =
        calculatePayoutFees(totalAmount, numPayouts);
      const feeAmount = totalFees;

      // 🔒 Validate custom per-date amounts before any funds are touched
      if (frequency === 'custom' && customDates?.length && customDateAmounts) {
        let totalCustom = 0;
        for (const d of customDates) {
          const raw = customDateAmounts[d];
          const num = typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) : Number(raw ?? 0);
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
        // Allow up to ₦1 rounding tolerance from the reverse gross-amount calculation in the UI
        if (totalCustom > netPayoutAmount + 1) {
          throw new Error(
            `Total custom payout amounts (₦${totalCustom.toLocaleString('en-NG', { minimumFractionDigits: 2 })}) exceed the net payout amount (₦${netPayoutAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}).`
          );
        }
      }

      // Fee is taken from the amount: user only needs totalAmount (fees are deducted from it).
      // Use availableBalance (balance − lockedBalance) so already-locked funds are excluded.
      if (availableBalance < totalAmount) {
        throw new Error(`Insufficient available balance to create this payout plan. You need ₦${totalAmount.toLocaleString()} but only have ₦${availableBalance.toLocaleString()} available.`);
      }

      // All frequency values are now supported in the database
      const dbFrequency = frequency;

      // 📅 Calculate next payout date
      const startDateObj = new Date(startDate);
      let nextPayoutDate = new Date(startDateObj);

      if (frequency === 'daily') {
        // For daily payouts, the first payout should be on the start date at the selected time
        if (payoutHour !== undefined && payoutMinute !== undefined) {
          nextPayoutDate.setHours(payoutHour, payoutMinute, 0, 0);
        }
      } else if (frequency === 'weekly') {
        nextPayoutDate.setDate(startDateObj.getDate() + 7);
      } else if (frequency === "weekly_specific" && dayOfWeek !== undefined) {
        // First payout: next occurrence of the selected day on or after start date (0 = start is that day)
        const currentDayOfWeek = startDateObj.getDay();
        const daysToAdd = (7 + dayOfWeek - currentDayOfWeek) % 7;
        nextPayoutDate.setDate(startDateObj.getDate() + daysToAdd);
      } else if (frequency === "biweekly") {
        // First payout on start_date; update_payout_plan_progress advances by 2 weeks from last payout
        // nextPayoutDate is already a copy of startDateObj, no change needed
      } else if (frequency === "monthly") {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
      } else if (frequency === "end_of_month") {
        // Set to the last day of the next month
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
        nextPayoutDate.setDate(0); // Setting to 0 gets the last day of the previous month
      } else if (frequency === "quarterly" || frequency === "biannual" || frequency === "annually") {
        // startDate is already the first payout date (see create-payout review / schedule).
        // Do not add another quarter / half-year / year here or next_payout_date lands one full interval too late.
      }

      let nextPayoutDateStr = nextPayoutDate.toISOString();

      const resolvedCustomDateTimes =
        dbFrequency === 'custom' && customDates?.length
          ? buildCustomDateTimesMap(customDates, customDateTimes)
          : undefined;

      if (resolvedCustomDateTimes && customDates?.length) {
        const firstCustomDate = [...customDates].sort()[0];
        nextPayoutDateStr = buildDateTimeISO(firstCustomDate, resolvedCustomDateTimes[firstCustomDate]);
      }

      // Store the original frequency in the description for display purposes
      const enhancedDescription = description || "";

      // Store additional metadata for special frequency types and optional fee breakdown
      const metadata: Record<string, unknown> = {
        originalFrequency: frequency,
        dayOfWeek: dayOfWeek,
        payoutHour: payoutHour,
        payoutMinute: payoutMinute
      };

      // 🔒 SECURITY: Lock only the net payout amount (fees are taken from totalAmount, not added on top)
      const { data: lockResult, error: lockError } = await supabase.rpc('lock_funds', {
        arg_user_id: session.user.id,
        arg_amount: netPayoutAmount
      });
      // Client audit: after lock snapshot
      try {
        const walletAfterLock = await refreshWallet();
        await supabase.from('client_audit_logs').insert({
          user_id: session.user.id,
          plan_id: null,
          stage: 'after_lock',
          context: {
            lockResult,
            wallet: walletAfterLock
          }
        });
      } catch (e) {
        console.warn('Client audit after_lock failed:', e);
      }

      if (lockError) {
        console.error("Error locking funds:", lockError);

        // Check for specific constraint violation and provide user-friendly message
        if (lockError.message?.includes("wallets_available_balance_check") || 
            lockError.message?.includes("Insufficient available balance")) {
          throw new Error(
            "Insufficient available balance. Your wallet balance may have changed. Please refresh and try again."
          );
        }

        throw lockError;
      }

      // Check if the lock operation was successful
      if (lockResult && !lockResult.success) {
        console.error("Lock funds failed:", lockResult.error);

        // Check for specific constraint violation and provide user-friendly message
        if (lockResult.error?.includes("wallets_available_balance_check") ||
            lockResult.error?.includes("Insufficient available balance")) {
          throw new Error(
            "Insufficient available balance. Your wallet balance may have changed. Please refresh and try again."
          );
        }

        throw new Error(lockResult.error || "Failed to lock funds");
      }

      console.log("Funds locked successfully. Available balance after lock:", lockResult?.available_balance);
      console.log('Fee calculation (processing + stamp + transaction):', { feeAmount, netPayoutAmount, totalAmount });

      // ➕ SECURITY: Now create payout plan AFTER funds are locked
      // If this fails, we'll unlock the funds in the catch block
      let payoutPlan: any = null;
      try {
        const { data: planData, error: payoutError } = await supabase
          .from("payout_plans")
          .insert({
            user_id: session.user.id,
            name,
            description: enhancedDescription,
            total_amount: totalAmount,
            payout_amount: perPayoutForPlan,
            frequency: dbFrequency,
            duration,
            start_date: startDate,
            bank_account_id: bankAccountId || null,
            payout_account_id: payoutAccountId || null,
            status: "active",
            completed_payouts: 0,
            emergency_withdrawal_enabled: emergencyWithdrawalEnabled,
            next_payout_date: nextPayoutDateStr,
            metadata: metadata,
            fee_percentage: PLAN_CREATION_FEE_PERCENT,
            fee_amount: feeAmount,
            net_payout_amount: netPayoutAmount,
            purpose: purpose || null,
            purpose_other_text: purposeOther || null,
          })
          .select()
          .single();

        if (payoutError) {
          console.error('Error creating payout plan:', payoutError);
          
          // SECURITY: Unlock funds if plan creation fails
        try {
          const unlockResult = await supabase.rpc('unlock_funds', {
            arg_user_id: session.user.id,
            arg_amount: netPayoutAmount
          });
            if (unlockResult?.error) {
              console.error('Error unlocking funds after plan creation failure:', unlockResult.error);
            }
          } catch (unlockErr: any) {
            console.error('Error unlocking funds after plan creation failure:', unlockErr);
          }
          
          throw payoutError;
        }

        payoutPlan = planData;
        console.log('Payout plan created:', payoutPlan.id);

        // 💸 Charge plan fee once (deduct from wallet) + record in user fees ledger/rollup
        // This prevents the fee from ever reappearing in available balance.
        const { data: feeChargeResult, error: feeChargeError } = await supabase.rpc('charge_plan_fee', {
          p_plan_id: payoutPlan.id,
        });
        // Client audit: after fee snapshot
        try {
          const walletAfterFee = await refreshWallet();
          await supabase.from('client_audit_logs').insert({
            user_id: session.user.id,
            plan_id: payoutPlan.id,
            stage: 'after_fee',
            context: {
              fee: { feePercentage: PLAN_CREATION_FEE_PERCENT, feeAmount, netPayoutAmount, frequency },
              feeChargeResult,
              wallet: walletAfterFee
            }
          });
        } catch (e) {
          console.warn('Client audit after_fee failed:', e);
        }
        if (feeChargeError) {
          console.error('Error charging plan fee:', feeChargeError);
          throw feeChargeError;
        }
        if (feeChargeResult && feeChargeResult.success === false) {
          console.error('charge_plan_fee failed:', feeChargeResult);
          throw new Error(feeChargeResult.error || 'Failed to charge plan fee');
        }
      } catch (planError) {
        // SECURITY: Ensure funds are unlocked if plan creation fails (we locked netPayoutAmount)
        try {
          const unlockResult = await supabase.rpc('unlock_funds', {
          arg_user_id: session.user.id,
          arg_amount: netPayoutAmount
          });
          if (unlockResult?.error) {
            console.error('Error unlocking funds after plan creation failure:', unlockResult.error);
          }
        } catch (unlockErr: any) {
          console.error('Error unlocking funds after plan creation failure:', unlockErr);
        }
        
        throw planError;
      }

      // 📆 Insert custom dates if needed (with per-date amount and time)
      if (dbFrequency === "custom" && customDates?.length && resolvedCustomDateTimes) {
        const datesToInsert = customDates.map((date) => {
          const { hour: h, minute: m } = parseTimeString(resolvedCustomDateTimes[date]);
          const payoutTime = `${formatTimeString(h, m)}:00`;

          const baseRecord: any = {
            payout_plan_id: payoutPlan.id,
            payout_date: date,
            payout_time: payoutTime,
          };

          if (customDateAmounts && customDateAmounts[date]) {
            const amountStr = customDateAmounts[date];
            const numericAmount = parseFloat(amountStr.replace(/,/g, ''));
            if (!isNaN(numericAmount) && numericAmount > 0) {
              baseRecord.amount = numericAmount;
            }
          }

          return baseRecord;
        });

        const { error: datesError } = await supabase
          .from("custom_payout_dates")
          .insert(datesToInsert);

        if (datesError) {
          console.error("Error adding custom dates:", datesError);
          throw datesError;
        }

      }

      // 📣 Create event (this will be displayed as an in-app notification on the notifications page)
      // Format frequency for display
      const frequencyDisplay = 
        frequency === 'daily' ? 'daily' :
        frequency === 'weekly' || frequency === 'weekly_specific' ? 'weekly' :
        frequency === 'biweekly' ? 'bi-weekly' :
        frequency === 'monthly' ? 'monthly' :
        frequency === 'end_of_month' ? 'at the end of each month' :
        frequency === 'quarterly' ? 'quarterly' :
        frequency === 'biannual' ? 'twice a year' :
        frequency === 'annually' ? 'annually' :
        frequency === 'custom' ? 'on custom dates' :
        'as scheduled';

      // For custom plans, build a description that reflects per-date amounts if set.
      let planCreatedDescription: string;
      if (frequency === 'custom' && customDates?.length) {
        const hasCustomAmounts =
          customDateAmounts &&
          customDates.some((d) => {
            const raw = customDateAmounts[d];
            const num = typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) : Number(raw ?? 0);
            return !isNaN(num) && num > 0;
          });
        if (hasCustomAmounts) {
          const totalNet = customDates.reduce((sum, d) => {
            const raw = customDateAmounts![d];
            const num = typeof raw === 'string' ? parseFloat(raw.replace(/,/g, '')) : Number(raw ?? 0);
            return sum + (!isNaN(num) ? num : 0);
          }, 0);
          planCreatedDescription = `Your payout plan "${name}" has been created with ${customDates.length} custom dates. Total payout: ₦${totalNet.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`;
        } else {
          planCreatedDescription = `Your payout plan "${name}" has been created with ${customDates.length} custom dates. ₦${payoutAmount.toLocaleString()} per date.`;
        }
      } else {
        planCreatedDescription = `Your payout plan "${name}" has been created successfully. ₦${payoutAmount.toLocaleString()} will be paid ${frequencyDisplay}.`;
      }

      await supabase.from("events").insert({
        user_id: session.user.id,
        type: "payout_scheduled",
        title: "New Payout Plan Created",
        description: planCreatedDescription,
        status: "unread",
        payout_plan_id: payoutPlan.id,
      });

      // Note: No server-side push notification for payout_scheduled events
      // Only deposits and payouts trigger server-side push notifications
      // This event will be displayed as an in-app notification on the notifications page

      // ♻️ Refresh wallet
      await refreshWallet();

      // ✅ Show toast
      showToast?.("Payout plan created successfully!", "success");

      // Get account details for success page
      let accountNumber = "";
      let bankName = "";

      if (payoutAccountId) {
        const { data: payoutAccount } = await supabase
          .from("payout_accounts")
          .select("account_number, bank_name")
          .eq("id", payoutAccountId)
          .single();

        if (payoutAccount) {
          accountNumber = payoutAccount.account_number;
          bankName = payoutAccount.bank_name;
        }
      } else if (bankAccountId) {
        const { data: bankAccount } = await supabase
          .from("bank_accounts")
          .select("account_number, bank_name")
          .eq("id", bankAccountId)
          .single();

        if (bankAccount) {
          accountNumber = bankAccount.account_number;
          bankName = bankAccount.bank_name;
        }
      }

      // 📲 Redirect
      router.replace({
        pathname: "/create-payout/success",
        params: {
          planId: payoutPlan.id,
          totalAmount: totalAmount.toString(),
          frequency,
          payoutAmount: payoutAmount.toString(),
          startDate,
          bankName: bankName || "Your bank account",
          accountNumber: accountNumber || "",
          emergencyWithdrawalEnabled: emergencyWithdrawalEnabled.toString(),
        },
      });
    } catch (err) {
      console.error("Error creating payout plan:", err);
      // Client audit: error snapshot
      try {
        await supabase.from('client_audit_logs').insert({
          user_id: session?.user?.id || null,
          plan_id: null,
          stage: 'error',
          context: {
            error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
            input: { name, totalAmount, payoutAmount, frequency, duration, startDate, bankAccountId, payoutAccountId, dayOfWeek, payoutHour, payoutMinute }
          }
        });
      } catch (e) {
        console.warn('Client audit error log failed:', e);
      }
      let errorMessage = "Failed to create payout plan";

      if (err instanceof Error) {
        // Check for specific database constraint violations
        if (err.message.includes("wallets_available_balance_check")) {
          errorMessage =
            "Insufficient available balance. Your wallet balance may have changed. Please refresh and try again.";
        } else if (err.message.includes("payout_plans_frequency_check")) {
          errorMessage =
            "Invalid frequency value. Please select a different frequency.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      showToast?.(errorMessage, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createPayout,
    isLoading,
    error,
  };
}
