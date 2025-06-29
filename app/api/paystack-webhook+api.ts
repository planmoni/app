import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Paystack webhook secret
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

// Function to verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!PAYSTACK_WEBHOOK_SECRET) {
    console.error('Paystack webhook secret not configured');
    return false;
  }

  const hash = crypto
    .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

// Function to add funds to user's wallet
async function addFundsToWallet(userId: string, amount: number, reference: string) {
  try {
    console.log(`Adding ₦${amount} to wallet for user ${userId}, reference: ${reference}`);

    // Check if transaction already exists to prevent duplicates
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference', reference)
      .single();

    if (existingTransaction) {
      console.log(`Transaction with reference ${reference} already exists, skipping`);
      return { success: true, message: 'Transaction already processed' };
    }

    // Add funds using the existing function
    const { data: result, error } = await supabase.rpc('add_funds', {
      arg_user_id: userId,
      arg_amount: amount
    });

    if (error) {
      console.error('Error adding funds:', error);
      throw error;
    }

    if (!result || !result.success) {
      console.error('Add funds failed:', result?.error);
      throw new Error(result?.error || 'Failed to add funds');
    }

    // Update transaction with reference
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ reference })
      .eq('user_id', userId)
      .eq('type', 'deposit')
      .eq('amount', amount)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Within last minute

    if (updateError) {
      console.error('Error updating transaction reference:', updateError);
    }

    console.log(`Successfully added ₦${amount} to wallet for user ${userId}`);
    return { success: true, balance: result.balance, available_balance: result.available_balance };
  } catch (error) {
    console.error('Error in addFundsToWallet:', error);
    throw error;
  }
}

// Function to find user by virtual account number
async function findUserByVirtualAccount(accountNumber: string) {
  try {
    const { data: paystackAccount, error } = await supabase
      .from('paystack_accounts')
      .select('user_id')
      .eq('account_number', accountNumber)
      .single();

    if (error) {
      console.error('Error finding user by virtual account:', error);
      return null;
    }

    return paystackAccount?.user_id;
  } catch (error) {
    console.error('Error in findUserByVirtualAccount:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    console.log('🔔 Webhook received at:', new Date().toISOString());
    console.log('📡 Request headers:', Object.fromEntries(request.headers.entries()));
    
    // Get the raw body for signature verification
    const rawBody = await request.text();
    console.log('📦 Raw body length:', rawBody.length);
    console.log('📦 Raw body preview:', rawBody.substring(0, 200) + '...');
    
    const signature = request.headers.get('x-paystack-signature');
    console.log('🔐 Signature received:', signature ? 'Yes' : 'No');

    if (!signature) {
      console.error('❌ No Paystack signature found in headers');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify webhook signature
    console.log('🔍 Verifying webhook signature...');
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      console.log('🔍 Expected secret:', PAYSTACK_WEBHOOK_SECRET ? 'Set' : 'Not set');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('✅ Webhook signature verified successfully');

    // Parse the webhook payload
    const webhookData = JSON.parse(rawBody);
    console.log('📋 Webhook event:', webhookData.event);
    console.log('📋 Webhook data keys:', Object.keys(webhookData.data || {}));

    // Handle different webhook events
    switch (webhookData.event) {
      case 'charge.success':
        console.log('💰 Processing charge.success event...');
        await handleChargeSuccess(webhookData.data);
        break;
      
      case 'transfer.success':
        console.log('💸 Processing transfer.success event...');
        await handleTransferSuccess(webhookData.data);
        break;
      
      case 'dedicated_account.assigned':
        console.log('🏦 Processing dedicated_account.assigned event...');
        await handleDedicatedAccountAssigned(webhookData.data);
        break;
      
      default:
        console.log(`⚠️  Unhandled webhook event: ${webhookData.event}`);
    }

    console.log('✅ Webhook processed successfully');
    return new Response(JSON.stringify({ status: 'success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error processing webhook:', error);
    console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle successful charge (payment to virtual account or USSD)
async function handleChargeSuccess(data: any) {
  try {
    console.log('Processing charge.success webhook:', data);

    const {
      reference,
      amount,
      metadata,
      customer: { email },
      authorization
    } = data;

    // Convert amount from kobo to naira
    const amountInNaira = amount / 100;

    let userId: string | null = null;

    // Check if this is a USSD payment
    if (metadata?.payment_type === 'ussd') {
      console.log('Processing USSD payment for reference:', reference);
      
      // Find user by reference in transactions table
      const { data: transaction, error } = await supabase
        .from('transactions')
        .select('user_id')
        .eq('reference', reference)
        .eq('type', 'deposit')
        .single();

      if (error || !transaction) {
        console.error(`No transaction found for USSD reference: ${reference}`);
        return;
      }

      userId = transaction.user_id;
    } else {
      // Handle virtual account payment (existing logic)
      const account_number = authorization?.account_number;
      if (!account_number) {
        console.error('No account number found in authorization data');
        return;
      }

      userId = await findUserByVirtualAccount(account_number);
      if (!userId) {
        console.error(`No user found for virtual account: ${account_number}`);
        return;
      }
    }

    // Add funds to user's wallet
    if (!userId) {
      console.error('No user ID found for the payment');
      return;
    }

    await addFundsToWallet(userId, amountInNaira, reference);

    // Create notification event
    const notificationTitle = metadata?.payment_type === 'ussd' ? 'USSD Payment Successful' : 'Funds Received';
    const notificationDescription = metadata?.payment_type === 'ussd' 
      ? `₦${amountInNaira.toLocaleString()} has been added to your wallet via USSD`
      : `₦${amountInNaira.toLocaleString()} has been added to your wallet`;

    await supabase
      .from('events')
      .insert({
        user_id: userId,
        type: 'deposit_successful',
        title: notificationTitle,
        description: notificationDescription,
        status: 'unread'
      });

    console.log(`Successfully processed charge.success for user ${userId}`);

  } catch (error) {
    console.error('Error handling charge.success:', error);
    throw error;
  }
}

// Handle successful transfer (payout from virtual account)
async function handleTransferSuccess(data: any) {
  try {
    console.log('Processing transfer.success webhook:', data);

    const {
      reference,
      amount,
      recipient: { account_number }
    } = data;

    // Convert amount from kobo to naira
    const amountInNaira = amount / 100;

    // Find user by virtual account number
    const userId = await findUserByVirtualAccount(account_number);
    if (!userId) {
      console.error(`No user found for virtual account: ${account_number}`);
      return;
    }

    // Create transaction record for payout
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'payout',
        amount: amountInNaira,
        status: 'completed',
        source: 'wallet',
        destination: `Virtual Account (${account_number})`,
        reference,
        description: 'Payout from virtual account'
      });

    console.log(`Successfully processed transfer.success for user ${userId}`);

  } catch (error) {
    console.error('Error handling transfer.success:', error);
    throw error;
  }
}

// Handle dedicated account assignment
async function handleDedicatedAccountAssigned(data: any) {
  try {
    console.log('Processing dedicated_account.assigned webhook:', data);

    const {
      customer: { customer_code },
      account_number,
      account_name,
      bank: { name: bank_name }
    } = data;

    // Find user by customer code
    const { data: paystackAccount, error } = await supabase
      .from('paystack_accounts')
      .select('user_id')
      .eq('customer_code', customer_code)
      .single();

    if (error || !paystackAccount) {
      console.error(`No paystack account found for customer code: ${customer_code}`);
      return;
    }

    // Update the paystack account with the assigned account details
    await supabase
      .from('paystack_accounts')
      .update({
        account_number,
        account_name,
        bank_name,
        is_active: true
      })
      .eq('customer_code', customer_code);

    console.log(`Successfully updated paystack account for user ${paystackAccount.user_id}`);

  } catch (error) {
    console.error('Error handling dedicated_account.assigned:', error);
    throw error;
  }
} 