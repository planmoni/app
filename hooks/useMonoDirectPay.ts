/**
 * Secure Mono DirectPay Hook
 * 
 * SECURITY: All Mono API calls go through secure edge function
 * No secret keys exposed to client
 * 
 * Features:
 * - Payment initiation via secure proxy
 * - Payment status verification
 * - KYC Level 0 limit checks
 * - Comprehensive error handling
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface MonoDirectPayResponse {
  paymentId: string;
  status: string;
  reference: string;
  amount: number;
  monoUrl?: string; // URL for customer authorization widget
  isImmediatelyComplete?: boolean;
}

export interface InitiateDirectPayParams {
  accountId: string; // Mono account ID
  amount: number; // Amount in Naira
  description?: string;
  reference?: string;
}

interface UseMonoDirectPayReturn {
  initiatePayment: (params: InitiateDirectPayParams) => Promise<MonoDirectPayResponse>;
  checkPaymentStatus: (reference: string) => Promise<{ status: string; success: boolean; data?: any }>;
  isLoading: boolean;
  error: string | null;
}

/**
 * SECURITY: Hook to initiate DirectPay from a linked Mono account
 * Uses secure edge function - no secret keys in client
 */
export function useMonoDirectPay(): UseMonoDirectPayReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const initiatePayment = useCallback(async (params: InitiateDirectPayParams): Promise<MonoDirectPayResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // SECURITY: Verify user is authenticated
      if (!session?.user?.id) {
        throw new Error('User must be logged in');
      }

      // SECURITY: Get Supabase session token for Edge Function authentication
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('Authentication required');
      }

      if (!params.accountId) {
        throw new Error('Account ID is required for DirectPay');
      }

      // SECURITY: Validate amount (prevent negative or zero amounts)
      if (!params.amount || params.amount <= 0) {
        throw new Error('Invalid amount. Amount must be greater than 0');
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
      const reference = params.reference || `mono_dp_${session.user.id}_${Date.now()}`;

      // Fetch user profile for customer information
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, mono_customer_id')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        throw new Error('Failed to fetch customer information. Please try again.');
      }

      // Fetch phone number from kyc_data if available
      const { data: kycData } = await supabase
        .from('kyc_data')
        .select('phone_number, address')
        .eq('user_id', session.user.id)
        .single();

      const firstName = profile?.first_name || session.user.user_metadata?.first_name || '';
      const lastName = profile?.last_name || session.user.user_metadata?.last_name || '';
      const email = profile?.email || session.user.email || '';
      const phoneNumber = kycData?.phone_number || '';

      if (!email) {
        throw new Error('Email is required for payment. Please update your profile.');
      }

      // Build customer name
      const customerName = `${firstName} ${lastName}`.trim() || email.split('@')[0];

      console.log('🚀 Initiating Mono DirectPay:', {
        accountId: params.accountId,
        amount: params.amount,
        amountInKobo,
        reference,
        hasPhone: !!phoneNumber,
      });

      // SECURITY: Use Edge Function instead of direct API call
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const paymentResponse = await fetch(`${supabaseUrl}/functions/v1/mono-api-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          endpoint: '/v2/payments/initiate',
          method: 'POST',
          body: {
            amount: amountInKobo,
            type: 'onetime-debit',
            method: 'account', // Use account method for direct debit
            account: params.accountId, // Link to the specific Mono account to debit
            description: params.description || `Payment of ₦${params.amount}`,
            reference: reference,
            redirect_url: process.env.EXPO_PUBLIC_APP_URL || 'https://planmoni.com',
            customer: {
              name: customerName,
              email: email,
              ...(phoneNumber && { phone: phoneNumber }),
              ...(kycData?.address && { address: kycData.address }),
            },
            // SECURITY: Include user_id in metadata for webhook processing
            metadata: {
              user_id: session.user.id,
              account_id: params.accountId,
            },
          },
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({}));
        console.error('❌ Mono DirectPay initiation error:', {
          status: paymentResponse.status,
          statusText: paymentResponse.statusText,
          error: errorData
        });
        const errorMessage = errorData.error || errorData.message || `Failed to initiate payment (${paymentResponse.status})`;
        throw new Error(errorMessage);
      }

      const proxyResponse = await paymentResponse.json();
      if (!proxyResponse.success || !proxyResponse.data) {
        const errorMessage = proxyResponse.data?.message || proxyResponse.error || 'Failed to initiate payment';
        throw new Error(errorMessage);
      }

      const paymentData = proxyResponse.data;
      console.log('📦 Mono DirectPay API Response:', JSON.stringify(paymentData, null, 2));
      
      const paymentId = paymentData.data?.id;
      const paymentStatus = paymentData.data?.status;
      const monoUrl = paymentData.data?.mono_url;
      const paymentAmount = paymentData.data?.amount;

      if (!paymentId) {
        console.error('❌ No payment ID in Mono response:', paymentData);
        throw new Error('No payment ID returned from Mono');
      }

      console.log('✅ Payment initiated successfully:', {
        paymentId,
        status: paymentStatus,
        reference,
        amount: params.amount,
        amountInKobo: paymentAmount,
        monoUrl,
      });

      // For DirectPay with account method, payment might complete immediately
      const isImmediatelyComplete = paymentStatus === 'successful' || 
                                     paymentStatus === 'completed' || 
                                     paymentStatus === 'success';
      
      if (isImmediatelyComplete) {
        console.log('🎉 Payment appears to be immediately completed!');
      }

      // Create pending transaction record in database
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: session.user.id,
          type: 'deposit',
          amount: params.amount,
          status: 'pending',
          source: 'mono_directpay',
          destination: 'wallet',
          description: params.description || `Mono DirectPay: ₦${params.amount}`,
          reference: reference,
          metadata: {
            mono_payment_id: paymentId,
            mono_account_id: params.accountId,
            payment_type: 'direct_pay',
            mono_url: monoUrl,
            initiated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (transactionError) {
        console.error('❌ Error creating transaction record:', transactionError);
        // Don't throw - payment was initiated successfully
      } else {
        console.log('✅ Transaction record created:', transaction.id);
      }

      return {
        paymentId: paymentId,
        status: paymentStatus || 'pending',
        reference: reference,
        amount: params.amount,
        monoUrl: monoUrl,
        isImmediatelyComplete: isImmediatelyComplete || false,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate payment';
      setError(errorMessage);
      console.error('❌ Error initiating Mono DirectPay:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const checkPaymentStatus = useCallback(async (reference: string): Promise<{ status: string; success: boolean; data?: any }> => {
    try {
      // SECURITY: Get Supabase session token for Edge Function authentication
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('Authentication required');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      console.log('🔍 Checking Mono payment status by reference:', reference);

      // SECURITY: Use Edge Function instead of direct API call
      const statusResponse = await fetch(`${supabaseUrl}/functions/v1/mono-api-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          endpoint: `/v2/payments/verify/${reference}`,
          method: 'GET',
        }),
      });

      console.log('📡 Status check response status:', statusResponse.status);

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json().catch(() => ({}));
        console.error('❌ Error checking payment status:', {
          status: statusResponse.status,
          error: errorData
        });
        
        // If it's "Invalid reference, payment not found", payment is still processing
        if (errorData.error?.includes('Invalid reference') || errorData.error?.includes('payment not found') || statusResponse.status === 404) {
          console.log('⏳ Payment not found - still processing');
          return {
            status: 'pending',
            success: false,
          };
        }
        
        throw new Error(errorData.error || errorData.message || 'Failed to check payment status');
      }

      const proxyResponse = await statusResponse.json();
      
      // Handle 404 from Mono API (payment not completed yet)
      if (proxyResponse.status === 404 || !proxyResponse.success) {
        console.log('⏳ Payment not completed yet (404 - payment still processing)');
        return {
          status: 'pending',
          success: false,
        };
      }

      const statusData = proxyResponse.data || proxyResponse;
      console.log('📊 Payment status response:', JSON.stringify(statusData, null, 2));

      // Check if response indicates error
      if (statusData.status === 'failed' || !statusData.data) {
        console.warn('⚠️ Payment verification failed or no data:', statusData.message);
        return {
          status: 'pending',
          success: false,
        };
      }

      const payment = statusData.data;
      const status = payment?.status || 'pending';
      const isSuccess = status === 'successful' || status === 'completed' || status === 'success';

      console.log('📈 Payment status verified:', {
        reference,
        paymentId: payment?.id,
        status,
        isSuccess,
        amount: payment?.amount ? payment.amount / 100 : 'unknown',
      });

      return {
        status,
        success: isSuccess,
        data: payment,
      };
    } catch (err) {
      console.error('❌ Error in checkPaymentStatus:', err);
      // Return pending instead of throwing to allow polling to continue
      return {
        status: 'pending',
        success: false,
      };
    }
  }, []);

  return {
    initiatePayment,
    checkPaymentStatus,
    isLoading,
    error,
  };
}

