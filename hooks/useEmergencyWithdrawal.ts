import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { router } from 'expo-router';

export type EmergencyWithdrawalOption = 'instant' | '24h' | '72h';

export type EmergencyWithdrawalRequest = {
  planId: string;
  planName: string;
  withdrawalAmount: number;
  option: EmergencyWithdrawalOption;
  bankAccountId?: string;
  payoutAccountId?: string;
};

export function useEmergencyWithdrawal() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const { showToast } = useToast();

  const calculateFee = (amount: number, option: EmergencyWithdrawalOption): number => {
    switch (option) {
      case 'instant':
        return Math.round(amount * 0.12 * 100) / 100; // 12% fee, rounded to 2 decimal places
      case '24h':
        return Math.round(amount * 0.06 * 100) / 100; // 6% fee, rounded to 2 decimal places
      case '72h':
        return 0; // No fee
      default:
        return 0;
    }
  };

  const calculateNetAmount = (amount: number, option: EmergencyWithdrawalOption): number => {
    const fee = calculateFee(amount, option);
    return Math.round((amount - fee) * 100) / 100; // Round to 2 decimal places
  };

  const processEmergencyWithdrawal = async (request: EmergencyWithdrawalRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('Processing emergency withdrawal:', request);

      // First, create the emergency withdrawal record
      const feeAmount = calculateFee(request.withdrawalAmount, request.option);
      const netAmount = calculateNetAmount(request.withdrawalAmount, request.option);
      const reference = `EMG_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const { data: withdrawalRecord, error: createError } = await supabase
        .from('emergency_withdrawals')
        .insert({
          user_id: session.user.id,
          payout_plan_id: request.planId,
          withdrawal_amount: request.withdrawalAmount,
          fee_amount: feeAmount,
          net_amount: netAmount,
          withdrawal_type: request.option,
          status: 'pending',
          bank_account_id: request.bankAccountId || null,
          payout_account_id: request.payoutAccountId || null,
          reference: reference,
          notes: `Emergency withdrawal from ${request.planName}`
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating withdrawal record:', createError);
        throw new Error(createError.message || 'Failed to create withdrawal record');
      }
      
      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: session.user.id,
          type: 'withdrawal',
          amount: request.withdrawalAmount,
          status: 'pending',
          source: 'payout_plan',
          destination: 'bank_account',
          payout_plan_id: request.planId,
          bank_account_id: request.bankAccountId || null,
          reference: reference,
          description: `Emergency withdrawal from ${request.planName}`,
          metadata: {
            withdrawal_type: request.option,
            fee_amount: feeAmount,
            net_amount: netAmount,
            emergency_withdrawal_id: withdrawalRecord.id
          }
        });
      
      if (transactionError) {
        console.error('Error creating transaction:', transactionError);
        throw new Error('Failed to create transaction record');
      }
      
      // Now call the Edge function to process the withdrawal immediately
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/process-emergency-withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          emergencyWithdrawalId: withdrawalRecord.id
        })
      });
      
      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('Emergency withdrawal processing failed:', result);
        throw new Error(result.error || 'Failed to process emergency withdrawal');
      }

      console.log('Emergency withdrawal processed successfully:', result);

      // Update the transaction record with account details if available
      if (result.data?.account_details) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            destination: result.data.account_details,
            metadata: {
              withdrawal_type: request.option,
              fee_amount: feeAmount,
              net_amount: netAmount,
              emergency_withdrawal_id: withdrawalRecord.id,
              account_details: result.data.account_details
            }
          })
          .eq('reference', reference);

        if (updateError) {
          console.error('Error updating transaction with account details:', updateError);
        }
      }

      // Show success toast
      showToast('Emergency withdrawal processed successfully', 'success');

      // Navigate to confirmation screen with withdrawal details
      router.replace({
        pathname: '/emergency-withdrawal/confirmation',
        params: {
          planId: request.planId,
          planName: request.planName,
          planAmount: request.withdrawalAmount.toString(),
          option: request.option,
          feeAmount: feeAmount.toString(),
          netAmount: netAmount.toString(),
          reference: reference,
          destination: result.data?.account_details || 'Your bank account',
          processingTime: request.option === 'instant' ? 'Immediate' : 
                         request.option === '24h' ? 'Within 24 hours' : 
                         'Within 72 hours'
        }
      });

      return {
        success: true,
        data: result.data
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process emergency withdrawal';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  const getEmergencyWithdrawals = async (planId?: string) => {
    try {
      setError(null);

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('emergency_withdrawals')
        .select(`
          *,
          payout_plans (
            name
          ),
          bank_accounts (
            bank_name,
            account_number
          ),
          payout_accounts (
            bank_name,
            account_number
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (planId) {
        query = query.eq('payout_plan_id', planId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch emergency withdrawals');
      }

      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch emergency withdrawals';
      setError(errorMessage);
      return [];
    }
  };

  return {
    isLoading,
    error,
    processEmergencyWithdrawal,
    getEmergencyWithdrawals,
    calculateFee,
    calculateNetAmount
  };
}