/**
 * Custom hook for Mono account linking
 * Calls the mono-account-link Edge Function (secure; no client secret).
 * The Edge Function saves the bank account and creates a mandate; returns mandate URL for one-flow auth.
 */

import { useState, useCallback } from 'react';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';

export interface MonoAccountData {
  accountId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  type: string;
}

export interface LinkAccountResult {
  /** Server-created bank account (already saved; do not call addBankAccount again) */
  bankAccount: {
    id: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    mono_account_id: string;
  };
  /** If set, open this URL so the user can authorize withdrawals (mandate) */
  mandate: { id: string; mono_url: string } | null;
  /** Backward compat: same as bankAccount fields */
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  accountId: string;
}

interface UseMonoAccountLinkingReturn {
  linkAccount: (code: string) => Promise<LinkAccountResult>;
  isLoading: boolean;
  error: string | null;
}

export function useMonoAccountLinking(): UseMonoAccountLinkingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const linkAccount = useCallback(
    async (code: string): Promise<LinkAccountResult> => {
      setIsLoading(true);
      setError(null);

      const supabaseUrl =
        Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || !session?.access_token) {
        const err = new Error('Not signed in or missing configuration');
        setError(err.message);
        throw err;
      }

      try {
        const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/mono-account-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg = data.error || 'Failed to link account';
          setError(msg);
          throw new Error(msg);
        }

        if (!data.success || !data.bankAccount) {
          setError('Invalid response from server');
          throw new Error('Invalid response from server');
        }

        const b = data.bankAccount;
        return {
          bankAccount: b,
          mandate: data.mandate || null,
          bankName: b.bank_name,
          bankCode: b.bank_code || '',
          accountNumber: b.account_number,
          accountName: b.account_name,
          accountId: b.mono_account_id,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to link bank account';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [session?.access_token]
  );

  return {
    linkAccount,
    isLoading,
    error,
  };
}
