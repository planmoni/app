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
    const { reference } = await req.json()
    
    if (!reference) {
       return new Response(
         JSON.stringify({ error: "Missing required field: reference" }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    if (!MONO_SECRET_KEY) {
      throw new Error("Server configuration error: MONO_SECRET_KEY not set")
    }

    console.log("Verifying Mono Reference:", reference);

    const response = await fetch('https://api.withmono.com/v2/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
      },
      body: JSON.stringify({ reference }),
    })

    const data = await response.json()

    if (!response.ok) {
       console.error("Mono Verification Error:", data);
       return new Response(
         JSON.stringify({ 
           error: data.message || "Verification Failed",
           details: data 
         }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    // Check strict status
    // Mono returns { status: "successful", data: { ... } }
    if (data.status !== "successful" || data.data.status !== "successful") {
        return new Response(
            JSON.stringify({ 
              verified: false,
              message: "Transaction not successful",
              status: data.data?.status || data.status
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ 
        verified: true,
        amount: data.data.amount, // Amount is in kobo
        reference: data.data.reference,
        status: data.data.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Function Internal Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
