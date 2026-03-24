/**
 * Mono Mandate Initiation Edge Function
 * 
 * Initiates a DirectDebit mandate with Mono using the required configuration:
 * - type: recurring-debit
 * - method: mandate
 * - mandate_type: emandate
 * - debit_type: variable
 * 
 * SECURITY:
 * - User authentication required
 * - Server-side secret key storage
 * - Validates mandate ownership
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

interface InitiateMandateRequest {
  bankAccountId: string;
  monoAccountId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  amount: number; // Maximum total debit authorization in kobo
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

    const body: InitiateMandateRequest = await req.json();

    // Validate required fields
    if (!body.bankAccountId || !body.monoAccountId || !body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify bank account belongs to user
    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', body.bankAccountId)
      .eq('user_id', user.id)
      .single();

    if (bankError || !bankAccount) {
      return new Response(
        JSON.stringify({ error: 'Bank account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create mandate record in database first
    const { data: mandate, error: mandateError } = await supabase
      .from('mono_mandates')
      .insert({
        user_id: user.id,
        bank_account_id: body.bankAccountId,
        mono_account_id: body.monoAccountId,
        account_name: body.accountName || bankAccount.account_name,
        account_number: body.accountNumber || bankAccount.account_number,
        bank_name: body.bankName || bankAccount.bank_name,
        bank_code: body.bankCode || bankAccount.bank_code,
        status: 'pending',
      })
      .select()
      .single();

    if (mandateError) {
      console.error('Error creating mandate:', mandateError);
      return new Response(
        JSON.stringify({ error: 'Failed to create mandate' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique reference
    const monoReference = `mandate_${user.id}_${mandate.id}_${Date.now()}`;

    // Fetch user profile for customer information
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .single();

    const firstName = profile?.first_name || user.user_metadata?.first_name || '';
    const lastName = profile?.last_name || user.user_metadata?.last_name || '';
    const email = profile?.email || user.email || '';

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerName = `${firstName} ${lastName}`.trim() || email.split('@')[0];

    // Convert amount to kobo (Mono expects amount in kobo)
    const amountInKobo = Math.round(body.amount * 100);

    // CRITICAL: Use exact configuration as specified
    const mandatePayload = {
      type: 'recurring-debit',
      method: 'mandate',
      mandate_type: 'emandate',
      debit_type: 'variable',
      amount: amountInKobo, // Maximum total debit authorization (NOT per transaction)
      description: 'Wallet funding authorisation',
      account: body.monoAccountId,
      reference: monoReference,
      customer: {
        name: customerName,
        email: email,
      },
      metadata: {
        user_id: user.id,
        mandate_id: mandate.id,
        bank_account_id: body.bankAccountId,
      },
    };

    console.log('🚀 Initiating Mono mandate:', {
      mandateId: mandate.id,
      reference: monoReference,
      amount: amountInKobo,
    });

    // Call Mono API to create mandate
    const monoResponse = await fetch(`${MONO_API_BASE}/v2/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
        'accept': 'application/json',
      },
      body: JSON.stringify(mandatePayload),
    });

    const monoData = await monoResponse.json();

    if (!monoResponse.ok) {
      console.error('❌ Mono mandate creation error:', monoData);
      
      // Update mandate status to failed
      await supabase
        .from('mono_mandates')
        .update({ status: 'failed' })
        .eq('id', mandate.id);

      return new Response(
        JSON.stringify({ 
          error: monoData.message || monoData.error || 'Failed to create mandate',
          details: monoData 
        }),
        { status: monoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const monoMandateId = monoData.data?.id;
    const mandateStatus = monoData.data?.status;
    const monoUrl = monoData.data?.mono_url; // URL for user authorization

    if (!monoMandateId) {
      console.error('❌ No mandate ID in Mono response:', monoData);
      return new Response(
        JSON.stringify({ error: 'Invalid response from Mono' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update mandate with Mono mandate ID and reference
    const { data: updatedMandate, error: updateError } = await supabase
      .from('mono_mandates')
      .update({
        mono_mandate_id: monoMandateId,
        mono_reference: monoReference,
        status: mandateStatus === 'active' ? 'active' : 'pending',
        ...(mandateStatus === 'active' && { activated_at: new Date().toISOString() }),
        mono_webhook_data: monoData.data,
      })
      .eq('id', mandate.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating mandate:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update mandate' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Mandate initiated successfully:', {
      mandateId: mandate.id,
      monoMandateId,
      status: mandateStatus,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          mandate: updatedMandate,
          mono_mandate_id: monoMandateId,
          mono_reference: monoReference,
          status: mandateStatus,
          mono_url: monoUrl, // User needs to authorize via this URL
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in mandate initiation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

