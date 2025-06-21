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

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Add detailed logging for debugging
      console.log('Creating payout plan with the following details:');
      console.log('- Total Amount:', totalAmount);
      console.log('- Current Balance:', balance);
      
      // Fetch current wallet data directly from the database for verification
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('balance, locked_balance')
        .eq('user_id', session.user.id)
        .single();
        
      if (walletError) {
        console.error('Error fetching wallet data:', walletError);
        throw walletError;
      }
      
      console.log('Wallet data from database:');
      console.log('- DB Balance:', walletData?.balance);
      console.log('- DB Locked Balance:', walletData?.locked_balance);
      console.log('- DB Available Balance:', walletData ? (walletData.balance - walletData.locked_balance) : 'N/A');

      // Check if there's enough balance
      const availableBalance = walletData ? (walletData.balance - walletData.locked_balance) : 0;
      if (totalAmount > availableBalance) {
        console.error('Insufficient balance error:');
        console.error('- Required amount:', totalAmount);
        console.error('- Available balance:', availableBalance);
        throw new Error('Insufficient available balance');
      }

      // Parse the start date string to a Date object
      const startDateObj = new Date(startDate);
      
      // Calculate the next payout date based on frequency
      let nextPayoutDate = new Date(startDateObj);
      
      if (frequency === 'weekly') {
        nextPayoutDate.setDate(startDateObj.getDate() + 7);
      } else if (frequency === 'biweekly') {
        nextPayoutDate.setDate(startDateObj.getDate() + 14);
      } else if (frequency === 'monthly') {
        nextPayoutDate.setMonth(startDateObj.getMonth() + 1);
      }
      
      // Format the next payout date as ISO string
      const nextPayoutDateStr = nextPayoutDate.toISOString();

      console.log('About to lock funds:', totalAmount);
      
      // Create payout plan first without locking funds
      console.log('Creating payout plan in database');
      
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
          next_payout_date: frequency === 'custom' ? (customDates && customDates.length > 0 ? customDates[0] : startDate) : nextPayoutDateStr,
        })
        .select()
        .single();

      if (payoutError) {
        console.error('Error creating payout plan:', payoutError);
        throw payoutError;
      }

      console.log('Payout plan created successfully:', payoutPlan.id);
      
      // Now lock the funds directly using a custom RPC function
      try {
        console.log('Locking funds using direct_lock_funds RPC...');
        const { error: lockError } = await supabase.rpc('direct_lock_funds', {
          p_amount: totalAmount,
          p_user_id: session.user.id
        });
        
        if (lockError) {
          console.error('Error locking funds:', lockError);
          
          // If locking fails, delete the payout plan
          await supabase
            .from('payout_plans')
            .delete()
            .eq('id', payoutPlan.id);
            
          throw lockError;
        }
        
        console.log('Funds locked successfully');
      } catch (lockError) {
        console.error('Exception in locking funds:', lockError);
        
        // If locking fails, delete the payout plan
        await supabase
          .from('payout_plans')
          .delete()
          .eq('id', payoutPlan.id);
          
        throw lockError;
      }

      // If custom frequency, insert custom dates
      if (frequency === 'custom' && customDates && customDates.length > 0) {
        console.log('Adding custom payout dates:', customDates.length);
        
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

      console.log('Creating success event');
      
      // Create success event
      await supabase.from('events').insert({
        user_id: session.user.id,
        type: 'payout_scheduled',
        title: 'New Payout Plan Created',
        description: `Your payout plan "${name}" has been created successfully.`,
        status: 'unread',
        payout_plan_id: payoutPlan.id,
      });

      console.log('Refreshing wallet');
      
      // Explicitly refresh the wallet to update UI immediately
      await refreshWallet();

      // Show success toast
      showToast?.('Payout plan created successfully!', 'success');

      console.log('Navigating to success screen');
      
      // Navigate to success screen
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