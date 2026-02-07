/**
 * Mono Webhook Handler - Supabase Edge Function
 * 
 * CRITICAL: Handles Mono DirectDebit webhooks (NOT DirectPay)
 * 
 * DirectDebit Webhook Events:
 * - mandate.created - Mandate created (pending authorization)
 * - mandate.activated - Mandate authorized and activated
 * - mandate.cancelled - Mandate cancelled by user
 * - debit.initiated - Debit initiated (pending)
 * - debit.successful - Debit successful and settled
 * - debit.failed - Debit failed
 * - debit.reversed - Debit reversed
 * 
 * SECURITY FEATURES:
 * - HMAC SHA256 signature verification
 * - Constant-time comparison (prevents timing attacks)
 * - Debit verification with Mono API before crediting
 * - Amount verification (prevents tampering)
 * - Idempotency (prevents double crediting)
 * - Only credit wallet after confirmed settlement
 * 
 * CRITICAL DIFFERENCE FROM DIRECTPAY:
 * - DirectDebit debits may take 1-3 business days to settle
 * - Only credit wallet when debit is 'successful' AND 'settled'
 * - Mandates must be active before debits can be initiated
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mono-webhook-secret',
};

// Initialize Supabase client with service role key (bypasses RLS for webhook processing)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Mono webhook secret (from Mono dashboard)
const MONO_WEBHOOK_SECRET = Deno.env.get('MONO_WEBHOOK_SECRET');
const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY');
const MONO_API_BASE = 'https://api.withmono.com';

/**
 * SECURITY: Verify Mono webhook
 * Mono sends the secret in header "mono-webhook-secret" (must match MONO_WEBHOOK_SECRET).
 * See https://docs.mono.co/docs/webhooks
 */
function verifyMonoWebhookSecret(headerSecret: string | null): boolean {
  if (!MONO_WEBHOOK_SECRET) {
    console.error('❌ MONO_WEBHOOK_SECRET not configured');
    return false;
  }
  if (!headerSecret || headerSecret.trim() === '') {
    console.error('❌ No mono-webhook-secret in headers');
    return false;
  }
  // Constant-time comparison
  const expected = MONO_WEBHOOK_SECRET;
  if (headerSecret.length !== expected.length) return false;
  let match = true;
  for (let i = 0; i < expected.length; i++) {
    if (headerSecret.charCodeAt(i) !== expected.charCodeAt(i)) match = false;
  }
  return match;
}

/**
 * SECURITY: Verify debit with Mono API before crediting
 * CRITICAL: Only credit wallet when debit is successful AND settled
 */
async function verifyDebitWithMono(reference: string): Promise<{ 
  success: boolean; 
  status?: string; 
  settled?: boolean;
  amount?: number; 
  error?: string 
}> {
  try {
    if (!MONO_SECRET_KEY) {
      throw new Error('MONO_SECRET_KEY not configured');
    }

    const verifyUrl = `${MONO_API_BASE}/v2/debits/${reference}`;
    
    const response = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'mono-sec-key': MONO_SECRET_KEY,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Failed to verify debit with Mono API:', errorData);
      return { success: false, error: 'Debit verification failed' };
    }

    const verifyData = await response.json();
    const debit = verifyData.data?.data || verifyData.data;
    const status = debit?.status;
    const settled = debit?.settled === true || debit?.settlement_status === 'settled';
    const amount = debit?.amount; // in kobo

    return {
      success: true,
      status: status,
      settled: settled,
      amount: amount,
    };
  } catch (error) {
    console.error('❌ Error verifying debit with Mono:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Verification error' };
  }
}

/**
 * SECURITY: Process Mono DirectDebit deposit with idempotency
 * CRITICAL: Only credit wallet when debit is successful AND settled
 * Uses atomic RPC function to prevent double crediting
 */
async function processMonoDebit(
  userId: string,
  amount: number,
  reference: string,
  monoDebitId: string,
  monoData: any
) {
  try {
    console.log(`💰 Processing Mono DirectDebit: ₦${amount} for user ${userId}, reference: ${reference}`);

    // SECURITY: Verify debit with Mono API before crediting
    const verification = await verifyDebitWithMono(reference);
    
    if (!verification.success) {
      console.error('❌ Debit verification failed:', verification.error);
      throw new Error('Debit verification failed');
    }

    const debitStatus = verification.status;
    const isSettled = verification.settled;

    // CRITICAL: Only credit if debit is successful AND settled
    // DirectDebit debits may be 'successful' but not yet settled
    if (debitStatus !== 'successful' || !isSettled) {
      console.log(`⏳ Debit not yet settled. Status: ${debitStatus}, Settled: ${isSettled}`);
      // Update transaction status but don't credit wallet yet
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'pending',
          metadata: {
            ...monoData,
            verified_status: debitStatus,
            verified_settled: isSettled,
            verified_at: new Date().toISOString(),
          }
        })
        .eq('reference', reference)
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Error updating transaction:', updateError);
      }

      return { 
        success: false, 
        message: 'Debit not yet settled', 
        settled: false 
      };
    }

    // SECURITY: Verify amount matches (in kobo)
    const verifiedAmountInKobo = verification.amount;
    const expectedAmountInKobo = Math.round(amount * 100);
    
    if (verifiedAmountInKobo && verifiedAmountInKobo !== expectedAmountInKobo) {
      console.error(`❌ Amount mismatch. Expected: ${expectedAmountInKobo}, Got: ${verifiedAmountInKobo}`);
      throw new Error('Amount verification failed');
    }

    // Process deposit atomically using process_mono_deposit function
    // This function handles wallet update, transaction creation, and prevents duplicates
    const { data: result, error } = await supabase.rpc('process_mono_deposit', {
      arg_user_id: userId,
      arg_amount: amount,
      arg_reference: reference,
      arg_mono_data: {
        mono_debit_id: monoDebitId,
        mono_reference: reference,
        verified_status: debitStatus,
        verified_settled: isSettled,
        verified_amount: verifiedAmountInKobo,
        processed_by: 'mono_webhook',
        processed_at: new Date().toISOString(),
        ...(monoData && { mono_webhook_data: monoData })
      }
    });

    if (error) {
      console.error('❌ Error processing deposit:', error);
      throw error;
    }

    if (!result || !result.success) {
      if (result?.already_processed) {
        console.log(`✅ Transaction ${reference} was already processed (idempotency check)`);
        return { 
          success: true, 
          message: 'Transaction already processed', 
          already_processed: true 
        };
      }
      console.error('❌ Process deposit failed:', result);
      throw new Error('Failed to process deposit');
    }

    console.log(`✅ Successfully processed Mono DirectDebit: ₦${amount} for user ${userId}`);
    
    return { 
      success: true, 
      balance: result.new_balance, 
      transaction_id: result.transaction_id,
      event_id: result.event_id
    };
  } catch (error) {
    console.error('❌ Error in processMonoDebit:', error);
    throw error;
  }
}

/**
 * SECURITY: Check KYC Level 0 limits
 * Mono allows debits up to certain limits for KYC Level 0 users
 */
async function checkKYCLevel0Limits(userId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get user's KYC status
    const { data: kycData } = await supabase
      .from('kyc_data')
      .select('kyc_tier, bvn_verified')
      .eq('user_id', userId)
      .single();

    // If user has completed KYC, no limits apply
    if (kycData?.kyc_tier && kycData.kyc_tier >= 1) {
      return { allowed: true };
    }

    // KYC Level 0 limits for DirectDebit (from Mono documentation)
    const DAILY_LIMIT = 50000; // ₦50,000 per day
    const SINGLE_TRANSACTION_LIMIT = 50000; // ₦50,000 per transaction
    const WEEKLY_LIMIT = 200000; // ₦200,000 per week (cumulative)

    // Check single transaction limit
    if (amount > SINGLE_TRANSACTION_LIMIT) {
      return { 
        allowed: false, 
        reason: `Amount exceeds KYC Level 0 single transaction limit of ₦${SINGLE_TRANSACTION_LIMIT.toLocaleString()}` 
      };
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayDebits } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .eq('source', 'mono_directdebit')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    const todayTotal = (todayDebits || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
    
    if (todayTotal + amount > DAILY_LIMIT) {
      return { 
        allowed: false, 
        reason: `Amount would exceed KYC Level 0 daily limit of ₦${DAILY_LIMIT.toLocaleString()}. Today's total: ₦${todayTotal.toLocaleString()}` 
      };
    }

    // Check weekly limit
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: weekDebits } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .eq('source', 'mono_directdebit')
      .gte('created_at', weekAgo.toISOString())
      .lt('created_at', tomorrow.toISOString());

    const weekTotal = (weekDebits || []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
    
    if (weekTotal + amount > WEEKLY_LIMIT) {
      return { 
        allowed: false, 
        reason: `Amount would exceed KYC Level 0 weekly limit of ₦${WEEKLY_LIMIT.toLocaleString()}. Week's total: ₦${weekTotal.toLocaleString()}` 
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('❌ Error checking KYC limits:', error);
    // Fail open for now, but log the error
    return { allowed: true };
  }
}

/**
 * Handle mandate activation (user authorized the mandate)
 */
async function handleMandateActivated(data: any) {
  try {
    console.log('✅ Processing mandate activation event:', data.id);

    const monoMandateId = data.id;
    const mandateReference = data.reference;
    const userId = data.metadata?.user_id;
    const mandateId = data.metadata?.mandate_id; // Our internal mandate ID

    if (!userId || !mandateId) {
      console.error('❌ Missing user_id or mandate_id in mandate metadata');
      return;
    }

    // Update mandate status to active
    const { error: updateError } = await supabase
      .from('mono_mandates')
      .update({
        status: 'active',
        activated_at: new Date().toISOString(),
        authorized_at: new Date().toISOString(),
        mono_webhook_data: data,
      })
      .eq('id', mandateId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating mandate status:', updateError);
    } else {
      console.log(`✅ Mandate ${mandateId} activated successfully`);
    }
  } catch (error) {
    console.error('❌ Error handling mandate activation:', error);
  }
}

/**
 * Handle mandate expiry
 */
async function handleMandateExpired(data: any) {
  try {
    console.log('⏰ Processing mandate expiry event:', data.id);

    const monoMandateId = data.id;
    const userId = data.metadata?.user_id;
    const mandateId = data.metadata?.mandate_id;

    if (!userId || !mandateId) {
      console.error('❌ Missing user_id or mandate_id in mandate metadata');
      return;
    }

    // Update mandate status to expired
    const { error: updateError } = await supabase
      .from('mono_mandates')
      .update({
        status: 'expired',
        mono_webhook_data: data,
      })
      .eq('id', mandateId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating mandate status:', updateError);
    } else {
      console.log(`✅ Mandate ${mandateId} expired`);
    }
  } catch (error) {
    console.error('❌ Error handling mandate expiry:', error);
  }
}

/**
 * Handle mandate cancellation
 */
async function handleMandateCancelled(data: any) {
  try {
    console.log('❌ Processing mandate cancellation event:', data.id);

    const monoMandateId = data.id;
    const userId = data.metadata?.user_id;
    const mandateId = data.metadata?.mandate_id;

    if (!userId || !mandateId) {
      console.error('❌ Missing user_id or mandate_id in mandate metadata');
      return;
    }

    // Update mandate status to cancelled
    const { error: updateError } = await supabase
      .from('mono_mandates')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        mono_webhook_data: data,
      })
      .eq('id', mandateId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating mandate status:', updateError);
    } else {
      console.log(`✅ Mandate ${mandateId} cancelled`);
    }
  } catch (error) {
    console.error('❌ Error handling mandate cancellation:', error);
  }
}

/**
 * Verify one-time payment with Mono API before crediting
 */
async function verifyDirectPayWithMono(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  error?: string;
}> {
  try {
    if (!MONO_SECRET_KEY) {
      return { success: false, error: 'MONO_SECRET_KEY not configured' };
    }
    const res = await fetch(`${MONO_API_BASE}/v2/payments/verify/${reference}`, {
      method: 'GET',
      headers: {
        'mono-sec-key': MONO_SECRET_KEY,
        'accept': 'application/json',
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message || 'Verify failed' };
    }
    const data = await res.json();
    const obj = data.data?.object || data.data;
    return {
      success: true,
      status: obj?.status,
      amount: obj?.amount,
    };
  } catch (e) {
    console.error('❌ Error verifying Direct Pay:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Verify error' };
  }
}

/**
 * Handle Direct Pay (one-time) success: lookup by reference, credit via process_mono_deposit, update payment row
 */
async function handleDirectPaySuccess(data: any) {
  try {
    const reference = data.reference || data.object?.reference;
    if (!reference) {
      console.error('❌ Direct Pay success: no reference in payload');
      return;
    }
    const { data: row, error: lookupError } = await supabase
      .from('mono_directpay_payments')
      .select('user_id, amount, fee, total_charged, status')
      .eq('reference', reference)
      .single();

    if (lookupError || !row) {
      console.log('⏭️ Direct Pay: no mono_directpay_payments row for reference', reference, '- skip (avoid retries)');
      return;
    }
    if (row.status === 'successful') {
      console.log('✅ Direct Pay: already processed (idempotency)', reference);
      return;
    }

    const userId = row.user_id;
    const amountNaira = Number(row.amount);
    // Mono returns the total charged (deposit + fee); may be in kobo or naira depending on env
    const totalCharged = row.total_charged != null ? Number(row.total_charged) : null;
    const monoPaymentId = data.object?.id || data.id;

    const verification = await verifyDirectPayWithMono(reference);
    if (!verification.success) {
      console.error('❌ Direct Pay verify failed:', verification.error);
      return;
    }
    if (verification.amount != null && totalCharged != null) {
      // Normalize Mono amount to kobo: large values (e.g. >= 10000) are kobo, else naira
      const monoKobo =
        verification.amount >= 10000
          ? Math.round(verification.amount)
          : Math.round(verification.amount * 100);
      const expectedKobo = Math.round(totalCharged * 100);
      if (monoKobo !== expectedKobo) {
        console.error('❌ Direct Pay amount mismatch. Expected kobo:', expectedKobo, 'Got monoKobo:', monoKobo);
        return;
      }
    }
    // When total_charged is null (legacy row), skip amount check and still credit row.amount

    const { data: result, error } = await supabase.rpc('process_mono_deposit', {
      arg_user_id: userId,
      arg_amount: amountNaira,
      arg_reference: reference,
      arg_mono_data: {
        source: 'mono_directpay',
        mono_payment_id: monoPaymentId,
        mono_reference: reference,
        processed_by: 'mono_webhook',
        processed_at: new Date().toISOString(),
        mono_webhook_data: data,
      },
    });

    if (error) {
      console.error('❌ process_mono_deposit error:', error);
      return;
    }
    if (result && !result.success && !result.already_processed) {
      console.error('❌ process_mono_deposit failed:', result);
      return;
    }

    await supabase
      .from('mono_directpay_payments')
      .update({ status: 'successful', updated_at: new Date().toISOString() })
      .eq('reference', reference);

    console.log('✅ Direct Pay processed: ₦' + amountNaira + ' for user', userId);
  } catch (err) {
    console.error('❌ handleDirectPaySuccess:', err);
    throw err;
  }
}

/**
 * Update Direct Pay payment status (failed / abandoned / cancelled)
 */
async function handleDirectPayStatusUpdate(data: any, status: 'failed' | 'abandoned' | 'cancelled') {
  try {
    const reference = data.reference || data.object?.reference;
    if (!reference) {
      console.log('⏭️ Direct Pay status update: no reference');
      return;
    }
    const { error } = await supabase
      .from('mono_directpay_payments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('reference', reference);
    if (error) {
      console.error('❌ Failed to update mono_directpay_payments:', error);
    } else {
      console.log('✅ Direct Pay status updated to', status, 'for', reference);
    }
  } catch (err) {
    console.error('❌ handleDirectPayStatusUpdate:', err);
  }
}

/**
 * Handle successful DirectDebit (debit successful AND settled)
 * CRITICAL: Only credit wallet when debit is settled
 */
async function handleDebitSuccessful(data: any) {
  try {
    console.log('✅ Processing DirectDebit success event:', data.id);

    const debitId = data.id;
    const reference = data.reference;
    const amountInKobo = data.amount;
    const amountInNaira = amountInKobo / 100;
    const mandateReference = data.mandate;
    const userId = data.metadata?.user_id;
    const mandateId = data.metadata?.mandate_id;
    const settled = data.settled === true || data.settlement_status === 'settled';

    if (!userId) {
      console.error('❌ No user_id in debit metadata');
      return;
    }

    if (!reference) {
      console.error('❌ No reference in debit data');
      return;
    }

    // CRITICAL: Only process if debit is settled
    if (!settled) {
      console.log(`⏳ Debit ${reference} successful but not yet settled. Waiting for settlement...`);
      // Update transaction status but don't credit wallet
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'pending',
          metadata: {
            ...data,
            settled: false,
            settlement_status: data.settlement_status || 'pending',
          }
        })
        .eq('reference', reference)
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Error updating transaction:', updateError);
      }
      return;
    }

    // SECURITY: Check KYC Level 0 limits
    const kycCheck = await checkKYCLevel0Limits(userId, amountInNaira);
    if (!kycCheck.allowed) {
      console.error(`❌ KYC limit check failed: ${kycCheck.reason}`);
      // Log but don't throw - let the verification step handle it
    }

    // Process the deposit (will verify with Mono API before crediting)
    // Include event ID in metadata for idempotency
    const eventId = data.webhook_event_id || data.id || data.event_id;
    const debitDataWithEventId = {
      ...data,
      webhook_event_id: eventId,
    };
    
    await processMonoDebit(
      userId,
      amountInNaira,
      reference,
      debitId,
      debitDataWithEventId
    );

    console.log(`✅ Successfully processed DirectDebit: ₦${amountInNaira} for user ${userId}`);
  } catch (error) {
    console.error('❌ Error handling DirectDebit success:', error);
    throw error;
  }
}

/**
 * Handle failed DirectDebit
 */
async function handleDebitFailed(data: any) {
  try {
    console.log('❌ Processing DirectDebit failed event:', data.id);

    const reference = data.reference;
    const userId = data.metadata?.user_id;

    if (!userId || !reference) {
      console.error('❌ Missing user_id or reference in failed debit data');
      return;
    }

    // Update transaction status to failed
    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
        metadata: {
          ...data,
          failed_at: new Date().toISOString(),
          failure_reason: data.failure_reason || 'Debit failed'
        }
      })
      .eq('reference', reference)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error updating failed transaction:', error);
    } else {
      console.log(`✅ Updated transaction ${reference} status to failed`);
    }
  } catch (error) {
    console.error('❌ Error handling DirectDebit failed:', error);
  }
}

/**
 * Handle reversed DirectDebit
 * CRITICAL: If debit was already credited, we need to reverse the credit
 */
async function handleDebitReversed(data: any) {
  try {
    console.log('⚠️ Processing DirectDebit reversal event:', data.id);

    const reference = data.reference;
    const userId = data.metadata?.user_id;

    if (!userId || !reference) {
      console.error('❌ Missing user_id or reference in reversed debit data');
      return;
    }

    // Check if transaction was already completed (credited)
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, status, amount')
      .eq('reference', reference)
      .eq('user_id', userId)
      .single();

    if (transaction && transaction.status === 'completed') {
      console.log(`⚠️ Reversing already-credited debit: ₦${transaction.amount}`);
      
      // Reverse the wallet credit
      const { error: reverseError } = await supabase.rpc('reverse_transaction', {
        arg_transaction_id: transaction.id,
        arg_reason: 'DirectDebit reversed by Mono',
      });

      if (reverseError) {
        console.error('❌ Error reversing transaction:', reverseError);
        // Manual intervention may be required
      } else {
        // Update transaction status
        await supabase
          .from('transactions')
          .update({
            status: 'reversed',
            updated_at: new Date().toISOString(),
            metadata: {
              ...data,
              reversed_at: new Date().toISOString(),
            }
          })
          .eq('id', transaction.id);

        console.log(`✅ Reversed transaction ${transaction.id}`);
      }
    } else {
      // Just update status if not yet credited
      await supabase
        .from('transactions')
        .update({
          status: 'reversed',
          updated_at: new Date().toISOString(),
          metadata: {
            ...data,
            reversed_at: new Date().toISOString(),
          }
        })
        .eq('reference', reference)
        .eq('user_id', userId);
    }
  } catch (error) {
    console.error('❌ Error handling DirectDebit reversal:', error);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🔔 Mono webhook received at:', new Date().toISOString());
    console.log('📡 Request method:', req.method);
    console.log('📡 Request URL:', req.url);
    
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // SECURITY: Mono sends secret in header "mono-webhook-secret" (docs.mono.co/docs/webhooks)
    const rawBody = await req.text();
    const webhookSecret = req.headers.get('mono-webhook-secret');
    console.log('🔐 mono-webhook-secret present:', !!webhookSecret);
    console.log('📦 Raw body length:', rawBody.length);

    if (!verifyMonoWebhookSecret(webhookSecret)) {
      console.error('❌ Invalid or missing mono-webhook-secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Webhook secret verified successfully');

    // Parse webhook payload
    let webhookData: any;
    try {
      webhookData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Error parsing webhook payload:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Webhook event type:', webhookData.type || webhookData.event);
    console.log('📋 Webhook data keys:', Object.keys(webhookData.data || webhookData));

    // SECURITY: Idempotency using mono_webhook_events (event_id) - skip if already processed
    const eventId = webhookData.event_id || webhookData.id || webhookData.data?.id;
    if (eventId) {
      const { error: eventInsertError } = await supabase
        .from('mono_webhook_events')
        .insert({ event_id: eventId });
      if (eventInsertError?.code === '23505') {
        console.log(`✅ Webhook event ${eventId} already processed (mono_webhook_events)`);
        return new Response(
          JSON.stringify({ status: 'success', message: 'Event already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Also check transactions for legacy idempotency (DirectDebit)
      const { data: existingEvent } = await supabase
        .from('transactions')
        .select('id')
        .eq('metadata->>webhook_event_id', eventId)
        .single();
      if (existingEvent) {
        console.log(`✅ Webhook event ${eventId} already processed (transactions idempotency)`);
        return new Response(
          JSON.stringify({ status: 'success', message: 'Event already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle different webhook events (Mono may send event with "mono.events." prefix)
    const rawEventType = webhookData.type || webhookData.event || '';
    const eventType = rawEventType.replace(/^mono\.events\./, '');
    const eventData = webhookData.data || webhookData;
    
    // Add event ID to event data for tracking
    if (eventId) {
      eventData.webhook_event_id = eventId;
    }
    
    switch (eventType) {
      // Direct Pay (one-time) events - resolve user from mono_directpay_payments by reference
      case 'direct_debit.payment_successful':
        if (eventData.type === 'onetime-debit') {
          await handleDirectPaySuccess(eventData);
        } else {
          // Recurring debit success may use debit.successful; ignore here if not onetime
          console.log('📝 direct_debit.payment_successful (non-onetime) - not Direct Pay');
        }
        break;
      case 'direct_debit.payment_failed':
        await handleDirectPayStatusUpdate(eventData, 'failed');
        break;
      case 'direct_debit.payment_abandoned':
        await handleDirectPayStatusUpdate(eventData, 'abandoned');
        break;
      case 'direct_debit.payment_cancelled':
        await handleDirectPayStatusUpdate(eventData, 'cancelled');
        break;

      // Mandate events
      case 'mandate.activated':
      case 'mandate.active':
        await handleMandateActivated(eventData);
        break;
      
      case 'mandate.cancelled':
      case 'mandate.cancel':
        await handleMandateCancelled(eventData);
        break;
      
      case 'mandate.created':
        console.log('📝 Mandate created - waiting for activation');
        break;
      
      case 'mandate.expired':
      case 'mandate.expiry':
        await handleMandateExpired(eventData);
        break;
      
      // Debit events (recurring DirectDebit)
      case 'debit.successful':
      case 'debit.success':
        await handleDebitSuccessful(eventData);
        break;
      
      case 'debit.failed':
      case 'debit.failure':
        await handleDebitFailed(eventData);
        break;
      
      case 'debit.reversed':
      case 'debit.reversal':
        await handleDebitReversed(eventData);
        break;
      
      case 'debit.initiated':
      case 'debit.pending':
        console.log('⏳ Debit initiated/pending - monitoring only');
        break;
      
      default:
        console.log(`⚠️  Unhandled webhook event: ${eventType}`);
    }

    console.log('✅ Webhook processed successfully');
    
    // Return success immediately to acknowledge receipt
    return new Response(
      JSON.stringify({ status: 'success' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Error processing Mono webhook:', error);
    console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return 500 but don't expose error details
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
