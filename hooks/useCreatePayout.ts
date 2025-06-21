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
  const { lockFunds, refreshWallet, balance } = useBalance();
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

      if (!session?.user?.id) throw new Error('User not authenticated');

      // Fetch current wallet data
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('balance, locked_balance')
        .eq('user_id', session.user.id)
        .single();

      if (walletError || !walletData) {
        console.error('Error fetching wallet:', walletError);
        throw new Error('Could not fetch wallet information');
      }

      const availableBalance = walletData.balance - walletData.locked_balance;
      console.log('Available Balance:', availableBalance);
      console.log('Total to Lock:', totalAmount);

      if (totalAmount > availableBalance) {
        throw new Error('Insufficient available balance to create this payout plan.');
      }

      // Parse dates
      const startDateObj = new Date(startDate);
      let nextPayoutDate = new Date(startDateObj);
      if (frequency === 'weekly') nextPayoutDate.setDate(startDateObj.getDate() + 7);
      else if (frequency === 'biweekly') nextPayoutDate.setDate(startDateObj.getDate() + 14);
      else if (frequency === 'monthly') nextPayoutDate.setMonth(startDateObj.getMonth() + 1);

      const nextPayoutDateStr =
        frequency === 'custom' && customDates?.length
          ? customDates[0]
          : nextPayoutDate.toISOString();

      // Create payout plan
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
          next_payout_date: nextPayoutDateStr,
        })
        .select()
        .single();

      if (payoutError || !payoutPlan) throw payoutError;

      // Lock funds
      const { error: lockError } = await supabase.rpc('lock_funds', {
        p_amount: totalAmount,
        p_user_id: session.user.id
      });

      if (lockError) {
        await supabase.from('payout_plans').delete().eq('id', payoutPlan.id);
        throw new Error('Failed to lock funds');
      }

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: session.user.id,
        type: 'debit',
        amount: totalAmount,
        description: `Funds locked for payout plan: ${name}`,
        status: 'completed',
        reference: `payout_lock_${payoutPlan.id}`,
        payout_plan_id: payoutPlan.id,
      });

      // Insert custom dates if applicable
      if (frequency === 'custom' && customDates?.length) {
        const { error: datesError } = await supabase
          .from('custom_payout_dates')
          .insert(
            customDates.map(date => ({
              payout_plan_id: payoutPlan.id,
              payout_date: date,
            }))
          );
        if (datesError) throw datesError;
      }

      // Log event
      await supabase.from('events').insert({
        user_id: session.user.id,
        type: 'payout_scheduled',
        title: 'New Payout Plan Created',
        description: `Your payout plan "${name}" has been created successfully.`,
        status: 'unread',
        payout_plan_id: payoutPlan.id,
      });

      await refreshWallet();
      showToast?.('Payout plan created successfully!', 'success');

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
      console.error('Create payout error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create payout plan';
      setError(msg);
      showToast?.(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return { createPayout, isLoading, error };
}