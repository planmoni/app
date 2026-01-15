/**
 * Custom hook for Mono account linking
 * Handles the complete flow of linking a bank account via Mono
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface MonoAccountData {
  accountId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  type: string;
}

interface UseMonoAccountLinkingReturn {
  linkAccount: (code: string) => Promise<MonoAccountData>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to link a Mono account
 * Exchanges auth code for account details and returns formatted data
 */
export function useMonoAccountLinking(): UseMonoAccountLinkingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkAccount = useCallback(async (code: string): Promise<MonoAccountData> => {
    setIsLoading(true);
    setError(null);

    try {
      const monoSecretKey = process.env.EXPO_PUBLIC_MONO_SECRET_KEY;
      
      if (!monoSecretKey) {
        throw new Error('Mono secret key is not configured. Please set EXPO_PUBLIC_MONO_SECRET_KEY in your environment variables.');
      }

      // Validate secret key format
      if (!monoSecretKey.startsWith('test_sk_') && !monoSecretKey.startsWith('live_sk_') && !monoSecretKey.startsWith('mono_sk_')) {
        console.warn('Mono secret key format may be incorrect. Expected format: test_sk_... or live_sk_... or mono_sk_...');
      }

      // 1. Exchange auth code for account ID
      const authResponse = await fetch('https://api.withmono.com/v2/accounts/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mono-sec-key': monoSecretKey,
          accept: 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        console.error('Mono auth error:', errorData);
        
        // Provide more helpful error message for invalid secret key
        if (errorData.message?.includes('secret key is invalid') || errorData.message?.includes('invalid')) {
          const keyPrefix = monoSecretKey.substring(0, 8);
          throw new Error(
            `Invalid Mono secret key. Detected key prefix: ${keyPrefix}...\n\n` +
            'Please verify:\n' +
            '1. Your secret key matches your public key type (test_pk_ requires test_sk_)\n' +
            '2. The secret key is correctly set in EXPO_PUBLIC_MONO_SECRET_KEY\n' +
            '3. Both keys are from the same Mono account/environment'
          );
        }
        
        throw new Error(errorData.message || 'Failed to exchange Mono code');
      }

      const authData = await authResponse.json();
      const accountId = authData.data?.id;

      if (!accountId) {
        throw new Error('No account ID returned from Mono');
      }

      // 2. Get account details
      const accountResponse = await fetch(
        `https://api.withmono.com/v2/accounts/${accountId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'mono-sec-key': monoSecretKey,
            accept: 'application/json',
          },
        }
      );

      if (!accountResponse.ok) {
        const errorData = await accountResponse.json();
        console.error('Mono account fetch error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch account details');
      }

      const accountData = await accountResponse.json();
      const monoAccount = accountData.data?.account;

      if (!monoAccount) {
        throw new Error('Invalid account data from Mono');
      }

      // 3. Return formatted account data
      return {
        accountId: monoAccount.id,
        bankName: monoAccount.institution?.name || 'Unknown Bank',
        bankCode: monoAccount.institution?.bank_code || '',
        accountNumber: monoAccount.account_number || '',
        accountName: monoAccount.name || '',
        type: monoAccount.type || 'deposit',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link bank account';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    linkAccount,
    isLoading,
    error,
  };
}

