import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { router } from 'expo-router';

export type EmergencyWithdrawalOption = 'instant';

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

  // Helper function to round down to 2 decimal places
  const roundDownTo2Decimals = (value: number): number => {
    return Math.floor(value * 100) / 100;
  };

  const calculateFee = (amount: number, option: EmergencyWithdrawalOption): number => {
    // Only instant withdrawals are available at 1.5% fee
    if (option === 'instant') {
      const fee = amount * 0.015; // 1.5% fee
      return roundDownTo2Decimals(fee);
    }
    return 0;
  };

  const calculateNetAmount = (amount: number, option: EmergencyWithdrawalOption): number => {
    const fee = calculateFee(amount, option);
    return roundDownTo2Decimals(amount - fee); // Round down to 2 decimal places
  };

  // Check for existing withdrawals for a plan (any status except failed/cancelled)
  const checkExistingWithdrawal = useCallback(async (planId: string): Promise<{ exists: boolean; status?: string }> => {
    try {
      if (!session?.user?.id) {
        return { exists: false };
      }

      // Check for any active withdrawal (pending, processing, completed, scheduled)
      // Failed and cancelled withdrawals are excluded to allow retries
      const { data, error } = await supabase
        .from('emergency_withdrawals')
        .select('id, status')
        .eq('user_id', session.user.id)
        .eq('payout_plan_id', planId)
        .in('status', ['pending', 'processing', 'completed', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking existing withdrawal:', error);
        return { exists: false };
      }

      return { exists: !!data, status: data?.status };
    } catch (err) {
      console.error('Error in checkExistingWithdrawal:', err);
      return { exists: false };
    }
  }, [session?.user?.id]);

  const processEmergencyWithdrawal = async (request: EmergencyWithdrawalRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      // CRITICAL: Check for existing pending/completed withdrawals before processing
      // This is a client-side guard. The backend Edge Function also has checks, but
      // this prevents unnecessary API calls and provides immediate user feedback.
      // 
      // BACKEND SAFEGUARD RECOMMENDATION:
      // The Edge Function (process-emergency-withdrawal) should also check for existing
      // withdrawals with status 'pending', 'processing', 'scheduled', or 'completed'
      // before processing. Consider adding a database constraint or unique index on
      // (payout_plan_id, status) where status IN ('pending', 'processing', 'scheduled')
      // to prevent duplicate pending withdrawals at the database level.
      const existingCheck = await checkExistingWithdrawal(request.planId);
      if (existingCheck.exists) {
        const statusMessage = existingCheck.status === 'completed' 
          ? 'An emergency withdrawal for this payout plan has already been completed.'
          : 'An emergency withdrawal request for this payout plan is already in progress.';
        throw new Error(statusMessage);
      }

      console.log('Processing emergency withdrawal:', request);

      // Round down withdrawal amount to 2 decimal places
      const roundedWithdrawalAmount = roundDownTo2Decimals(request.withdrawalAmount);

      // First, create the emergency withdrawal record
      const feeAmount = calculateFee(roundedWithdrawalAmount, request.option);
      const netAmount = calculateNetAmount(roundedWithdrawalAmount, request.option);
      const reference = `EMG_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const { data: withdrawalRecord, error: createError } = await supabase
        .from('emergency_withdrawals')
        .insert({
          user_id: session.user.id,
          payout_plan_id: request.planId,
          withdrawal_amount: roundedWithdrawalAmount,
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
          amount: roundedWithdrawalAmount,
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
      
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        // If response is not JSON, get text instead
        const text = await response.text();
        console.error('Emergency withdrawal processing failed - non-JSON response:', text);
        throw new Error(text || `Failed to process emergency withdrawal (${response.status})`);
      }

      if (!response.ok) {
        // Extract error message from various possible response formats
        // Priority: details (for transfer failures) > error > message > status text
        const errorMessage = result?.details || 
                            result?.error || 
                            result?.message || 
                            (typeof result === 'string' ? result : null) ||
                            response.statusText ||
                            `Failed to process emergency withdrawal (${response.status})`;
        console.error('Emergency withdrawal processing failed:', {
          status: response.status,
          statusText: response.statusText,
          result,
          extractedError: errorMessage
        });
        throw new Error(errorMessage);
      }

      if (!result.success) {
        // For non-200 responses that still have success: false
        // Priority: details (for transfer failures) > error > message
        const errorMessage = result?.details || 
                            result?.error || 
                            result?.message ||
                            'Failed to process emergency withdrawal';
        console.error('Emergency withdrawal processing failed (success: false):', {
          result,
          extractedError: errorMessage
        });
        throw new Error(errorMessage);
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

      // Get account details from the response
      const accountDetails = result.data?.account_details || 'Your bank account';

      // Get processing time from response or calculate it
      const processingTime = result.data?.processing_time_text || 'Immediate';

      // Navigate to confirmation screen with withdrawal details
      router.replace({
        pathname: '/emergency-withdrawal/confirmation',
        params: {
          planId: request.planId,
          planName: request.planName,
          planAmount: roundedWithdrawalAmount.toString(),
          option: request.option,
          feeAmount: feeAmount.toString(),
          netAmount: netAmount.toString(),
          reference: reference,
          destination: accountDetails,
          processingTime: processingTime,
          status: result.data?.status || 'completed'
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
    calculateNetAmount,
    checkExistingWithdrawal
  };
}