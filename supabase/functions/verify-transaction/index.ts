import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { reference } = await req.json()
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing reference" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Verifying Transaction: ${reference}`);

    // Call Mono Verify Transaction Endpoint
    // Note: Documentation says GET /v2/transactions/verify/{reference}
    const response = await fetch(`https://api.withmono.com/v2/transactions/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY!,
      },
    })

    const data = await response.json()

    if (!response.ok) {
        console.warn("Transaction Verify failed, trying Payment Verify fallback...");
        // Fallback to payments/verify which checks the initiation status
        const paymentRes = await fetch(`https://api.withmono.com/v2/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'mono-sec-key': MONO_SECRET_KEY!,
            },
            body: JSON.stringify({ reference })
        });
        const paymentData = await paymentRes.json();
        
        if (paymentRes.ok) {
             return new Response(
                JSON.stringify({ success: true, data: paymentData.data }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

       return new Response(
         JSON.stringify({ error: `Verification Failed: ${data.message}`, details: data }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    return new Response(
      JSON.stringify({ success: true, data: data.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
