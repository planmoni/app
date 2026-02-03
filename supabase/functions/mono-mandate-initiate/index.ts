/**
 * Mono Mandate Initiation Edge Function
 * 
 * Initiates a DirectDebit mandate with Mono.
 * Version: 2.1 (Self-healing + V2 Alphanumeric)
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!MONO_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const bankAccountId = body.bankAccountId || body.bank_account_id;
    const monoAccountId = body.monoAccountId || body.mono_account_id;
    const amount = body.amount;

    if (!bankAccountId || !monoAccountId || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Get User Profile & Phone
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const firstName = profile?.first_name || user.user_metadata?.first_name || 'Customer';
    const lastName = profile?.last_name || user.user_metadata?.last_name || 'User';
    const email = profile?.email || user.email;
    
    // Clean and format phone number (ensure it looks like 234...)
    let phone = profile?.phone || user.user_metadata?.phone || '2348000000000';
    phone = phone.replace(/\D/g, ''); // Remove non-digits
    if (phone.startsWith('0')) phone = '234' + phone.substring(1);
    if (!phone.startsWith('234')) phone = '234' + phone;

    let monoCustomerId = profile?.mono_customer_id;

    console.log('👤 Profile Data:', { email, phone, firstName, lastName, hasCustomerId: !!monoCustomerId });

    if (!email) {
      return new Response(JSON.stringify({ error: 'User email not found in profile' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: mandate, error: mandateError } = await supabase
      .from('mono_mandates')
      .insert({
        user_id: user.id,
        bank_account_id: bankAccountId,
        mono_account_id: monoAccountId,
        account_name: 'Checking...',
        account_number: 'Checking...',
        bank_name: 'Checking...',
        status: 'pending',
      })
      .select().single();

    if (mandateError) throw mandateError;

    // 3. Prepare Alphanumeric Reference
    const monoReference = `m${mandate.id.replace(/-/g, '').substring(0, 10)}${Date.now()}`;
    const amountInKobo = Math.round((typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount) * 100);

    const mandatePayload: any = {
      type: 'recurring-debit',
      method: 'mandate',
      mandate_type: 'emandate',
      debit_type: 'variable',
      amount: amountInKobo,
      description: 'Wallet funding authorisation',
      reference: monoReference,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      redirect_url: `https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/mono-webhook`,
      customer: monoCustomerId ? { id: monoCustomerId } : {
        name: `${firstName} ${lastName}`,
        email: email,
      },
      meta: { user_id: user.id, mandate_id: mandate.id, bank_account_id: bankAccountId }
    };

    // 4. API Call with Multi-Layer Self-Healing
    const callMono = async (payload: any) => {
      const res = await fetch(`${MONO_API_BASE}/v2/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY, 'accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { ok: res.ok, status: res.status, data: await res.json() };
    };

    let result = await callMono(mandatePayload);

    // LAYER 1: If customer not found, create and retry
    if (!result.ok && result.data.message?.toLowerCase().includes('customer not found')) {
      console.log('🔄 Customer not found. Creating fresh...');
      const createCust = await fetch(`${MONO_API_BASE}/v2/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY, 'accept': 'application/json' },
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName, address: 'Lagos, Nigeria', phone, type: 'individual' })
      });
      const custData = await createCust.json();
      const freshId = custData.id || custData.data?.id;
      if (freshId) {
        await supabase.from('profiles').update({ mono_customer_id: freshId }).eq('id', user.id);
        mandatePayload.customer = { id: freshId };
        result = await callMono(mandatePayload);
      }
    }

    // LAYER 2: If customer identity is incomplete, update and retry
    if (!result.ok && result.data.message?.toLowerCase().includes('phone number and address are required')) {
      const currentId = monoCustomerId || (mandatePayload.customer?.id);
      if (currentId) {
        console.log('🔄 Customer identity incomplete. Updating existing customer:', currentId);
        await fetch(`${MONO_API_BASE}/v2/customers/${currentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY, 'accept': 'application/json' },
          body: JSON.stringify({ phone, address: 'Lagos, Nigeria' })
        });
        
        console.log('🚀 Retrying mandate initiation after identity update...');
        result = await callMono(mandatePayload);
      }
    }

    if (!result.ok) {
      const errorMsg = result.data.message || result.data.error || 'Unknown Mono Error';
      console.error('❌ MONO API REJECTED REQUEST:', errorMsg);
      console.error('📦 FULL MONO RESPONSE:', JSON.stringify(result.data, null, 2));
      
      await supabase.from('mono_mandates').update({ status: 'failed', mono_webhook_data: result.data }).eq('id', mandate.id);
      return new Response(JSON.stringify({ error: errorMsg, details: result.data }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Success - Update internal record
    const { data: updatedMandate } = await supabase.from('mono_mandates').update({
      mono_mandate_id: result.data.data?.id,
      mono_reference: monoReference,
      mono_webhook_data: result.data.data
    }).eq('id', mandate.id).select().single();

    return new Response(JSON.stringify({ success: true, data: { mandate: updatedMandate, mono_url: result.data.data?.mono_url } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Error', message: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
