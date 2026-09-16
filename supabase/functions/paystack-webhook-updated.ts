// Follow Deno's ES modules convention
//
// DEPRECATED — do not point the Paystack dashboard webhook here.
// Live deposit webhook: Expo route app/api/paystack-webhook+api.ts
// This file has known issues (early 200, wrong RPC arg names, NUBAN-only filter).
// Kept only for reference / emergency rollback.
//
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';
import { generateDepositEmailHtml, generatePayoutSuccessEmailHtml, generatePayoutFailedEmailHtml, generatePayoutReversedEmailHtml, generateVirtualAccountReadyEmailHtml, generateVirtualAccountFailedEmailHtml } from './email-templates.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const paystackSecretKey = Deno.env.get('PAYSTACK_LIVE_SECRET_KEY');
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Paystack webhook IP addresses for validation
const PAYSTACK_IPS = [
  '52.31.139.75',
  '52.49.173.169',
  '52.214.14.220'
];

// SECURITY: Server-side amount limits (cannot be bypassed by client-side manipulation)
const MIN_AMOUNT = 5000; // ₦5,000 minimum
const MAX_AMOUNT = 5000000; // ₦5,000,000 maximum

Deno.serve(async (req) => {
  try {
    // Get client IP for validation
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    // Extract the first IP from x-forwarded-for (client IP)
    const clientIP = forwardedFor.split(',')[0].trim();
    console.log(`🌐 Webhook received from IP: ${clientIP}`);

    // Validate IP address (optional but recommended)
    if (!PAYSTACK_IPS.includes(clientIP)) {
      console.warn(`⚠️ Request from unauthorized IP: ${clientIP}`);
      // Note: In production, you might want to return 403 here
      // For now, we'll continue processing but log the warning
    }

    // Get the request body
    const body = await req.text();
    const event = JSON.parse(body);

    // Verify Paystack signature
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      console.error('❌ Missing Paystack signature header');
      return new Response('Unauthorized', { status: 401 });
    }

    // Create HMAC signature
    const hash = createHmac('sha512', paystackSecretKey).update(body).digest('hex');
    if (hash !== signature) {
      console.error('❌ Invalid Paystack signature');
      return new Response('Unauthorized', { status: 401 });
    }

    console.log(`✅ Webhook signature verified for event: ${event.event}`);

    // Acknowledge receipt immediately to prevent retries
    const response = new Response('OK', { status: 200 });

    // Process the event asynchronously
    processWebhookEvent(event).catch((error) => {
      console.error('❌ Error processing webhook event:', error);
    });

    return response;
  } catch (error) {
    console.error('💥 Fatal error in webhook handler:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

async function processWebhookEvent(event) {
  try {
    console.log(`📨 Processing webhook event: ${event.event}`);
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;
      case 'transfer.success':
        await handleTransferSuccess(event.data);
        break;
      case 'transfer.failed':
        await handleTransferFailed(event.data);
        break;
      case 'transfer.reversed':
        await handleTransferReversed(event.data);
        break;
      case 'dedicatedaccount.assign.success':
        await handleDedicatedAccountSuccess(event.data);
        break;
      case 'dedicatedaccount.assign.failed':
        await handleDedicatedAccountFailed(event.data);
        break;
      default:
        console.log(`ℹ️ Unhandled event type: ${event.event}`);
    }
  } catch (error) {
    console.error('❌ Error processing webhook event:', error);
    throw error;
  }
}

async function handleChargeSuccess(data) {
  try {
    console.log(`💰 Processing successful charge: ${data.reference}`);
    // Only process dedicated NUBAN transactions
    if (data.channel !== 'dedicated_nuban') {
      console.log(`⏭️ Skipping non-dedicated NUBAN transaction: ${data.channel}`);
      return;
    }

    // Find the user by account number
    const { data: paystackAccount, error: accountError } = await supabase
      .from('paystack_accounts')
      .select('user_id, account_number')
      .eq('account_number', data.authorization?.account_number)
      .single();

    if (accountError || !paystackAccount) {
      console.error(`❌ No Paystack account found for account number: ${data.authorization?.account_number}`);
      return;
    }

    // Check if transaction already exists
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference', data.reference)
      .single();

    if (existingTransaction) {
      console.log(`⏭️ Transaction ${data.reference} already processed`);
      return;
    }

    const amountInNaira = data.amount / 100;
    console.log(`💳 Processing deposit: ₦${amountInNaira} for user ${paystackAccount.user_id}`);

    // SECURITY: Server-side validation - reject amounts outside valid range
    // This prevents client-side manipulation (debugging/editing) from bypassing limits
    if (amountInNaira < MIN_AMOUNT || amountInNaira > MAX_AMOUNT) {
      console.error(`❌ SECURITY: Invalid amount detected! Amount: ₦${amountInNaira.toLocaleString()} is outside valid range (₦${MIN_AMOUNT.toLocaleString()} - ₦${MAX_AMOUNT.toLocaleString()})`);
      console.error(`❌ Transaction reference: ${data.reference}, User ID: ${paystackAccount.user_id}`);
      // Log security violation but don't process the deposit
      // The payment was already made to Paystack, but we won't credit the wallet
      return;
    }

    // Process deposit atomically
    const { data: result, error } = await supabase.rpc('process_paystack_deposit', {
      p_user_id: paystackAccount.user_id,
      p_amount: amountInNaira,
      p_reference: data.reference
    });

    if (error) {
      console.error(`❌ Error processing deposit:`, error);
      return;
    }

    if (result && result.success) {
      console.log(`✅ Successfully processed deposit ${data.reference}`);
      
      // Create transaction record for deposit
      await createTransactionRecord({
        user_id: paystackAccount.user_id,
        amount: amountInNaira,
        reference: data.reference
      }, data, 'completed', 'deposit');

      // Send push notification
      await supabase.rpc('send_push_notification', {
        p_user_id: paystackAccount.user_id,
        p_title: 'Funds Received',
        p_body: `₦${amountInNaira.toLocaleString()} has been added to your wallet`,
        p_data: {
          type: 'deposit_successful',
          transaction_reference: data.reference,
          amount: amountInNaira
        }
      });

      // Send email notification
      await sendDepositEmailNotification(paystackAccount.user_id, amountInNaira, data.reference);
    } else {
      console.error(`❌ Failed to process deposit ${data.reference}`);
    }
  } catch (error) {
    console.error('❌ Error handling charge success:', error);
    throw error;
  }
}

async function handleTransferSuccess(data) {
  try {
    console.log(`✅ Processing successful transfer: ${data.reference}`);
    
    // First, check if this is an emergency withdrawal
    const { data: emergencyWithdrawal, error: emergencyError } = await supabase
      .from('emergency_withdrawals')
      .select('id, user_id, payout_plan_id, withdrawal_amount, net_amount, status, reference')
      .eq('reference', data.reference)
      .single();

    if (!emergencyError && emergencyWithdrawal) {
      console.log(`🚨 Processing emergency withdrawal success: ${data.reference}`);
      await handleEmergencyWithdrawalSuccess(emergencyWithdrawal, data);
      return;
    }

    // If not emergency withdrawal, check for automated payout
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, user_id, amount, status')
      .eq('transfer_reference', data.reference)
      .single();

    if (payoutError || !automatedPayout) {
      console.error(`❌ No automated payout or emergency withdrawal found for transfer reference: ${data.reference}`);
      return;
    }

    console.log(`📋 Processing automated payout success: ${data.reference}`);
    await handleAutomatedPayoutSuccess(automatedPayout, data);
  } catch (error) {
    console.error('❌ Error handling transfer success:', error);
    throw error;
  }
}

async function handleEmergencyWithdrawalSuccess(emergencyWithdrawal, data) {
  try {
    // Update emergency withdrawal status
    const { error: updateError } = await supabase
      .from('emergency_withdrawals')
      .update({
        status: 'completed',
        transferred_at: new Date().toISOString(),
        transfer_code: data.transfer_code,
        metadata: {
          paystack_transfer_id: data.id,
          paystack_reference: data.reference,
          transfer_success: true,
          paystack_transfer_data: data
        }
      })
      .eq('id', emergencyWithdrawal.id);

    if (updateError) {
      console.error(`❌ Error updating emergency withdrawal status:`, updateError);
      return;
    }

    console.log(`✅ Emergency withdrawal ${emergencyWithdrawal.id} marked as completed`);

    // Update the payout plan status to cancelled (since emergency withdrawal cancels the plan)
    const { error: planUpdateError } = await supabase
      .from('payout_plans')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', emergencyWithdrawal.payout_plan_id);

    if (planUpdateError) {
      console.error(`❌ Error updating payout plan status:`, planUpdateError);
    } else {
      console.log(`✅ Payout plan ${emergencyWithdrawal.payout_plan_id} marked as cancelled`);
    }

    // Create transaction record
    await createTransactionRecord({
      user_id: emergencyWithdrawal.user_id,
      amount: emergencyWithdrawal.net_amount,
      reference: emergencyWithdrawal.reference,
      payout_plan_id: emergencyWithdrawal.payout_plan_id
    }, data, 'completed', 'withdrawal');

    // Update wallet balance - reduce both balance and locked_balance since money is being withdrawn from the system
    const { error: reduceError } = await supabase.rpc("transfer_funds", {
      arg_user_id: emergencyWithdrawal.user_id,
      arg_amount: emergencyWithdrawal.withdrawal_amount
    });

    if (reduceError) {
      console.error(`❌ Error reducing wallet balance for emergency withdrawal:`, reduceError);
    } else {
      console.log(`✅ Successfully reduced ₦${emergencyWithdrawal.withdrawal_amount} from wallet for user ${emergencyWithdrawal.user_id}`);
    }

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: emergencyWithdrawal.user_id,
      p_title: 'Emergency Withdrawal Completed',
      p_body: `Your emergency withdrawal of ₦${emergencyWithdrawal.net_amount.toLocaleString()} has been completed`,
      p_data: {
        type: 'emergency_withdrawal_successful',
        withdrawal_id: emergencyWithdrawal.id,
        amount: emergencyWithdrawal.net_amount
      }
    });

    // Send email notification
    await sendEmergencyWithdrawalSuccessEmailNotification(
      emergencyWithdrawal.user_id, 
      emergencyWithdrawal.net_amount, 
      data.reference, 
      emergencyWithdrawal.id
    );
  } catch (error) {
    console.error('❌ Error handling emergency withdrawal success:', error);
    throw error;
  }
}

async function handleAutomatedPayoutSuccess(automatedPayout, data) {
  try {
    // Update automated payout status
    const { error: updateError } = await supabase
      .from('automated_payouts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        transfer_code: data.transfer_code,
        transferred_at: data.transferred_at || new Date().toISOString(),
        metadata: {
          ...automatedPayout.metadata,
          transfer_success: true,
          paystack_transfer_data: data
        }
      })
      .eq('id', automatedPayout.id);

    if (updateError) {
      console.error(`❌ Error updating automated payout status:`, updateError);
      return;
    }

    console.log(`✅ Automated payout ${automatedPayout.id} marked as completed`);

    // Create transaction record
    await createTransactionRecord(automatedPayout, data, 'completed');

    console.log("sample: ", automatedPayout.user_id, "this is ", data.amount);
    await updateWalletBalance(automatedPayout.user_id, data.amount);

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: automatedPayout.user_id,
      p_title: 'Payout Successful',
      p_body: `Your payout of ₦${(data.amount / 100).toLocaleString()} has been completed`,
      p_data: {
        type: 'payout_successful',
        payout_id: automatedPayout.id,
        amount: data.amount / 100
      }
    });

    // Send email notification
    await sendPayoutSuccessEmailNotification(automatedPayout.user_id, data.amount / 100, data.reference, automatedPayout.id);
  } catch (error) {
    console.error('❌ Error handling automated payout success:', error);
    throw error;
  }
}

async function handleTransferFailed(data) {
  try {
    console.log(`❌ Processing failed transfer: ${data.reference}`);
    
    // First, check if this is an emergency withdrawal
    const { data: emergencyWithdrawal, error: emergencyError } = await supabase
      .from('emergency_withdrawals')
      .select('id, user_id, payout_plan_id, withdrawal_amount, net_amount, status, reference')
      .eq('reference', data.reference)
      .single();

    if (!emergencyError && emergencyWithdrawal) {
      console.log(`🚨 Processing emergency withdrawal failure: ${data.reference}`);
      await handleEmergencyWithdrawalFailed(emergencyWithdrawal, data);
      return;
    }

    // If not emergency withdrawal, check for automated payout
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, user_id, amount, status')
      .eq('transfer_reference', data.reference)
      .single();

    if (payoutError || !automatedPayout) {
      console.error(`❌ No automated payout or emergency withdrawal found for transfer reference: ${data.reference}`);
      return;
    }

    console.log(`📋 Processing automated payout failure: ${data.reference}`);
    await handleAutomatedPayoutFailed(automatedPayout, data);
  } catch (error) {
    console.error('❌ Error handling transfer failed:', error);
    throw error;
  }
}

async function handleEmergencyWithdrawalFailed(emergencyWithdrawal, data) {
  try {
    // Update emergency withdrawal status
    const { error: updateError } = await supabase
      .from('emergency_withdrawals')
      .update({
        status: 'failed',
        error_message: 'Transfer failed - Bank processing error',
        processed_at: new Date().toISOString(),
        transfer_code: data.transfer_code,
        metadata: {
          paystack_transfer_id: data.id,
          paystack_reference: data.reference,
          transfer_failed: true,
          paystack_transfer_data: data
        }
      })
      .eq('id', emergencyWithdrawal.id);

    if (updateError) {
      console.error(`❌ Error updating emergency withdrawal status:`, updateError);
      return;
    }

    console.log(`❌ Emergency withdrawal ${emergencyWithdrawal.id} marked as failed`);

    // Create transaction record
    await createTransactionRecord({
      user_id: emergencyWithdrawal.user_id,
      amount: emergencyWithdrawal.net_amount,
      reference: emergencyWithdrawal.reference,
      payout_plan_id: emergencyWithdrawal.payout_plan_id
    }, data, 'failed', 'withdrawal');

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: emergencyWithdrawal.user_id,
      p_title: 'Emergency Withdrawal Failed',
      p_body: `Your emergency withdrawal of ₦${emergencyWithdrawal.net_amount.toLocaleString()} has failed. Please try again.`,
      p_data: {
        type: 'emergency_withdrawal_failed',
        withdrawal_id: emergencyWithdrawal.id,
        amount: emergencyWithdrawal.net_amount
      }
    });

    // Send email notification
    await sendEmergencyWithdrawalFailedEmailNotification(
      emergencyWithdrawal.user_id, 
      emergencyWithdrawal.net_amount, 
      data.reference, 
      emergencyWithdrawal.id, 
      'Transfer failed - Bank processing error'
    );
  } catch (error) {
    console.error('❌ Error handling emergency withdrawal failed:', error);
    throw error;
  }
}

async function handleAutomatedPayoutFailed(automatedPayout, data) {
  try {
    // Update automated payout status
    const { error: updateError } = await supabase
      .from('automated_payouts')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: 'Transfer failed - Bank processing error',
        transfer_code: data.transfer_code,
        metadata: {
          ...automatedPayout.metadata,
          transfer_failed: true,
          paystack_transfer_data: data
        }
      })
      .eq('id', automatedPayout.id);

    if (updateError) {
      console.error(`❌ Error updating automated payout status:`, updateError);
      return;
    }

    console.log(`❌ Automated payout ${automatedPayout.id} marked as failed`);

    // Create transaction record
    await createTransactionRecord(automatedPayout, data, 'failed');

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: automatedPayout.user_id,
      p_title: 'Payout Failed',
      p_body: `Your payout of ₦${(data.amount / 100).toLocaleString()} has failed. Please try again.`,
      p_data: {
        type: 'payout_failed',
        payout_id: automatedPayout.id,
        amount: data.amount / 100
      }
    });

    // Send email notification
    await sendPayoutFailedEmailNotification(automatedPayout.user_id, data.amount / 100, data.reference, automatedPayout.id, 'Transfer failed - Bank processing error');
  } catch (error) {
    console.error('❌ Error handling automated payout failed:', error);
    throw error;
  }
}

async function handleTransferReversed(data) {
  try {
    console.log(`🔄 Processing reversed transfer: ${data.reference}`);
    
    // First, check if this is an emergency withdrawal
    const { data: emergencyWithdrawal, error: emergencyError } = await supabase
      .from('emergency_withdrawals')
      .select('id, user_id, payout_plan_id, withdrawal_amount, net_amount, status, reference')
      .eq('reference', data.reference)
      .single();

    if (!emergencyError && emergencyWithdrawal) {
      console.log(`🚨 Processing emergency withdrawal reversal: ${data.reference}`);
      await handleEmergencyWithdrawalReversed(emergencyWithdrawal, data);
      return;
    }

    // If not emergency withdrawal, check for automated payout
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, user_id, amount, status')
      .eq('transfer_reference', data.reference)
      .single();

    if (payoutError || !automatedPayout) {
      console.error(`❌ No automated payout or emergency withdrawal found for transfer reference: ${data.reference}`);
      return;
    }

    console.log(`📋 Processing automated payout reversal: ${data.reference}`);
    await handleAutomatedPayoutReversed(automatedPayout, data);
  } catch (error) {
    console.error('❌ Error handling transfer reversed:', error);
    throw error;
  }
}

async function handleEmergencyWithdrawalReversed(emergencyWithdrawal, data) {
  try {
    // Update emergency withdrawal status to reversed
    const { error: updateError } = await supabase
      .from('emergency_withdrawals')
      .update({
        status: 'reversed',
        error_message: data.reason || 'Transfer was reversed',
        processed_at: new Date().toISOString(),
        transfer_code: data.transfer_code,
        metadata: {
          paystack_transfer_id: data.id,
          paystack_reference: data.reference,
          transfer_reversed: true,
          paystack_transfer_data: data
        }
      })
      .eq('id', emergencyWithdrawal.id);

    if (updateError) {
      console.error(`❌ Error updating emergency withdrawal status:`, updateError);
      return;
    }

    console.log(`🔄 Emergency withdrawal ${emergencyWithdrawal.id} marked as reversed`);

    // Create transaction record
    await createTransactionRecord({
      user_id: emergencyWithdrawal.user_id,
      amount: emergencyWithdrawal.net_amount,
      reference: emergencyWithdrawal.reference,
      payout_plan_id: emergencyWithdrawal.payout_plan_id
    }, data, 'reversed', 'withdrawal');

    // Update wallet balance - add funds back to both balance and locked_balance (since reversal means money goes back to the plan)
    // First add to total balance
    const { error: addError } = await supabase.rpc("add_funds", {
      arg_user_id: emergencyWithdrawal.user_id,
      arg_amount: emergencyWithdrawal.withdrawal_amount
    });

    if (addError) {
      console.error(`❌ Error adding funds back for emergency withdrawal reversal:`, addError);
    } else {
      // Then lock the funds back (since it was originally in a payout plan)
      const { error: lockError } = await supabase.rpc("lock_funds", {
        arg_user_id: emergencyWithdrawal.user_id,
        arg_amount: emergencyWithdrawal.withdrawal_amount
      });

      if (lockError) {
        console.error(`❌ Error locking funds back for emergency withdrawal reversal:`, lockError);
      } else {
        console.log(`✅ Successfully added and locked ₦${emergencyWithdrawal.withdrawal_amount} back to wallet for user ${emergencyWithdrawal.user_id}`);
      }
    }

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: emergencyWithdrawal.user_id,
      p_title: 'Emergency Withdrawal Reversed',
      p_body: `Your emergency withdrawal of ₦${emergencyWithdrawal.net_amount.toLocaleString()} has been reversed. Funds returned to your wallet.`,
      p_data: {
        type: 'emergency_withdrawal_reversed',
        withdrawal_id: emergencyWithdrawal.id,
        amount: emergencyWithdrawal.net_amount
      }
    });

    // Send email notification
    await sendEmergencyWithdrawalReversedEmailNotification(
      emergencyWithdrawal.user_id, 
      emergencyWithdrawal.net_amount, 
      data.reference, 
      emergencyWithdrawal.id, 
      data.reason
    );
  } catch (error) {
    console.error('❌ Error handling emergency withdrawal reversed:', error);
    throw error;
  }
}

async function handleAutomatedPayoutReversed(automatedPayout, data) {
  try {
    // Update automated payout status to reversed
    const { error: updateError } = await supabase
      .from('automated_payouts')
      .update({
        status: 'reversed',
        reversed_at: new Date().toISOString(),
        reversal_reason: data.reason || 'Transfer was reversed',
        transfer_code: data.transfer_code,
        metadata: {
          ...automatedPayout.metadata,
          transfer_reversed: true,
          paystack_transfer_data: data
        }
      })
      .eq('id', automatedPayout.id);

    if (updateError) {
      console.error(`❌ Error updating automated payout status:`, updateError);
      return;
    }

    console.log(`🔄 Automated payout ${automatedPayout.id} marked as reversed`);

    // Create transaction record
    await createTransactionRecord(automatedPayout, data, 'reversed');

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: automatedPayout.user_id,
      p_title: 'Payout Reversed',
      p_body: `Your payout of ₦${(data.amount / 100).toLocaleString()} has been reversed. Funds returned to your wallet.`,
      p_data: {
        type: 'payout_reversed',
        payout_id: automatedPayout.id,
        amount: data.amount / 100
      }
    });

    // Send email notification
    await sendPayoutReversedEmailNotification(automatedPayout.user_id, data.amount / 100, data.reference, automatedPayout.id, data.reason);
  } catch (error) {
    console.error('❌ Error handling automated payout reversed:', error);
    throw error;
  }
}

async function handleDedicatedAccountSuccess(data) {
  try {
    console.log(`✅ Processing dedicated account assignment success: ${data.customer.customer_code}`);
    
    // Find user by customer code
    const { data: paystackAccount, error: accountError } = await supabase
      .from('paystack_accounts')
      .select('user_id, account_number')
      .eq('customer_code', data.customer.customer_code)
      .single();

    if (accountError || !paystackAccount) {
      console.error(`❌ No Paystack account found for customer code: ${data.customer.customer_code}`);
      return;
    }

    // Update account status
    const { error: updateError } = await supabase
      .from('paystack_accounts')
      .update({
        status: 'active',
        account_number: data.dedicated_account.account_number,
        bank_name: data.dedicated_account.bank.name,
        assigned_at: new Date().toISOString()
      })
      .eq('user_id', paystackAccount.user_id);

    if (updateError) {
      console.error(`❌ Error updating account status:`, updateError);
      return;
    }

    console.log(`✅ Paystack account activated for user ${paystackAccount.user_id}`);

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: paystackAccount.user_id,
      p_title: 'Virtual Account Ready',
      p_body: 'Your virtual account has been activated and is ready to receive funds',
      p_data: {
        type: 'virtual_account_ready',
        account_number: data.dedicated_account.account_number
      }
    });

    // Send email notification
    await sendVirtualAccountReadyEmailNotification(paystackAccount.user_id, data.dedicated_account.account_number, data.dedicated_account.bank.name);
  } catch (error) {
    console.error('❌ Error handling dedicated account success:', error);
    throw error;
  }
}

async function handleDedicatedAccountFailed(data) {
  try {
    console.log(`❌ Processing dedicated account assignment failure: ${data.customer.customer_code}`);
    
    // Find user by customer code
    const { data: paystackAccount, error: accountError } = await supabase
      .from('paystack_accounts')
      .select('user_id')
      .eq('customer_code', data.customer.customer_code)
      .single();

    if (accountError || !paystackAccount) {
      console.error(`❌ No Paystack account found for customer code: ${data.customer.customer_code}`);
      return;
    }

    // Update account status
    const { error: updateError } = await supabase
      .from('paystack_accounts')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: 'Account assignment failed - Please try again'
      })
      .eq('user_id', paystackAccount.user_id);

    if (updateError) {
      console.error(`❌ Error updating account status:`, updateError);
      return;
    }

    console.log(`❌ Paystack account assignment failed for user ${paystackAccount.user_id}`);

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: paystackAccount.user_id,
      p_title: 'Virtual Account Setup Failed',
      p_body: 'We couldn\'t set up your virtual account. Please try again or contact support.',
      p_data: {
        type: 'virtual_account_failed'
      }
    });

    // Send email notification
    await sendVirtualAccountFailedEmailNotification(paystackAccount.user_id, 'Account assignment failed - Please try again');
  } catch (error) {
    console.error('❌ Error handling dedicated account failure:', error);
    throw error;
  }
}

// Email notification functions for different event types
async function sendDepositEmailNotification(userId, amount, reference) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
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
    };

    await sendEmail(userProfile.email, "Funds Received - Planmoni", generateDepositEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending deposit email notification:', error);
  }
}

async function sendPayoutSuccessEmailNotification(userId, amount, reference, payoutId) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      payoutId
    };

    await sendEmail(userProfile.email, "Payout Successful - Planmoni", generatePayoutSuccessEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending payout success email notification:', error);
  }
}

async function sendEmergencyWithdrawalSuccessEmailNotification(userId, amount, reference, withdrawalId) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      withdrawalId
    };

    await sendEmail(userProfile.email, "Emergency Withdrawal Successful - Planmoni", generatePayoutSuccessEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending emergency withdrawal success email notification:', error);
  }
}

async function sendPayoutFailedEmailNotification(userId, amount, reference, payoutId, failureReason) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      payoutId,
      failureReason: failureReason || 'Transfer failed'
    };

    await sendEmail(userProfile.email, "Payout Failed - Planmoni", generatePayoutFailedEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending payout failed email notification:', error);
  }
}

async function sendEmergencyWithdrawalFailedEmailNotification(userId, amount, reference, withdrawalId, failureReason) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      withdrawalId,
      failureReason: failureReason || 'Transfer failed'
    };

    await sendEmail(userProfile.email, "Emergency Withdrawal Failed - Planmoni", generatePayoutFailedEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending emergency withdrawal failed email notification:', error);
  }
}

async function sendVirtualAccountReadyEmailNotification(userId, accountNumber, bankName) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      accountNumber,
      bankName,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference: 'Virtual Account Setup'
    };

    await sendEmail(userProfile.email, "Virtual Account Ready - Planmoni", generateVirtualAccountReadyEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending virtual account ready email notification:', error);
  }
}

async function sendVirtualAccountFailedEmailNotification(userId, failureReason) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference: 'Virtual Account Setup',
      failureReason: failureReason || 'Account setup failed'
    };

    await sendEmail(userProfile.email, "Virtual Account Setup Failed - Planmoni", generateVirtualAccountFailedEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending virtual account failed email notification:', error);
  }
}

async function sendPayoutReversedEmailNotification(userId, amount, reference, payoutId, reversalReason) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      payoutId,
      failureReason: reversalReason || 'Transfer was reversed'
    };

    await sendEmail(userProfile.email, "Payout Reversed - Planmoni", generatePayoutReversedEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending payout reversed email notification:', error);
  }
}

async function sendEmergencyWithdrawalReversedEmailNotification(userId, amount, reference, withdrawalId, reversalReason) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (!userProfile?.email) {
      console.log('No email found for user');
      return;
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      withdrawalId,
      failureReason: reversalReason || 'Transfer was reversed'
    };

    await sendEmail(userProfile.email, "Emergency Withdrawal Reversed - Planmoni", generatePayoutReversedEmailHtml(emailData));
  } catch (error) {
    console.error('❌ Error sending emergency withdrawal reversed email notification:', error);
  }
}

// Create transaction record function
async function createTransactionRecord(payoutData, paystackData, status, type = 'payout') {
  try {
    console.log(`📑 Creating transaction record for ${type}: ${payoutData.reference || paystackData.reference}`);
    
    const transactionData = {
      p_user_id: payoutData.user_id,
      p_type: type,
      p_amount: payoutData.amount || paystackData.amount / 100,
      p_status: status,
      p_source: type === 'deposit' ? 'Virtual Account' : 'Wallet',
      p_destination: type === 'deposit' ? 'Wallet' : 'Bank Transfer',
      p_reference: paystackData.reference,
      p_payout_plan_id: type === 'deposit' ? null : payoutData.payout_plan_id,
      p_description: type === 'deposit' ? `Funds received via virtual account` : 
                    type === 'withdrawal' ? `Emergency withdrawal transfer` : 
                    `Automated payout transfer`,
      p_metadata: {
        paystack_transfer_code: paystackData.transfer_code,
        paystack_transfer_id: paystackData.id,
        automated_payout_id: payoutData.id,
        payout_plan_id: payoutData.payout_plan_id
      }
    };

    const { data: transactionId, error } = await supabase.rpc('create_transaction_record', transactionData);
    
    if (error) {
      console.error(`❌ Failed to create transaction record:`, error);
      return null;
    }

    console.log(`✅ Transaction record created: ${transactionId}`);
    return transactionId;
  } catch (error) {
    console.error('❌ Error creating transaction record:', error);
    return null;
  }
}

async function updateWalletBalance(userId, amount) {
  console.log("user: ", userId, "amount ", amount / 100);
  const { data, error } = await supabase.rpc("deduct_locked_funds", {
    arg_user_id: userId,
    arg_amount: amount / 100
  });

  if (error) {
    throw new Error(`Failed to update wallet balance: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(`Wallet balance update failed: ${data?.error || "Unknown error"}`);
  }

  console.log(`✅ Wallet balance updated successfully for user ${userId}`);
  return data;
}

// Generic email sending function
async function sendEmail(to, subject, html) {
  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Planmoni <notifications@planmoni.com>",
        to,
        subject,
        html
      })
    });

    if (emailResponse.ok) {
      console.log(`📧 Email notification sent to ${to}`);
    } else {
      console.error('❌ Failed to send email notification:', await emailResponse.text());
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}
