import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type AccountDetails = {
  account_name: string;
  account_number: string;
  bank_name: string;
};

export function useAccountResolution() {
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const getBankName = async (bankId: number): Promise<string> => {
    try {
      const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY;
      
      if (!PAYSTACK_SECRET_KEY) {
        return 'Bank';
      }

      const response = await fetch('https://api.paystack.co/bank', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.status && data.data) {
        const bank = data.data.find((bank: any) => bank.id === bankId);
        return bank ? bank.name : 'Bank';
      }

      return 'Bank';
    } catch (error) {
      return 'Bank';
    }
  };

  const resolveAccount = async (accountNumber: string, bankCode: string): Promise<AccountDetails | null> => {
    try {
      setIsResolving(true);
      setError(null);

      const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY;
      
      if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key not configured');
      }

      const response = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resolve account');
      }

      if (!data.status) {
        throw new Error(data.message || 'Account resolution failed');
      }

      // Get the bank name using the bank_id
      const bankName = await getBankName(data.data.bank_id);

      return {
        account_name: data.data.account_name,
        account_number: data.data.account_number,
        bank_name: bankName
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve account');
      return null;
    } finally {
      setIsResolving(false);
    }
  };

  return {
    resolveAccount,
    isResolving,
    error,
    setError
  };
}