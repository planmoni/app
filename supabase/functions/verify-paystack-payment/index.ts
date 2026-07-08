import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_LIVE_SECRET_KEY') || Deno.env.get('PAYSTACK_SECRET_KEY');
const PAYSTACK_API_URL = 'https://api.paystack.co';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { reference, planId } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ success: false, error: 'Reference is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!PAYSTACK_SECRET_KEY) {
      console.error('Paystack secret key is not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Payment service not properly configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment with Paystack
    console.log(`Verifying payment with reference: ${reference}`);
    const verifyResponse = await fetch(`${PAYSTACK_API_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      console.error('Paystack verification failed:', verifyData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: verifyData.message || 'Payment verification failed' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transaction = verifyData.data;

    // Check if payment was successful
    if (transaction.status !== 'success') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Payment status: ${transaction.status}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert amount from kobo to naira
    const amountInNaira = transaction.amount / 100;

    // Prepare Paystack data
    const paystackData = {
      paystack_transaction_id: transaction.id,
      paystack_reference: reference,
      customer_email: transaction.customer?.email,
      customer_code: transaction.customer?.customer_code,
      authorization_code: transaction.authorization?.authorization_code,
      channel: transaction.channel,
      gateway_response: transaction.gateway_response,
      processed_by: 'verify-paystack-payment',
      processed_at: new Date().toISOString(),
      paystack_data: transaction,
    };

    // Route to plan deposit or wallet deposit based on planId
    if (planId) {
      // Process plan deposit
      console.log(`Processing plan deposit: ₦${amountInNaira} for plan ${planId}, user ${user.id}, reference: ${reference}`);
      
      const { data: result, error: processError } = await supabase.rpc('process_paystack_plan_deposit', {
        arg_user_id: user.id,
        arg_plan_id: planId,
        arg_amount: amountInNaira,
        arg_reference: reference,
        arg_paystack_data: paystackData,
      });

      if (processError) {
        console.error('Error processing plan deposit:', processError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to process plan deposit: ' + processError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!result || !result.success) {
        if (result?.already_processed) {
          console.log(`Plan transaction ${reference} was already processed`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Transaction already processed',
              already_processed: true 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('Process plan deposit failed:', result);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: result?.error || 'Failed to process plan deposit' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully processed plan deposit: ₦${amountInNaira} for plan ${planId}`);
      await sendDepositPushNotification(supabaseUrl, user.id, amountInNaira, reference, true);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment verified and plan funded successfully',
          transaction_id: result.transaction_id,
          plan_id: planId,
          new_balance: result.new_balance,
          amount: amountInNaira,
          is_plan_deposit: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Process wallet deposit (existing flow)
      // Check if transaction already exists
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('reference', reference)
        .eq('type', 'deposit')
        .single();

      if (existingTransaction) {
        if (existingTransaction.status === 'completed') {
          console.log(`Transaction ${reference} already processed`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Transaction already processed',
              already_processed: true 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`Processing wallet deposit: ₦${amountInNaira} for user ${user.id}, reference: ${reference}`);
      
      const { data: result, error: processError } = await supabase.rpc('process_paystack_deposit', {
        arg_user_id: user.id,
        arg_amount: amountInNaira,
        arg_reference: reference,
        arg_paystack_data: paystackData,
      });

      if (processError) {
        console.error('Error processing deposit:', processError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to process deposit: ' + processError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!result || !result.success) {
        if (result?.already_processed) {
          console.log(`Transaction ${reference} was already processed`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Transaction already processed',
              already_processed: true 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('Process deposit failed:', result);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: result?.error || 'Failed to process deposit' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully processed deposit: ₦${amountInNaira} for user ${user.id}`);
      await sendDepositPushNotification(supabaseUrl, user.id, amountInNaira, reference, false);
      await sendDepositEmailNotification(supabaseUrl, user.id, amountInNaira, reference, 'Paystack');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment verified and processed successfully',
          transaction_id: result.transaction_id,
          new_balance: result.new_balance,
          amount: amountInNaira,
          is_plan_deposit: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in verify-paystack-payment:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendDepositPushNotification(
  supabaseUrl: string,
  userId: string,
  amountInNaira: number,
  reference: string,
  isPlanDeposit: boolean,
) {
  try {
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRole) return;

    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_ids: [userId],
        notification_type: 'deposit_received',
        title: isPlanDeposit ? 'Vault funded successfully' : 'Funds received',
        body: `₦${amountInNaira.toLocaleString()} has been added to your ${isPlanDeposit ? 'vault' : 'wallet'}.`,
        data: {
          type: 'deposit_successful',
          amount: amountInNaira,
          reference,
          route: '/(tabs)/',
          action: 'view_balance',
        },
      }),
    });
  } catch (error) {
    console.warn('Failed to send deposit push notification:', error);
  }
}

function generateDepositEmailHtml(data: {
  firstName: string;
  amount: string;
  source: string;
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
            <div class="detail-row"><span class="label">Source:</span><span class="value">${data.source}</span></div>
            <div class="detail-row"><span class="label">Date & Time:</span><span class="value">${data.date}</span></div>
            <div class="detail-row"><span class="label">Reference:</span><span class="value">${data.reference}</span></div>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Your funds are now available in your wallet.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Planmoni</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendDepositEmailNotification(
  supabaseUrl: string,
  userId: string,
  amountInNaira: number,
  reference: string,
  source: string,
) {
  try {
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRole) return;

    const adminSupabase = createClient(supabaseUrl, serviceRole);
    const { data: profile, error } = await adminSupabase
      .from('profiles')
      .select('email, first_name, email_notifications')
      .eq('id', userId)
      .single();

    if (error || !profile?.email) {
      console.warn('Failed to load profile for deposit email:', error);
      return;
    }

    if (profile.email_notifications?.deposit_alerts === false) {
      return;
    }

    const emailHtml = generateDepositEmailHtml({
      firstName: profile.first_name || 'User',
      amount: `₦${amountInNaira.toLocaleString()}`,
      source,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      reference,
    });

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: profile.email,
        subject: 'Funds Received - Planmoni',
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to send deposit email:', response.status, await response.text());
    }
  } catch (error) {
    console.warn('Failed to send deposit email notification:', error);
  }
}

