import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Paystack webhook secret
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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

// Function to process deposit using atomic process_paystack_deposit function
// This function handles wallet update, transaction creation, events, and notifications
async function addFundsToWallet(userId: string, amount: number, reference: string, accountNumber?: string, paystackData?: any) {
  try {
    console.log(`Processing deposit: ₦${amount} for user ${userId}, reference: ${reference}`);

    // Process deposit atomically using process_paystack_deposit function
    // This function handles wallet update, transaction creation, events, and notifications
    const { data: result, error } = await supabase.rpc('process_paystack_deposit', {
      arg_user_id: userId,
      arg_amount: amount,
      arg_reference: reference,
      arg_paystack_data: {
        paystack_transaction_id: paystackData?.id,
        paystack_reference: reference,
        account_number: accountNumber,
        processed_by: 'paystack_webhook',
        processed_at: new Date().toISOString(),
        ...(paystackData && { paystack_data: paystackData })
      }
    });

    if (error) {
      console.error('Error processing deposit:', error);
      throw error;
    }

    if (!result || !result.success) {
      if (result?.already_processed) {
        console.log(`Transaction ${reference} was already processed`);
        return { success: true, message: 'Transaction already processed', already_processed: true };
      }
      console.error('Process deposit failed:', result);
      throw new Error('Failed to process deposit');
    }

    console.log(`Successfully processed deposit: ₦${amount} for user ${userId}`);
    
    // Get user email for email notification
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    // Send email notification (push notification is handled by process_paystack_deposit)
    if (userProfile?.email) {
      await sendEmailNotification({
        to: userProfile.email,
        firstName: userProfile.first_name || 'User',
        amount: amount,
        reference: reference,
        accountNumber: accountNumber || 'N/A'
      });
    }
    
    return { 
      success: true, 
      balance: result.new_balance, 
      available_balance: result.new_balance,
      transaction_id: result.transaction_id,
      event_id: result.event_id
    };
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

    // Check if this is a plan funding payment (from metadata)
    const planId = metadata?.planId || metadata?.plan_id;
    
    if (planId) {
      // Process plan deposit
      console.log(`Processing plan deposit via webhook: ₦${amountInNaira} for plan ${planId}, user ${userId}, reference: ${reference}`);
      
      const { data: result, error: processError } = await supabase.rpc('process_paystack_plan_deposit', {
        arg_user_id: userId,
        arg_plan_id: planId,
        arg_amount: amountInNaira,
        arg_reference: reference,
        arg_paystack_data: {
          paystack_transaction_id: data.id,
          paystack_reference: reference,
          account_number: data.authorization?.account_number,
          processed_by: 'paystack_webhook',
          processed_at: new Date().toISOString(),
          paystack_data: data,
        },
      });

      if (processError) {
        console.error('Error processing plan deposit via webhook:', processError);
        return;
      }

      if (result && result.success) {
        if (result.already_processed) {
          console.log(`Plan transaction ${reference} was already processed, skipping duplicate notification`);
          return;
        }
        console.log(`Successfully processed plan deposit via webhook: ₦${amountInNaira} for plan ${planId}`);
        return;
      } else {
        console.error('Failed to process plan deposit via webhook:', result);
        return;
      }
    } else {
      // Process wallet deposit (existing flow)
      // Process deposit - this function handles wallet update, transaction creation, events, and notifications
      const depositResult = await addFundsToWallet(
        userId, 
        amountInNaira, 
        reference, 
        data.authorization?.account_number,
        data
      );

      if (depositResult.already_processed) {
        console.log(`Transaction ${reference} was already processed, skipping duplicate notification`);
        return;
      }

      console.log(`Successfully processed charge.success for user ${userId}`);
    }

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

// Function to send email notification
async function sendEmailNotification({
  to,
  firstName,
  amount,
  reference,
  accountNumber
}: {
  to: string;
  firstName: string;
  amount: number;
  reference: string;
  accountNumber: string;
}) {
  try {
    if (!RESEND_API_KEY) {
      console.error('Resend API key not configured');
      return;
    }

    const emailSubject = "Funds Received - Planmoni";
    const emailHtml = generateDepositNotificationHtml({
      firstName,
      amount: `₦${amount.toLocaleString()}`,
      accountNumber,
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
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Planmoni <notifications@planmoni.com>",
        to: to,
        subject: emailSubject,
        html: emailHtml
      })
    });

    if (emailResponse.ok) {
      console.log(`Email notification sent to ${to} for transaction ${reference}`);
    } else {
      console.error(`Failed to send email notification to ${to}:`, await emailResponse.text());
    }
  } catch (error) {
    console.error(`Error sending email notification to ${to}:`, error);
  }
}

// Email template for deposit notifications
function generateDepositNotificationHtml(data: {
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