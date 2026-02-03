import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, description, userId, accountId } = await req.json()
    
    // Validate inputs
    if (!amount || !userId) {
       throw new Error("Missing required fields: amount or userId");
    }

    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    if (!MONO_SECRET_KEY) {
      throw new Error("MONO_SECRET_KEY not set")
    }

    // Prepare payload for Mono Initiate
    const amountInKobo = Math.round(Number(amount) * 100);

    const payload: any = {
      amount: amountInKobo,
      type: "onetime-debit", 
      description: description || "Planmoni Wallet Funding",
      reference: `planmoni_${userId}_${Date.now()}`,
    }

    // If we have a specific Mono account ID, pre-select it
    if (accountId) {
      payload.account = accountId;
    }

    console.log("Initiating Mono Payment:", payload);

    const response = await fetch('https://api.withmono.com/v2/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
       console.error("Mono API Error:", data);
       throw new Error(data.message || "Failed to initiate payment with Mono");
    }

    return new Response(
      JSON.stringify({ payment_link: data.payment_link, reference: payload.reference }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
