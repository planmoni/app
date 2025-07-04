import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type PaystackTransaction = {
  id: number;
  domain: string;
  amount: number;
  currency: string;
  source: string;
  reason: string;
  recipient: number;
  status: string;
  channel?: string;
  transfer_code: string;
  created_at: string;
  updated_at: string;
  reference: string;
  customer: {
    id: number;
    email: string;
    customer_code: string;
  };
  authorization?: {
    account_number: string;
    account_name: string;
    bank_code: string;
  };
  metadata?: {
    receiver_account_number?: string;
    [key: string]: any;
  };
};

export function usePaystackTransactions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  // Fetch transactions using the local API route
  const fetchPaystackTransactions = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching Paystack transactions via local API...');

      // Call the local API route instead of directly calling Paystack
      const response = await fetch('/api/fetch-paystack-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          userEmail: session.user.email
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`Successfully processed transactions via API`);
      } else {
        console.error('API returned error:', data.error);
        setError(data.error || 'Failed to process transactions');
      }

    } catch (err) {
      console.error('Error fetching Paystack transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch transactions on mount and set up interval
  useEffect(() => {
    if (session?.user?.id) {
      fetchPaystackTransactions();
      
      // Set up interval to check for new transactions every 30 seconds
      const interval = setInterval(fetchPaystackTransactions, 30000);
      
      return () => clearInterval(interval);
    }
  }, [session?.user?.id]);

  return {
    isLoading,
    error,
    fetchPaystackTransactions
  };
}