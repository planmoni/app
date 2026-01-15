/**
 * Secure Mono DirectDebit Hook
 * 
 * CRITICAL: DirectDebit requires mandates - user authorizes once, then we can debit multiple times.
 * This is different from DirectPay which requires authorization for each payment.
 * 
 * SECURITY: All Mono API calls go through secure edge function
 * No secret keys exposed to client
 * 
 * DirectDebit Flow:
 * 1. Create mandate (user authorizes once)
 * 2. Mandate becomes active after authorization
 * 3. Initiate debits using mandate reference
 * 4. Debits settle (may take 1-3 business days)
 * 5. Credit wallet only after confirmed settlement
 * 
 * Features:
 * - Mandate creation and management
 * - Debit initiation via secure proxy
 * - Debit status tracking
 * - KYC Level 0 limit checks (server-side enforced)
 * - Comprehensive error handling
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface MonoMandate {
  id: string;
  user_id: string;
  bank_account_id: string;
  mono_account_id: string;
  mono_mandate_id: string | null;
  mono_reference: string | null;
  status: 'pending' | 'active' | 'cancelled' | 'expired' | 'failed';
  account_name: string;
  account_number: string;
  bank_name: string;
  authorized_at: string | null;
  activated_at: string | null;
  created_at: string;
}

export interface CreateMandateParams {
  bankAccountId: string; // bank_accounts.id
  monoAccountId: string; // Mono account ID
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode?: string;
}

export interface InitiateDebitParams {
  mandateId: string; // mono_mandates.id (our internal ID)
  amount: number; // Amount in Naira
  description?: string;
  reference?: string;
}

export interface MonoDebitResponse {
  debitId: string;
  status: string;
  reference: string;
  amount: number;
  mandateId: string;
  settlementDate?: string; // When debit will settle
}

interface UseMonoDirectDebitReturn {
  createMandate: (params: CreateMandateParams) => Promise<MonoMandate>;
  getMandate: (mandateId: string) => Promise<MonoMandate | null>;
  getUserMandates: () => Promise<MonoMandate[]>;
  initiateDebit: (params: InitiateDebitParams) => Promise<MonoDebitResponse>;
  checkDebitStatus: (reference: string) => Promise<{ status: string; success: boolean; settled: boolean; data?: any }>;
  cancelMandate: (mandateId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * SECURITY: Hook to manage Mono DirectDebit mandates and debits
 * Uses secure edge function - no secret keys in client
 */
export function useMonoDirectDebit(): UseMonoDirectDebitReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  /**
   * Create a new DirectDebit mandate
   * User will need to authorize this mandate via Mono widget
   */
  const createMandate = useCallback(async (params: CreateMandateParams): Promise<MonoMandate> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!session?.user?.id) {
        throw new Error('User must be logged in');
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('Authentication required');
      }

      // Create mandate record in database first
      const { data: mandate, error: mandateError } = await supabase
        .from('mono_mandates')
        .insert({
          user_id: session.user.id,
          bank_account_id: params.bankAccountId,
          mono_account_id: params.monoAccountId,
          account_name: params.accountName,
          account_number: params.accountNumber,
          bank_name: params.bankName,
          bank_code: params.bankCode,
          status: 'pending',
        })
        .select()
        .single();

      if (mandateError) {
        throw new Error(`Failed to create mandate: ${mandateError.message}`);
      }

      // Generate unique reference for Mono
      const monoReference = `mandate_${session.user.id}_${mandate.id}_${Date.now()}`;

      // SECURITY: Use Edge Function to create mandate with Mono
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      // Fetch user profile for customer information
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', session.user.id)
        .single();

      const firstName = profile?.first_name || session.user.user_metadata?.first_name || '';
      const lastName = profile?.last_name || session.user.user_metadata?.last_name || '';
      const email = profile?.email || session.user.email || '';

      const customerName = `${firstName} ${lastName}`.trim() || email.split('@')[0];

      console.log('🚀 Creating Mono DirectDebit mandate:', {
        mandateId: mandate.id,
        monoAccountId: params.monoAccountId,
        reference: monoReference,
      });

      const mandateResponse = await fetch(`${supabaseUrl}/functions/v1/mono-api-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          endpoint: '/v2/mandates',
          method: 'POST',
          body: {
            account: params.monoAccountId,
            reference: monoReference,
            customer: {
              name: customerName,
              email: email,
            },
            // SECURITY: Include user_id and mandate_id in metadata for webhook processing
            metadata: {
              user_id: session.user.id,
              mandate_id: mandate.id,
              bank_account_id: params.bankAccountId,
            },
          },
        }),
      });

      if (!mandateResponse.ok) {
        const errorData = await mandateResponse.json().catch(() => ({}));
        console.error('❌ Mono mandate creation error:', errorData);
        
        // Update mandate status to failed
        await supabase
          .from('mono_mandates')
          .update({ status: 'failed' })
          .eq('id', mandate.id);

        const errorMessage = errorData.error || errorData.message || `Failed to create mandate (${mandateResponse.status})`;
        throw new Error(errorMessage);
      }

      const proxyResponse = await mandateResponse.json();
      if (!proxyResponse.success || !proxyResponse.data) {
        const errorMessage = proxyResponse.data?.message || proxyResponse.error || 'Failed to create mandate';
        throw new Error(errorMessage);
      }

      const mandateData = proxyResponse.data;
      const monoMandateId = mandateData.data?.id;
      const mandateStatus = mandateData.data?.status;

      if (!monoMandateId) {
        console.error('❌ No mandate ID in Mono response:', mandateData);
        throw new Error('No mandate ID returned from Mono');
      }

      // Update mandate with Mono mandate ID and reference
      const { data: updatedMandate, error: updateError } = await supabase
        .from('mono_mandates')
        .update({
          mono_mandate_id: monoMandateId,
          mono_reference: monoReference,
          status: mandateStatus === 'active' ? 'active' : 'pending',
          ...(mandateStatus === 'active' && { activated_at: new Date().toISOString() }),
          mono_webhook_data: mandateData.data,
        })
        .eq('id', mandate.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating mandate:', updateError);
        throw new Error('Failed to update mandate');
      }

      console.log('✅ Mandate created successfully:', {
        mandateId: mandate.id,
        monoMandateId,
        status: mandateStatus,
      });

      return updatedMandate as MonoMandate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mandate';
      setError(errorMessage);
      console.error('❌ Error creating Mono mandate:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  /**
   * Get a specific mandate by ID
   */
  const getMandate = useCallback(async (mandateId: string): Promise<MonoMandate | null> => {
    try {
      if (!session?.user?.id) {
        throw new Error('User must be logged in');
      }

      const { data, error } = await supabase
        .from('mono_mandates')
        .select('*')
        .eq('id', mandateId)
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching mandate:', error);
        return null;
      }

      return data as MonoMandate;
    } catch (err) {
      console.error('Error in getMandate:', err);
      return null;
    }
  }, [session?.user?.id]);

  /**
   * Get all active mandates for the current user
   */
  const getUserMandates = useCallback(async (): Promise<MonoMandate[]> => {
    try {
      if (!session?.user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('mono_mandates')
        .select('*')
        .eq('user_id', session.user.id)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching mandates:', error);
        return [];
      }

      return (data || []) as MonoMandate[];
    } catch (err) {
      console.error('Error in getUserMandates:', err);
      return [];
    }
  }, [session?.user?.id]);

  /**
   * Initiate a debit using an active mandate
   * CRITICAL: Only works with active mandates
   */
  const initiateDebit = useCallback(async (params: InitiateDebitParams): Promise<MonoDebitResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!session?.user?.id) {
        throw new Error('User must be logged in');
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('Authentication required');
      }

      // SECURITY: Validate amount
      if (!params.amount || params.amount <= 0) {
        throw new Error('Invalid amount. Amount must be greater than 0');
      }

      // SECURITY: Get mandate and verify it's active
      const mandate = await getMandate(params.mandateId);
      if (!mandate) {
        throw new Error('Mandate not found');
      }

      if (mandate.status !== 'active') {
        throw new Error(`Mandate is not active. Current status: ${mandate.status}`);
      }

      if (!mandate.mono_reference) {
        throw new Error('Mandate reference not found');
      }

      // SECURITY: Check KYC Level 0 limits (client-side check before API call)
      // Note: Server will also verify this
      const { data: kycTierData } = await supabase
        .from('kyc_data')
        .select('kyc_tier')
        .eq('user_id', session.user.id)
        .single();

      const isKYCLevel0 = !kycTierData?.kyc_tier || kycTierData.kyc_tier === 0;
      const SINGLE_TRANSACTION_LIMIT = 50000; // ₦50,000

      if (isKYCLevel0 && params.amount > SINGLE_TRANSACTION_LIMIT) {
        throw new Error(`Amount exceeds KYC Level 0 limit of ₦${SINGLE_TRANSACTION_LIMIT.toLocaleString()}. Please complete KYC verification.`);
      }

      // Convert amount to kobo (Mono expects amount in kobo)
      const amountInKobo = Math.round(params.amount * 100);

      // Generate unique reference if not provided
      const reference = params.reference || `debit_${session.user.id}_${mandate.id}_${Date.now()}`;

      console.log('🚀 Initiating Mono DirectDebit:', {
        mandateId: params.mandateId,
        mandateReference: mandate.mono_reference,
        amount: params.amount,
        amountInKobo,
        reference,
      });

      // SECURITY: Use Edge Function to initiate debit
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const debitResponse = await fetch(`${supabaseUrl}/functions/v1/mono-api-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          endpoint: '/v2/debits',
          method: 'POST',
          body: {
            amount: amountInKobo,
            mandate: mandate.mono_reference, // Use mandate reference, not ID
            description: params.description || `DirectDebit: ₦${params.amount}`,
            reference: reference,
            // SECURITY: Include user_id and mandate_id in metadata for webhook processing
            metadata: {
              user_id: session.user.id,
              mandate_id: params.mandateId,
              bank_account_id: mandate.bank_account_id,
            },
          },
        }),
      });

      if (!debitResponse.ok) {
        const errorData = await debitResponse.json().catch(() => ({}));
        console.error('❌ Mono DirectDebit initiation error:', {
          status: debitResponse.status,
          statusText: debitResponse.statusText,
          error: errorData
        });
        const errorMessage = errorData.error || errorData.message || `Failed to initiate debit (${debitResponse.status})`;
        throw new Error(errorMessage);
      }

      const proxyResponse = await debitResponse.json();
      if (!proxyResponse.success || !proxyResponse.data) {
        const errorMessage = proxyResponse.data?.message || proxyResponse.error || 'Failed to initiate debit';
        throw new Error(errorMessage);
      }

      const debitData = proxyResponse.data;
      const debitId = debitData.data?.id;
      const debitStatus = debitData.data?.status;
      const settlementDate = debitData.data?.settlement_date;

      if (!debitId) {
        console.error('❌ No debit ID in Mono response:', debitData);
        throw new Error('No debit ID returned from Mono');
      }

      console.log('✅ Debit initiated successfully:', {
        debitId,
        status: debitStatus,
        reference,
        amount: params.amount,
        settlementDate,
      });

      // Create pending transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: session.user.id,
          type: 'deposit',
          amount: params.amount,
          status: 'pending', // Will be updated by webhook when settled
          source: 'mono_directdebit',
          destination: 'wallet',
          description: params.description || `Mono DirectDebit: ₦${params.amount}`,
          reference: reference,
          metadata: {
            mono_debit_id: debitId,
            mono_mandate_id: mandate.mono_mandate_id,
            mandate_id: params.mandateId,
            debit_status: debitStatus,
            settlement_date: settlementDate,
            initiated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (transactionError) {
        console.error('❌ Error creating transaction record:', transactionError);
        // Don't throw - debit was initiated successfully
      } else {
        console.log('✅ Transaction record created:', transaction.id);
      }

      return {
        debitId: debitId,
        status: debitStatus || 'pending',
        reference: reference,
        amount: params.amount,
        mandateId: params.mandateId,
        settlementDate: settlementDate,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate debit';
      setError(errorMessage);
      console.error('❌ Error initiating Mono DirectDebit:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, getMandate]);

  /**
   * Check debit status by reference
   */
  const checkDebitStatus = useCallback(async (reference: string): Promise<{ status: string; success: boolean; settled: boolean; data?: any }> => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('Authentication required');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      console.log('🔍 Checking Mono debit status by reference:', reference);

      const statusResponse = await fetch(`${supabaseUrl}/functions/v1/mono-api-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          endpoint: `/v2/debits/${reference}`,
          method: 'GET',
        }),
      });

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json().catch(() => ({}));
        
        if (statusResponse.status === 404) {
          console.log('⏳ Debit not found - still processing');
          return {
            status: 'pending',
            success: false,
            settled: false,
          };
        }
        
        throw new Error(errorData.error || errorData.message || 'Failed to check debit status');
      }

      const proxyResponse = await statusResponse.json();
      const debitData = proxyResponse.data?.data || proxyResponse.data;
      const status = debitData?.status || 'pending';
      
      // DirectDebit statuses: pending, processing, successful, failed, reversed
      // Only credit wallet when status is 'successful' AND settled
      const isSuccess = status === 'successful';
      const isSettled = debitData?.settled === true || debitData?.settlement_status === 'settled';

      console.log('📈 Debit status verified:', {
        reference,
        debitId: debitData?.id,
        status,
        isSuccess,
        isSettled,
        amount: debitData?.amount ? debitData.amount / 100 : 'unknown',
      });

      return {
        status,
        success: isSuccess && isSettled, // Only true if both successful AND settled
        settled: isSettled,
        data: debitData,
      };
    } catch (err) {
      console.error('❌ Error in checkDebitStatus:', err);
      return {
        status: 'pending',
        success: false,
        settled: false,
      };
    }
  }, []);

  /**
   * Cancel a mandate
   */
  const cancelMandate = useCallback(async (mandateId: string): Promise<void> => {
    try {
      if (!session?.user?.id) {
        throw new Error('User must be logged in');
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('Authentication required');
      }

      const mandate = await getMandate(mandateId);
      if (!mandate || mandate.user_id !== session.user.id) {
        throw new Error('Mandate not found');
      }

      if (!mandate.mono_mandate_id) {
        throw new Error('Mandate not yet created with Mono');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      // Cancel mandate with Mono
      const cancelResponse = await fetch(`${supabaseUrl}/functions/v1/mono-api-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          endpoint: `/v2/mandates/${mandate.mono_mandate_id}`,
          method: 'DELETE',
        }),
      });

      if (!cancelResponse.ok) {
        const errorData = await cancelResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to cancel mandate');
      }

      // Update mandate status in database
      const { error: updateError } = await supabase
        .from('mono_mandates')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', mandateId);

      if (updateError) {
        throw new Error('Failed to update mandate status');
      }

      console.log('✅ Mandate cancelled successfully:', mandateId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel mandate';
      setError(errorMessage);
      console.error('❌ Error cancelling mandate:', err);
      throw err;
    }
  }, [session?.user?.id, getMandate]);

  return {
    createMandate,
    getMandate,
    getUserMandates,
    initiateDebit,
    checkDebitStatus,
    cancelMandate,
    isLoading,
    error,
  };
}


