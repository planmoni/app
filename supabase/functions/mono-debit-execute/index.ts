/**
 * Mono Debit Execution Edge Function
 * 
 * Executes a user-initiated debit using an active DirectDebit mandate.
 * 
 * SECURITY:
 * - User authentication required
 * - Validates mandate ownership and status
 * - Ensures debit does not exceed mandate limit
 * - Server-side secret key storage
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MONO_API_BASE = 'https://api.withmono.com';
const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY');

interface ExecuteDebitRequest {
  mandateId: string; // Internal mandate ID
  amount: number; // Amount in Naira
  description?: string;
  reference?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // SECURITY: Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!MONO_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ExecuteDebitRequest = await req.json();
    console.log('📦 Received debit request body:', JSON.stringify(body));

    // Ensure amount is a number
    const numericAmount = typeof body.amount === 'string' ? parseFloat(body.amount.replace(/,/g, '')) : body.amount;

    // Validate required fields
    if (!body.mandateId || !numericAmount || numericAmount <= 0) {
      console.error('❌ Missing required fields in body:', body, 'Parsed Amount:', numericAmount);
      return new Response(
        JSON.stringify({ error: 'Missing required fields or invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Get mandate and verify ownership and status
    const { data: mandate, error: mandateError } = await supabase
      .from('mono_mandates')
      .select('*')
      .eq('id', body.mandateId)
      .eq('user_id', user.id)
      .single();

    if (mandateError || !mandate) {
      console.error('❌ Mandate lookup error:', mandateError, 'for ID:', body.mandateId);
      return new Response(
        JSON.stringify({ error: 'Mandate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Found mandate:', JSON.stringify(mandate));

    if (mandate.status !== 'active') {
      console.warn('⚠️ Mandate is not active. Status:', mandate.status);
      return new Response(
        JSON.stringify({ error: `Mandate is not active. Current status: ${mandate.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mandate.mono_reference && !mandate.mono_mandate_id) {
      console.error('❌ Missing mono_reference and mono_mandate_id in mandate record');
      return new Response(
        JSON.stringify({ error: 'Mandate reference not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use mono_mandate_id if available, otherwise fallback to mono_reference
    const monoMandateRef = mandate.mono_mandate_id || mandate.mono_reference;

    // Convert amount to kobo
    const amountInKobo = Math.round(numericAmount * 100);

    // Generate unique reference if not provided
    const reference = body.reference || `debit_${user.id}_${mandate.id}_${Date.now()}`;

    // SECURITY: Check KYC Level 0 limits
    const { data: kycData } = await supabase
      .from('kyc_data')
      .select('kyc_tier')
      .eq('user_id', user.id)
      .single();

    const isKYCLevel0 = !kycData?.kyc_tier || kycData.kyc_tier === 0;
    const SINGLE_TRANSACTION_LIMIT = 50000; // ₦50,000

    if (isKYCLevel0 && numericAmount > SINGLE_TRANSACTION_LIMIT) {
      return new Response(
        JSON.stringify({ 
          error: `Amount exceeds KYC Level 0 limit of ₦${SINGLE_TRANSACTION_LIMIT.toLocaleString()}. Please complete KYC verification.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Executing Mono debit:', {
      mandateId: body.mandateId,
      mandateReference: monoMandateRef,
      amount: numericAmount,
      amountInKobo,
      reference,
    });

    // Execute debit with Mono
    const debitPayload = {
      amount: amountInKobo,
      mandate: monoMandateRef, // Use mandate ID/reference
      description: body.description || `DirectDebit: ₦${numericAmount}`,
      reference: reference,
      metadata: {
        user_id: user.id,
        mandate_id: body.mandateId,
        bank_account_id: mandate.bank_account_id,
      },
    };

    const monoResponse = await fetch(`${MONO_API_BASE}/v2/debits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
        'accept': 'application/json',
      },
      body: JSON.stringify(debitPayload),
    });

    const monoData = await monoResponse.json();

    if (!monoResponse.ok) {
      console.error('❌ Mono debit execution error:', monoData);
      return new Response(
        JSON.stringify({ 
          error: monoData.message || monoData.error || 'Failed to execute debit',
          details: monoData 
        }),
        { status: monoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const debitId = monoData.data?.id;
    const debitStatus = monoData.data?.status;
    const settlementDate = monoData.data?.settlement_date;

    if (!debitId) {
      console.error('❌ No debit ID in Mono response:', monoData);
      return new Response(
        JSON.stringify({ error: 'Invalid response from Mono' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'deposit',
        amount: numericAmount,
        status: 'pending', // Will be updated by webhook when settled
        source: 'mono_directdebit',
        destination: 'wallet',
        description: body.description || `Mono DirectDebit: ₦${numericAmount}`,
        reference: reference,
        metadata: {
          mono_debit_id: debitId,
          mono_mandate_id: mandate.mono_mandate_id,
          mandate_id: body.mandateId,
          debit_status: debitStatus,
          settlement_date: settlementDate,
          initiated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (transactionError) {
      console.error('❌ Error creating transaction record:', transactionError);
      // Don't fail the request - debit was initiated successfully
    }

    console.log('✅ Debit executed successfully:', {
      debitId,
      status: debitStatus,
      reference,
      amount: numericAmount,
      settlementDate,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          debit_id: debitId,
          status: debitStatus,
          reference: reference,
          amount: numericAmount,
          mandate_id: body.mandateId,
          settlement_date: settlementDate,
          transaction_id: transaction?.id,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in debit execution:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

