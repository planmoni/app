import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useBalance } from '@/contexts/BalanceContext';
import { useToast } from '@/contexts/ToastContext';
import { logAnalyticsEvent } from '@/lib/firebase';

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
    emergencyWithdrawalEnabled = false
  }: {
    name: string;
    description?: string;
    totalAmount: number;
    payoutAmount: number;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    duration: number;
    startDate: string;
    bankAccountId?: string | null;
    payoutAccountId?: string | null;
    customDates?: string[];
    emergencyWithdrawalEnabled?: boolean;
  }) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('Creating payout plan...');
      console.log('- Total Amount:', totalAmount);

      // Log analytics event
      logAnalyticsEvent('create_payout_plan', {
        amount: totalAmount,
        frequency,
        duration,
        emergency_withdrawal_enabled: emergencyWithdrawalEnabled
      });

      // 🔥 Fetch real-time balance from DB
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('balance, locked_balance')
        .eq('user_id', session.user.id)
        .single();

      if (walletError || !walletData) {
        console.error('Error fetching wallet data:', walletError);
        throw new Error('Unable to fetch wallet balance');
      }

      const dbBalance = walletData.balance ?? 0;
      const dbLocked = walletData.locked_balance ?? 0;
      const dbAvailable = dbBalance - dbLocked;

      console.log('DB Balance:', dbBalance);
      console.log('DB Locked:', dbLocked);
      console.log('DB Available:', dbAvailable);

      if (totalAmount > dbAvailable) {
        throw new Error('Insufficient available balance to create this payout plan.');
      }

      // 📅 Calculate next payout date
      const startDateObj = new Date(startDate);
      let nextPayoutDate = new Date(startDateObj);

      if (frequency === 'weekly') {
        nextPayoutDate.setDate(startDateObj.getDate() + 7);
      } else if (frequency === 'biweekly') {
        nextPayoutDate.setDate(startDateObj.getDate() + 14);
      } else if (frequency === 'monthly') {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
      }

      const nextPayoutDateStr = nextPayoutDate.toISOString();

      // ➕ Insert payout plan into DB
      const { data: payoutPlan, error: payoutError } = await supabase
        .from('payout_plans')
        .insert({
          user_id: session.user.id,
          name,
          description,
          total_amount: totalAmount,
          payout_amount: payoutAmount,
          frequency,
          duration,
          start_date: startDate,
          bank_account_id: bankAccountId || null,
          payout_account_id: payoutAccountId || null,
          status: 'active',
          completed_payouts: 0,
          emergency_withdrawal_enabled: emergencyWithdrawalEnabled,
          next_payout_date:
            frequency === 'custom' && customDates?.length
              ? customDates[0]
              : nextPayoutDateStr,
        })
        .select()
        .single();

      if (payoutError) {
        console.error('Error creating payout plan:', payoutError);
        throw payoutError;
      }

      console.log('Payout plan created:', payoutPlan.id);

      // 🔒 Lock funds via RPC
      const { error: lockError } = await supabase.rpc('lock_funds', {
        p_amount: totalAmount,
        p_user_id: session.user.id
      });

      if (lockError) {
        console.error('Error locking funds:', lockError);

        // Clean up payout plan on failure
        await supabase
          .from('payout_plans')
          .delete()
          .eq('id', payoutPlan.id);

        throw lockError;
      }

      console.log('Funds locked successfully.');

      // 📆 Insert custom dates if needed
      if (frequency === 'custom' && customDates?.length) {
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

      // Log successful creation
      logAnalyticsEvent('payout_plan_created', {
        plan_id: payoutPlan.id,
        amount: totalAmount,
        frequency,
        duration
      });

      // 📲 Redirect
      router.replace({
        pathname: '/create-payout/success',
        params: {
          totalAmount: totalAmount.toString(),
          frequency,
          payoutAmount: payoutAmount.toString(),
          startDate,
          bankName: bankAccountId || payoutAccountId ? 'Your bank account' : '',
          emergencyWithdrawalEnabled: emergencyWithdrawalEnabled.toString()
        }
      });

    } catch (err) {
      console.error('Error creating payout plan:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create payout plan';
      setError(errorMessage);
      showToast?.(errorMessage, 'error');
      
      // Log error
      logAnalyticsEvent('payout_plan_creation_error', {
        error_message: errorMessage
      });
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