import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useBalance } from '@/contexts/BalanceContext';
import { useToast } from '@/contexts/ToastContext';
import { inAppNotificationService } from '@/lib/in-app-notifications';
import { PayoutFeeFrequency } from '@/types/payout-fees';

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
    emergencyWithdrawalEnabled = true, // Default to enabled
    dayOfWeek,
    payoutHour,
    payoutMinute
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
    emergencyWithdrawalEnabled?: boolean;
    dayOfWeek?: number;
    payoutHour?: number;
    payoutMinute?: number;
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

      if (!walletData) {
        throw new Error(
          "Unable to fetch current wallet balance. Please try again."
        );
      }

      const { balance, lockedBalance, availableBalance } = walletData;
      
      console.log('- Current Balance:', balance);
      console.log('- Locked Balance:', lockedBalance);

      // Check if user has enough available balance using fresh data
      if (totalAmount > balance) {
        throw new Error(`Insufficient available balance to create this payout plan. You need ₦${totalAmount.toLocaleString()} but only have ₦${balance.toLocaleString()} available.`);
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
        // Calculate the next occurrence of the specified day of week
        const currentDayOfWeek = startDateObj.getDay();
        const daysToAdd = (7 + dayOfWeek - currentDayOfWeek) % 7;
        nextPayoutDate.setDate(
          startDateObj.getDate() + (daysToAdd === 0 ? 7 : daysToAdd)
        );
      } else if (frequency === "biweekly") {
        nextPayoutDate.setDate(startDateObj.getDate() + 14);
      } else if (frequency === "monthly") {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
      } else if (frequency === "end_of_month") {
        // Set to the last day of the next month
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
        nextPayoutDate.setDate(0); // Setting to 0 gets the last day of the previous month
      } else if (frequency === "quarterly") {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 3);
      } else if (frequency === "biannual") {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 6);
      } else if (frequency === "annually") {
        nextPayoutDate.setFullYear(startDateObj.getFullYear() + 1);
      }

      const nextPayoutDateStr = nextPayoutDate.toISOString();

      // Store the original frequency in the description for display purposes
      const enhancedDescription = description || "";

      // Store additional metadata for special frequency types
      const metadata = {
        originalFrequency: frequency,
        dayOfWeek: dayOfWeek,
        payoutHour: payoutHour,
        payoutMinute: payoutMinute
      };

      // 🔒 SECURITY: Lock funds FIRST before creating plan to prevent race conditions
      // This ensures only one device can successfully lock funds, preventing duplicate plans
      const { data: lockResult, error: lockError } = await supabase.rpc('lock_funds', {
        arg_user_id: session.user.id,
        arg_amount: totalAmount
      });

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

      // 💰 Calculate fee amounts
      // Map frequency to database frequency type for fee lookup
      const feeFrequency: PayoutFeeFrequency = frequency === 'weekly_specific' ? 'weekly_specific' : 
                                               frequency === 'end_of_month' ? 'end_of_month' :
                                               frequency as PayoutFeeFrequency;
      
      // Fetch fee percentage from database
      const { data: feeData, error: feeError } = await supabase
        .from('payout_fees')
        .select('fee_percentage')
        .eq('frequency', feeFrequency)
        .eq('is_active', true)
        .single();
      
      const feePercentage = feeData?.fee_percentage || 0;
      const feeAmount = totalAmount * (feePercentage / 100);
      const netPayoutAmount = totalAmount - feeAmount;
      
      console.log('Fee calculation:', {
        feePercentage,
        feeAmount,
        netPayoutAmount,
        totalAmount
      });

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
            payout_amount: payoutAmount,
            frequency: dbFrequency, // Use the mapped frequency value
            duration,
            start_date: startDate,
            bank_account_id: bankAccountId || null,
            payout_account_id: payoutAccountId || null,
            status: "active",
            completed_payouts: 0,
            emergency_withdrawal_enabled: emergencyWithdrawalEnabled,
            next_payout_date:
              dbFrequency === "custom" && customDates?.length
                ? customDates[0]
                : nextPayoutDateStr,
            metadata: metadata, // Store additional frequency metadata
            fee_percentage: feePercentage,
            fee_amount: feeAmount,
            net_payout_amount: netPayoutAmount,
          })
          .select()
          .single();

        if (payoutError) {
          console.error('Error creating payout plan:', payoutError);
          
          // SECURITY: Unlock funds if plan creation fails
          try {
            const unlockResult = await supabase.rpc('unlock_funds', {
            arg_user_id: session.user.id,
            arg_amount: totalAmount
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
      } catch (planError) {
        // SECURITY: Ensure funds are unlocked if plan creation fails
        try {
          const unlockResult = await supabase.rpc('unlock_funds', {
          arg_user_id: session.user.id,
          arg_amount: totalAmount
          });
          if (unlockResult?.error) {
            console.error('Error unlocking funds after plan creation failure:', unlockResult.error);
          }
        } catch (unlockErr: any) {
          console.error('Error unlocking funds after plan creation failure:', unlockErr);
        }
        
        throw planError;
      }

      // 📆 Insert custom dates if needed
      if (dbFrequency === "custom" && customDates?.length) {
        const datesToInsert = customDates.map((date) => {
          const baseRecord: any = {
            payout_plan_id: payoutPlan.id,
            payout_date: date,
          };
          
          // Add amount if provided for this date
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

      await supabase.from("events").insert({
        user_id: session.user.id,
        type: "payout_scheduled",
        title: "New Payout Plan Created",
        description: `Your payout plan "${name}" has been created successfully. ₦${payoutAmount.toLocaleString()} will be paid ${frequencyDisplay}.`,
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
