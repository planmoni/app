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
async function addFundsToWallet(userId: string, amount: number, reference: string, accountNumber?: string, paystackData?: any, fees?: number, totalAmount?: number) {
  try {
    // Extract the actual amount paid from Paystack webhook (in naira)
    // Paystack sends amount in kobo, so we need to get it from paystackData
    const paystackAmountInNaira = paystackData?.amount ? paystackData.amount / 100 : null;
    
    // If metadata wasn't extracted from webhook, try to extract from paystackData
    // Paystack stores our metadata in data.metadata
    if ((!fees || fees === 0) && paystackData?.metadata) {
      console.log('🔍 Metadata not found in webhook, extracting from paystackData...');
      const paystackMetadata = paystackData.metadata;
      
      if (paystackMetadata && typeof paystackMetadata === 'object') {
        const extractedAmount = paystackMetadata.amount_to_credit ? parseFloat(String(paystackMetadata.amount_to_credit)) : null;
        const extractedFee = paystackMetadata.fee ? parseFloat(String(paystackMetadata.fee)) : null;
        const extractedTotal = paystackMetadata.total_paid ? parseFloat(String(paystackMetadata.total_paid)) : null;
        
        if (extractedAmount !== null && extractedAmount !== amount) {
          console.log(`✅ Found amount_to_credit in paystackData: ${extractedAmount}, updating amount from ${amount}`);
          amount = extractedAmount;
        }
        if (extractedFee !== null && extractedFee !== fees) {
          console.log(`✅ Found fee in paystackData: ${extractedFee}, updating fees from ${fees || 0}`);
          fees = extractedFee;
        }
        if (extractedTotal !== null && extractedTotal !== totalAmount) {
          console.log(`✅ Found total_paid in paystackData: ${extractedTotal}, updating totalAmount from ${totalAmount || amount}`);
          totalAmount = extractedTotal;
        }
      }
    }
    
    // CRITICAL: Always pass total_amount (amount user paid to Paystack) so function can auto-calculate fees
    // If totalAmount is not provided, use the Paystack webhook amount (what user actually paid)
    const finalTotalAmount = totalAmount || paystackAmountInNaira || amount;
    
    // If we have totalAmount but no fees, let the function auto-calculate fees
    // The function will calculate: fees = (totalAmount * 0.015) + 100
    // And then: amount_to_credit = totalAmount - fees
    const finalAmount = amount; // This will be overridden by function if totalAmount is provided
    const finalFees = fees || 0; // If 0, function will auto-calculate
    
    console.log(`💰 Processing deposit: Total paid: ₦${finalTotalAmount.toLocaleString()}, Fees: ₦${finalFees.toLocaleString()}, Amount to credit: ₦${finalAmount.toLocaleString()}`);
    console.log(`📋 Function will auto-calculate fees if needed (1.5% + NGN 100)`);

    // Process deposit atomically using process_paystack_deposit function
    // The function will automatically calculate and deduct fees if total_amount is provided
    // This ensures fees are always deducted even if metadata extraction fails
    const { data: result, error } = await supabase.rpc('process_paystack_deposit', {
      arg_user_id: userId,
      arg_amount: finalAmount, // Amount after fees (what user receives) - function will recalculate if total_amount provided
      arg_reference: reference,
      arg_paystack_data: {
        paystack_transaction_id: paystackData?.id,
        paystack_reference: reference,
        account_number: accountNumber,
        processed_by: 'paystack_webhook',
        processed_at: new Date().toISOString(),
        amount: paystackAmountInNaira, // Store the actual Paystack amount for reference
        ...(paystackData && { paystack_data: paystackData })
      },
      arg_fees: finalFees, // Fees deducted (0 if not provided, function will auto-calculate)
      arg_total_amount: finalTotalAmount // Total amount paid - CRITICAL for auto-fee calculation
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
      metadata: webhookMetadata,
      customer,
      authorization
    } = data;
    
    const email = customer?.email;
    
    // Paystack sends metadata at the top level of the webhook data object
    // But it might also be nested in data.metadata or data.metadata.custom_fields
    let metadata = webhookMetadata || data.metadata || {};
    
    // If metadata is a string, try to parse it
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.warn('Failed to parse metadata string:', e);
        metadata = {};
      }
    }

    // Convert amount from kobo to naira
    const amountInNaira = amount / 100;
    
    // Extract amount_to_credit, fee, and total_paid from metadata
    // Paystack sends our checkout metadata at the top level, but might also nest it
    let amountToCredit = amountInNaira;
    let feesFromMetadata = 0;
    let totalPaidFromMetadata = amountInNaira;
    
    // Helper function to safely parse numeric values from metadata
    const parseMetadataNumber = (value: any): number | null => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = parseFloat(String(value));
      return isNaN(parsed) ? null : parsed;
    };
    
    // Check metadata object (Paystack sends it at top level in webhook)
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      // Check for amount_to_credit (what user should receive)
      // Try multiple possible keys
      const amountToCreditValue = 
        parseMetadataNumber(metadata.amount_to_credit) ||
        parseMetadataNumber(metadata.amountToCredit) ||
        parseMetadataNumber(metadata['amount_to_credit']);
      
      if (amountToCreditValue !== null) {
        amountToCredit = amountToCreditValue;
        console.log(`✅ Found amount_to_credit in metadata: ${amountToCredit}`);
      }
      
      // Check for fee (fees deducted)
      const feeValue = 
        parseMetadataNumber(metadata.fee) ||
        parseMetadataNumber(metadata.fees) ||
        parseMetadataNumber(metadata['fee']);
      
      if (feeValue !== null) {
        feesFromMetadata = feeValue;
        console.log(`✅ Found fee in metadata: ${feesFromMetadata}`);
      }
      
      // Check for total_paid (total amount user paid)
      const totalPaidValue = 
        parseMetadataNumber(metadata.total_paid) ||
        parseMetadataNumber(metadata.totalPaid) ||
        parseMetadataNumber(metadata['total_paid']);
      
      if (totalPaidValue !== null) {
        totalPaidFromMetadata = totalPaidValue;
        console.log(`✅ Found total_paid in metadata: ${totalPaidFromMetadata}`);
      }
      
      // Also check nested structure (in case Paystack wraps it)
      if (metadata.custom_fields && Array.isArray(metadata.custom_fields)) {
        for (const field of metadata.custom_fields) {
          if (field.variable_name === 'amount_to_credit' || field.display_name === 'amount_to_credit') {
            const value = parseMetadataNumber(field.value);
            if (value !== null) amountToCredit = value;
          }
          if (field.variable_name === 'fee' || field.display_name === 'fee') {
            const value = parseMetadataNumber(field.value);
            if (value !== null) feesFromMetadata = value;
          }
          if (field.variable_name === 'total_paid' || field.display_name === 'total_paid') {
            const value = parseMetadataNumber(field.value);
            if (value !== null) totalPaidFromMetadata = value;
          }
        }
      }
    }
    
    // If we have amount_to_credit but no fee, calculate fee
    if (amountToCredit !== amountInNaira && feesFromMetadata === 0) {
      feesFromMetadata = amountInNaira - amountToCredit;
      console.log(`📊 Calculated fee from difference: ${feesFromMetadata}`);
    }
    
    // If we still don't have the metadata values, check the full data object
    // Paystack might nest metadata in different places
    if (amountToCredit === amountInNaira && feesFromMetadata === 0) {
      console.log('🔍 Metadata not found in top-level, checking nested structures...');
      
      // Check if metadata is nested in data object itself
      const nestedMetadata = (data as any)?.metadata?.metadata || (data as any)?.metadata?.custom_fields;
      if (nestedMetadata) {
        console.log('📋 Found nested metadata:', JSON.stringify(nestedMetadata, null, 2));
        // Try to extract from nested structure
        if (typeof nestedMetadata === 'object' && !Array.isArray(nestedMetadata)) {
          const nestedAmount = parseMetadataNumber(nestedMetadata.amount_to_credit);
          const nestedFee = parseMetadataNumber(nestedMetadata.fee);
          const nestedTotal = parseMetadataNumber(nestedMetadata.total_paid);
          
          if (nestedAmount !== null) amountToCredit = nestedAmount;
          if (nestedFee !== null) feesFromMetadata = nestedFee;
          if (nestedTotal !== null) totalPaidFromMetadata = nestedTotal;
        }
      }
    }
    
    // Use calculated values
    const fees = feesFromMetadata;
    const totalAmount = totalPaidFromMetadata;
    
    console.log(`💰 Payment processing: Total paid: ₦${totalAmount.toLocaleString()}, Fees: ₦${fees.toLocaleString()}, Amount to credit: ₦${amountToCredit.toLocaleString()}`);
    console.log(`📋 Full metadata:`, JSON.stringify(metadata, null, 2));
    console.log(`📋 Raw webhook data.metadata:`, JSON.stringify(data.metadata, null, 2));
    console.log(`📋 Full webhook data structure keys:`, Object.keys(data || {}));

    let userId: string | null = null;

    // Check if this is a checkout payment (has user_id in metadata)
    if (metadata?.user_id) {
      console.log('Processing Paystack checkout payment for reference:', reference);
      userId = metadata.user_id;
    }
    // Check if this is a USSD payment
    else if (metadata?.payment_type === 'ussd') {
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
    }
    // Handle virtual account payment (existing logic)
    else {
      const account_number = authorization?.account_number;
      if (account_number) {
        userId = await findUserByVirtualAccount(account_number);
        if (!userId) {
          console.error(`No user found for virtual account: ${account_number}`);
          return;
        }
      } else {
        // Fallback: Try to find user by email for checkout payments without metadata
        console.log('No account number found, trying to find user by email:', email);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        if (profileError || !profile) {
          console.error(`No user found for email: ${email}`);
          return;
        }

        userId = profile.id;
      }
    }

    // Add funds to user's wallet
    if (!userId) {
      console.error('No user ID found for the payment');
      return;
    }

    // If metadata extraction failed, try to get it from Paystack API as fallback
    // This handles cases where webhook metadata structure is different
    if (amountToCredit === amountInNaira && fees === 0) {
      console.log('⚠️ Metadata not found in webhook, checking if this is a checkout payment...');
      
      // For checkout payments, we can calculate fees based on Paystack's fee structure
      // Paystack fee: 1.5% + NGN 100
      // If amount seems to include fees, try to reverse calculate
      // This is a fallback - ideally metadata should be present
      
      // Check if this looks like a checkout payment (no account_number means it's likely checkout)
      if (!authorization?.account_number) {
        console.log('🔍 No account number - likely checkout payment, attempting fee calculation...');
        // For checkout, if amount is large enough, it likely includes fees
        // Try to reverse calculate: if amount = X, and X includes 1.5% + 100 fee
        // Then: X = amount_to_credit + (amount_to_credit * 0.015) + 100
        // Solving: amount_to_credit = (X - 100) / 1.015
        const calculatedAmountToCredit = (amountInNaira - 100) / 1.015;
        const calculatedFee = amountInNaira - calculatedAmountToCredit;
        
        // Only use this if the calculated fee is reasonable (between 100 and 20% of amount)
        if (calculatedFee >= 100 && calculatedFee <= amountInNaira * 0.2) {
          amountToCredit = Math.round(calculatedAmountToCredit * 100) / 100; // Round to 2 decimals
          fees = Math.round(calculatedFee * 100) / 100;
          totalAmount = amountInNaira;
          console.log(`📊 Reverse calculated: Amount to credit: ₦${amountToCredit}, Fees: ₦${fees}`);
        }
      }
    }

    // Final validation: ensure amountToCredit is not greater than amountInNaira
    if (amountToCredit > amountInNaira) {
      console.warn('⚠️ amountToCredit is greater than total paid, using total paid as amount');
      amountToCredit = amountInNaira;
      fees = 0;
      totalAmount = amountInNaira;
    }

    console.log(`💰 Final values: Total paid: ₦${totalAmount.toLocaleString()}, Fees: ₦${fees.toLocaleString()}, Amount to credit: ₦${amountToCredit.toLocaleString()}`);

    // Process deposit - this function handles wallet update, transaction creation, events, and notifications
    // CRITICAL: Always pass amountInNaira as totalAmount so the function can auto-calculate fees
    // The function will automatically deduct Paystack fees (1.5% + NGN 100) if fees are 0
    // This ensures fees are always deducted even if metadata extraction fails
    const depositResult = await addFundsToWallet(
      userId, 
      amountToCredit, // Amount after fees (what user receives) - function will recalculate if needed
      reference, 
      data.authorization?.account_number,
      data, // Full Paystack webhook data (includes amount in kobo)
      fees, // Fees deducted (0 if not found, function will auto-calculate)
      totalAmount || amountInNaira // Total amount paid - CRITICAL: Always pass Paystack amount so function can auto-calculate fees
    );

    if (depositResult.already_processed) {
      console.log(`Transaction ${reference} was already processed, skipping duplicate notification`);
      return;
    }

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