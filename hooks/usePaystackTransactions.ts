import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Toast from 'react-native-toast-message';

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
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY!}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Paystack API error: ${response.status}`);
      }

      const data = await response.json();
      // console.log("this is a data: ", data)
      
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

        // Send push notification
        await supabase.rpc('send_push_notification', {
          p_user_id: userId,
          p_title: 'Funds Received',
          p_body: `₦${amountInNaira.toLocaleString()} has been added to your wallet`,
          p_data: {
            type: 'deposit_successful',
            transaction_reference: transaction.reference,
            amount: amountInNaira
          }
        });

        // Send email notification directly
        await sendEmailDirect(userId, amountInNaira, transaction.reference);

        // Show toast for new deposit
        Toast.show({
          type: 'action',
          text1: `₦${amountInNaira.toLocaleString()} added to your wallet`,
          props: {
            actionLabel: 'View',
            onAction: () => {
              // You can navigate to the transactions screen or show details here
              // Example: navigate('transactions')
            },
            type: 'success',
          },
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
      
      // Also trigger server-side check for faster response
      triggerServerCheck();
      
      // Set up interval to check for new transactions every 30 seconds
      const interval = setInterval(() => {
        fetchPaystackTransactions();
        // Trigger server check every 2 minutes for redundancy
        if (Math.random() < 0.1) { // 10% chance each 30 seconds = ~every 5 minutes
          triggerServerCheck();
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [session?.user?.id]);

  // Trigger server-side transaction check for faster response
  const triggerServerCheck = async () => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Missing Supabase environment variables');
        return;
      }

      const functionUrl = `${supabaseUrl}/functions/v1/check-new-transactions`;
      
      await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'x-manual-trigger': 'true'
        }
      });
      
      console.log('🔄 Triggered server-side transaction check');
    } catch (error) {
      console.log('Server check trigger failed (this is normal):', error);
    }
  };

  return {
    transactions,
    isLoading,
    error,
    fetchPaystackTransactions,
    processNewTransactions
  };
}

// Function to send email notification directly
async function sendEmailDirect(userId: string, amount: number, reference: string) {
  try {
    // Get user email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    // Send email directly using Resend API
    const emailSubject = "Funds Received - Planmoni";
    const emailHtml = generateDepositEmailHtml({
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      accountNumber: 'Virtual Account',
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.EXPO_PUBLIC_RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Planmoni <notifications@planmoni.com>",
        to: userProfile.email,
        subject: emailSubject,
        html: emailHtml
      })
    });

    if (emailResponse.ok) {
      console.log(`Email notification sent to ${userProfile.email}`);
    } else {
      console.error('Failed to send email notification:', await emailResponse.text());
    }
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

// Email template for deposit notifications
function generateDepositEmailHtml(data: {
  firstName: string;
  amount: string;
  accountNumber: string;
  date: string;
  reference: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Funds Received - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #059669; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Funds Received!</h1>
          <p>Hello ${data.firstName}, money has been added to your Planmoni wallet</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="details">
            <div class="detail-row">
              <span class="label">Account Number:</span>
              <span class="value">${data.accountNumber}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center;">
            <a href="https://planmoni.com" class="button">View in App</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            Your funds are now available in your wallet and ready to be used for your payout plans.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Planmoni</p>
          <p>If you didn't expect this transaction, please contact support immediately</p>
        </div>
      </div>
    </body>
    </html>
  `;
} 