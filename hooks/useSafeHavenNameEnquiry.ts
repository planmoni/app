import { useState, useCallback } from 'react';
import Constants from 'expo-constants';
import { supabaseUrl } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type NameEnquiryResult = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
};

const getFunctionsUrl = () =>
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL as string) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  supabaseUrl ||
  '';

/**
 * Resolves account name via SafeHaven name-enquiry (Edge Function).
 * Requires user to have linked SafeHaven (token in safehaven_tokens).
 */
export function useSafeHavenNameEnquiry() {
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const resolveAccountName = useCallback(
    async (accountNumber: string, bankCode: string): Promise<NameEnquiryResult | null> => {
      if (!session?.access_token) {
        setError('You must be signed in to resolve account name.');
        return null;
      }
      if (accountNumber.length !== 10 || !bankCode) {
        setError('Account number must be 10 digits and bank must be selected.');
        return null;
      }

      const baseUrl = getFunctionsUrl().replace(/\/$/, '');
      if (!baseUrl) {
        setError('App URL not configured');
        return null;
      }

      setIsResolving(true);
      setError(null);

      try {
        const res = await fetch(`${baseUrl}/functions/v1/safehaven-name-enquiry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            accountNumber: accountNumber.trim(),
            bankCode: String(bankCode).trim(),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg =
            (typeof data?.error === 'string' && data.error) ||
            data?.message ||
            `Request failed (${res.status})`;
          setError(msg);
          return null;
        }

        if (data?.error) {
          setError(typeof data.error === 'string' ? data.error : 'Name enquiry failed');
          return null;
        }

        if (!data?.accountName) {
          setError('No account name returned');
          return null;
        }

        return {
          accountName: data.accountName,
          accountNumber: data.accountNumber ?? accountNumber,
          bankCode: data.bankCode ?? bankCode,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resolve account name';
        setError(message);
        return null;
      } finally {
        setIsResolving(false);
      }
    },
    [session?.access_token]
  );

  return {
    resolveAccountName,
    isResolving,
    error,
    setError,
  };
}
