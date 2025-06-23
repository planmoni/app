import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useBalance } from '@/contexts/BalanceContext';
import { useToast } from '@/contexts/ToastContext';

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
    emergencyWithdrawalEnabled = false,
    dayOfWeek
  }: {
    name: string;
    description?: string;
    totalAmount: number;
    payoutAmount: number;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom' | 'weekly_specific' | 'end_of_month' | 'quarterly' | 'biannual';
    duration: number;
    startDate: string;
    bankAccountId?: string | null;
    payoutAccountId?: string | null;
    customDates?: string[];
    emergencyWithdrawalEnabled?: boolean;
    dayOfWeek?: number;
  }) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('Creating payout plan...');
      console.log('- Total Amount:', totalAmount);

      // Get the most up-to-date wallet data from the database
      const walletData = await refreshWallet();
      
      if (!walletData) {
        throw new Error('Unable to fetch current wallet balance. Please try again.');
      }

      const { balance, lockedBalance, availableBalance } = walletData;
      
      console.log('- Current Balance:', balance);
      console.log('- Locked Balance:', lockedBalance);
      console.log('- Available Balance:', availableBalance);

      // Check if user has enough available balance using fresh data
      if (totalAmount > availableBalance) {
        throw new Error(`Insufficient available balance to create this payout plan. You need ₦${totalAmount.toLocaleString()} but only have ₦${availableBalance.toLocaleString()} available.`);
      }

      // Map frequency values to database-compatible values
      // The database only accepts: 'weekly', 'biweekly', 'monthly', 'custom'
      let dbFrequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
      
      switch (frequency) {
        case 'weekly_specific':
        case 'end_of_month':
        case 'quarterly':
        case 'biannual':
          // These special frequencies should be stored as 'custom' in the database
          dbFrequency = 'custom';
          break;
        default:
          // weekly, biweekly, monthly, custom are already valid
          dbFrequency = frequency as 'weekly' | 'biweekly' | 'monthly' | 'custom';
      }

      // 📅 Calculate next payout date
      const startDateObj = new Date(startDate);
      let nextPayoutDate = new Date(startDateObj);

      if (frequency === 'weekly') {
        nextPayoutDate.setDate(startDateObj.getDate() + 7);
      } else if (frequency === 'weekly_specific' && dayOfWeek !== undefined) {
        // Calculate the next occurrence of the specified day of week
        const currentDayOfWeek = startDateObj.getDay();
        const daysToAdd = (7 + dayOfWeek - currentDayOfWeek) % 7;
        nextPayoutDate.setDate(startDateObj.getDate() + (daysToAdd === 0 ? 7 : daysToAdd));
      } else if (frequency === 'biweekly') {
        nextPayoutDate.setDate(startDateObj.getDate() + 14);
      } else if (frequency === 'monthly') {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
      } else if (frequency === 'end_of_month') {
        // Set to the last day of the next month
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
        nextPayoutDate.setDate(0); // Setting to 0 gets the last day of the previous month
      } else if (frequency === 'quarterly') {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 3);
      } else if (frequency === 'biannual') {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 6);
      }

      const nextPayoutDateStr = nextPayoutDate.toISOString();

      // Store the original frequency in the description for display purposes
      const enhancedDescription = description || '';
      
      // Store additional metadata for special frequency types
      const metadata = {
        originalFrequency: frequency,
        dayOfWeek: dayOfWeek
      };

      // ➕ Insert payout plan into DB
      const { data: payoutPlan, error: payoutError } = await supabase
        .from('payout_plans')
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
          status: 'active',
          completed_payouts: 0,
          emergency_withdrawal_enabled: emergencyWithdrawalEnabled,
          next_payout_date:
            dbFrequency === 'custom' && customDates?.length
              ? customDates[0]
              : nextPayoutDateStr,
          metadata: metadata // Store additional frequency metadata
        })
        .select()
        .single();

      if (payoutError) {
        console.error('Error creating payout plan:', payoutError);
        throw payoutError;
      }

      console.log('Payout plan created:', payoutPlan.id);

      // 🔒 Lock funds via RPC with unambiguous parameter names
      const { data: lockResult, error: lockError } = await supabase.rpc('lock_funds', {
        arg_user_id: session.user.id,
        arg_amount: totalAmount
      });

      if (lockError) {
        console.error('Error locking funds:', lockError);

        // Clean up payout plan on failure
        await supabase
          .from('payout_plans')
          .delete()
          .eq('id', payoutPlan.id);

        // Check for specific constraint violation and provide user-friendly message
        if (lockError.message?.includes('wallets_available_balance_check')) {
          throw new Error('Insufficient available balance. Your wallet balance may have changed. Please refresh and try again.');
        }
        
        throw lockError;
      }

      // Check if the lock operation was successful
      if (lockResult && !lockResult.success) {
        console.error('Lock funds failed:', lockResult.error);

        // Clean up payout plan on failure
        await supabase
          .from('payout_plans')
          .delete()
          .eq('id', payoutPlan.id);

        // Check for specific constraint violation and provide user-friendly message
        if (lockResult.error?.includes('wallets_available_balance_check')) {
          throw new Error('Insufficient available balance. Your wallet balance may have changed. Please refresh and try again.');
        }

        throw new Error(lockResult.error || 'Failed to lock funds');
      }

      console.log('Funds locked successfully.');

      // 📆 Insert custom dates if needed
      if (dbFrequency === 'custom' && customDates?.length) {
        const { error: datesError } = await supabase
          .from('custom_payout_dates')
          .insert(
            customDates.map(date => ({
              payout_plan_id: payoutPlan.id,
              payout_date: date,
            }))
          );

        if (datesError) {
          console.error('Error adding custom dates:', datesError);
          throw datesError;
        }
      }

      // 📣 Create event
      await supabase.from('events').insert({
        user_id: session.user.id,
        type: 'payout_scheduled',
        title: 'New Payout Plan Created',
        description: `Your payout plan "${name}" has been created successfully.`,
        status: 'unread',
        payout_plan_id: payoutPlan.id,
      });

      // ♻️ Refresh wallet
      await refreshWallet();

      // ✅ Show toast
      showToast?.('Payout plan created successfully!', 'success');

      // Get account details for success page
      let accountNumber = '';
      let bankName = '';

      if (payoutAccountId) {
        const { data: payoutAccount } = await supabase
          .from('payout_accounts')
          .select('account_number, bank_name')
          .eq('id', payoutAccountId)
          .single();
        
        if (payoutAccount) {
          accountNumber = payoutAccount.account_number;
          bankName = payoutAccount.bank_name;
        }
      } else if (bankAccountId) {
        const { data: bankAccount } = await supabase
          .from('bank_accounts')
          .select('account_number, bank_name')
          .eq('id', bankAccountId)
          .single();
        
        if (bankAccount) {
          accountNumber = bankAccount.account_number;
          bankName = bankAccount.bank_name;
        }
      }

      // 📲 Redirect
      router.replace({
        pathname: '/create-payout/success',
        params: {
          totalAmount: totalAmount.toString(),
          frequency,
          payoutAmount: payoutAmount.toString(),
          startDate,
          bankName: bankName || 'Your bank account',
          accountNumber: accountNumber || '',
          emergencyWithdrawalEnabled: emergencyWithdrawalEnabled.toString()
        }
      });

    } catch (err) {
      console.error('Error creating payout plan:', err);
      let errorMessage = 'Failed to create payout plan';
      
      if (err instanceof Error) {
        // Check for specific database constraint violations
        if (err.message.includes('wallets_available_balance_check')) {
          errorMessage = 'Insufficient available balance. Your wallet balance may have changed. Please refresh and try again.';
        } else if (err.message.includes('payout_plans_frequency_check')) {
          errorMessage = 'Invalid frequency value. Please select a different frequency.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      showToast?.(errorMessage, 'error');
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