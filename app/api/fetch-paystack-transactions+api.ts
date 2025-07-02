import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 Fetching Paystack transactions for user:', userId);

    // Get the user's virtual account number
    const { data: paystackAccount, error: accountError } = await supabase
      .from('paystack_accounts')
      .select('account_number, customer_code')
      .eq('user_id', userId)
      .single();

    if (accountError || !paystackAccount) {
      console.log('No Paystack account found for user:', userId);
      return new Response(JSON.stringify({ error: 'No Paystack account found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('📡 Fetching transactions for account:', paystackAccount.account_number);

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
    
    if (!data.status || !data.data) {
      return new Response(JSON.stringify({ error: 'No transactions found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user email for filtering
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    // Filter transactions for this user's virtual account
    const userTransactions = data.data.filter((tx: any) => {
      return tx.authorization?.account_number === paystackAccount.account_number ||
             tx.customer?.email === userProfile?.email;
    });

    console.log(`Found ${userTransactions.length} transactions for user`);

    // Get existing transaction references from our database
    const { data: existingTransactions } = await supabase
      .from('transactions')
      .select('reference')
      .eq('user_id', userId)
      .eq('type', 'deposit');

    const existingReferences = new Set(existingTransactions?.map(t => t.reference) || []);

    // Find new transactions that haven't been processed
    const newTransactions = userTransactions.filter((tx: any) => 
      tx.status === 'success' && 
      !existingReferences.has(tx.reference) &&
      tx.authorization?.account_number // Only virtual account transactions
    );

    console.log(`Processing ${newTransactions.length} new transactions`);

    let processedCount = 0;
    let totalAmount = 0;

    // Process each new transaction
    for (const tx of newTransactions) {
      try {
        const amountInNaira = tx.amount / 100; // Convert from kobo to naira

        console.log(`Processing transaction: ${tx.reference}, Amount: ₦${amountInNaira}`);

        // Add funds to user's wallet
        const { data: result, error } = await supabase.rpc('add_funds', {
          arg_user_id: userId,
          arg_amount: amountInNaira
        });

        if (error) {
          console.error('Error adding funds:', error);
          continue;
        }

        if (result && result.success) {
          console.log(`Successfully added ₦${amountInNaira} to wallet for transaction ${tx.reference}`);
          
          // Create a transaction record in our database
          await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              type: 'deposit',
              amount: amountInNaira,
              status: 'completed',
              source: 'Paystack Virtual Account',
              destination: 'Wallet',
              reference: tx.reference,
              metadata: {
                paystack_transaction_id: tx.id,
                paystack_reference: tx.reference,
                account_number: tx.authorization?.account_number
              }
            });

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

          processedCount++;
          totalAmount += amountInNaira;

        } else {
          console.error('Failed to add funds for transaction:', tx.reference);
        }

      } catch (err) {
        console.error('Error processing transaction:', err);
      }
    }

    console.log(`✅ Processed ${processedCount} transactions, total amount: ₦${totalAmount}`);

    return new Response(JSON.stringify({ 
      success: true,
      processedCount,
      totalAmount,
      message: `Processed ${processedCount} new transactions worth ₦${totalAmount.toLocaleString()}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching Paystack transactions:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 