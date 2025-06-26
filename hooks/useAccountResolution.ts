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

  const resolveAccount = async (accountNumber: string, bankCode: string): Promise<AccountDetails | null> => {
    try {
      setIsResolving(true);
      setError(null);

      // For demo purposes, simulate a successful account resolution
      // In a real app, this would be an API call to Paystack
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate account resolution based on account number
      if (accountNumber === '0123456789') {
        return {
          account_name: 'John Doe',
          account_number: accountNumber,
          bank_name: 'GTBank'
        };
      } else if (accountNumber === '9876543210') {
        return {
          account_name: 'Jane Smith',
          account_number: accountNumber,
          bank_name: 'First Bank'
        };
      } else if (accountNumber === '5678901234') {
        return {
          account_name: 'Robert Johnson',
          account_number: accountNumber,
          bank_name: 'Access Bank'
        };
      } else if (accountNumber.length === 10) {
        // Generate a random name for any valid account number format
        const names = ['Alex Williams', 'Sarah Parker', 'Michael Brown', 'Elizabeth Taylor', 'David Wilson'];
        const randomName = names[Math.floor(Math.random() * names.length)];
        return {
          account_name: randomName,
          account_number: accountNumber,
          bank_name: 'Demo Bank'
        };
      } else {
        throw new Error('Invalid account number format');
      }

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