import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
  const [transactions, setTransactions] = useState<PaystackTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  // Fetch transactions from Paystack API
  const fetchPaystackTransactions = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // First, get the user's virtual account number
      const { data: paystackAccount, error: accountError } = await supabase
        .from('paystack_accounts')
        .select('account_number, customer_code')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (accountError || !paystackAccount) {
        console.log('No Paystack account found for user');
        return;
      }

      console.log('Fetching transactions for account:', paystackAccount.account_number);

      // Fetch transactions from Paystack API
      const response = await fetch('https://api.paystack.co/transaction', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Paystack API error: ${response.status}`);
      }

      const data = await response.json();
    //   console.log("this is a data: ", data)
      
      if (data.status && data.data) {
        // Filter transactions for this user's virtual account, status, and channel
        const userTransactions = data.data.filter((tx: PaystackTransaction) => {
          return (
            (tx.authorization?.account_number === paystackAccount.account_number ||
              tx.customer?.email === session.user.email) &&
            tx.status === 'success' &&
            tx.channel === 'dedicated_nuban'
          );
        });

        console.log(`Found ${userTransactions.length} transactions for user`);
        setTransactions(userTransactions);

        // Process new transactions and update balance
        await processNewTransactions(userTransactions, session.user.id);
      }

    } catch (err) {
      console.error('Error fetching Paystack transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  };

  // Process new transactions and update balance
  const processNewTransactions = async (paystackTransactions: PaystackTransaction[], userId: string) => {
    try {
        
      // Get existing transaction references from our database
      const { data: existingTransactions } = await supabase
        .from('transactions')
        .select('reference')
        .eq('user_id', userId)
        .eq('type', 'deposit');

        console.log("refrences: ", existingTransactions);

      const existingReferences = new Set(existingTransactions?.map((t: { reference: any; }) => t.reference) || []);

      console.log("refrence: ", existingReferences);

      // Debug: Log each transaction's key properties
      paystackTransactions.forEach(tx => {
        console.log('TX:', {
          reference: tx.reference,
          status: tx.status,
          channel: tx.channel,
          account_number: tx.metadata?.receiver_account_number
        });
      });
      // Find new transactions that haven't been processed 
      const newTransactions = paystackTransactions.filter(tx => 
        tx.status === 'success' && 
        !existingReferences.has(tx.reference) &&
        tx.metadata?.receiver_account_number // Only virtual account transactions
      );

      console.log(`Processing ${newTransactions.length} new transactions`);

      // Process each new transaction
      for (const tx of newTransactions) {
        await processTransaction(tx, userId);
      }

    } catch (err) {
      console.error('Error processing new transactions:', err);
    }
  };

  // Process a single transaction
  const processTransaction = async (transaction: PaystackTransaction, userId: string) => {
    try {
      const amountInNaira = transaction.amount / 100; // Convert from kobo to naira

      console.log(`Processing transaction: ${transaction.reference}, Amount: ₦${amountInNaira}`);

      // Add funds to user's wallet
      const { data: result, error } = await supabase.rpc('add_funds', {
        arg_user_id: userId,
        arg_amount: amountInNaira
      });

      if (error) {
        console.error('Error adding funds:', error);
        return;
      }

      if (result && result.success) {
        console.log(`Successfully added ₦${amountInNaira} to wallet for transaction ${transaction.reference}`);
        
        // Create a transaction record in our database
        await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            type: 'deposit',
            amount: amountInNaira,
            status: 'completed',
            source: 'Paystack Virtual Account',
            destination: 'wallet',
            reference: transaction.reference,
            description: 'Funds added to wallet',
          });

        // Update user's wallet available_balance
        await supabase
          .from('wallets')
          .update({
            available_balance: supabase.rpc ? undefined : supabase.raw('available_balance + ?', [amountInNaira])
          }, supabase.rpc ? { increment: { available_balance: amountInNaira } } : undefined)
          .eq('user_id', userId);

        // Create notification
        await supabase
          .from('events')
          .insert({
            user_id: userId,
            type: 'deposit_successful',
            title: 'Funds Received',
            description: `₦${amountInNaira.toLocaleString()} has been added to your wallet`,
            status: 'unread'
          });

      } else {
        console.error('Failed to add funds for transaction:', transaction.reference);
      }

    } catch (err) {
      console.error('Error processing transaction:', err);
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
    transactions,
    isLoading,
    error,
    fetchPaystackTransactions,
    processNewTransactions
  };
} 