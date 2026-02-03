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
    // 1. Parse Request
    const { amount, email, userId, description, name } = await req.json()
    
    if (!amount || !userId) {
       return new Response(
         JSON.stringify({ error: "Missing required fields: amount or userId" }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    // 2. Check Secret
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    if (!MONO_SECRET_KEY) {
      console.error("MONO_SECRET_KEY is missing from env");
      return new Response(
        JSON.stringify({ error: "Server configuration error: MONO_SECRET_KEY not set" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Prepare Payload
    const amountInKobo = Math.round(Number(amount) * 100);
    const payload = {
      amount: amountInKobo,
      type: "onetime-debit", 
      description: description || "Planmoni Deposit",
      // CRITICAL: Reference must be alphanumeric for Mono V2
      reference: `planmoni${userId.replace(/[^a-zA-Z0-9]/g, '')}${Date.now()}`,
      redirect_url: "myapp://deposit-flow/success", // Redirect back to app
      customer: {
        email: email || `user_${userId}@planmoni.com`,
        name: name || "Planmoni User"
      }
    }

    console.log("Sending to Mono:", JSON.stringify(payload));

    // 4. Call Mono API
    const response = await fetch('https://api.withmono.com/v2/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
      },
      body: JSON.stringify(payload),
    })

    const responseData = await response.json()

    // 5. Handle Mono Response
    if (!response.ok) {
       console.error("Mono API Error Response:", responseData);
       return new Response(
         JSON.stringify({ 
           error: responseData.message || "Mono API Request Failed",
           details: responseData 
         }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    // Mono response structure usually: { status: "successful", data: { mono_url: "..." } }
    // Based on user provided sample, the field is 'mono_url', not 'payment_link'
    const link = responseData.mono_url || responseData?.data?.mono_url || responseData.payment_link || responseData?.data?.payment_link;

    if (!link) {
      console.error("Mono Response missing link:", responseData);
      return new Response(
         JSON.stringify({ 
           error: "Mono API returned success but no payment link found.",
           details: responseData 
         }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    return new Response(
      JSON.stringify({ 
        payment_link: link, 
        reference: payload.reference 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Function Internal Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})