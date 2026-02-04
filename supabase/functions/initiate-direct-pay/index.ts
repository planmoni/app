import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { amount, email, name, description } = await req.json()
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')

    if (!amount || !email || !name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: amount, email, or name" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate unique reference
    const reference = `planmoni_direct_${crypto.randomUUID().replace(/-/g, '')}`.substring(0, 24); // Ensure < 24 chars if possible, randomUUID is long so we trim or simple timestamp
    // Actually UUID is 36 chars. "planmoni_direct_" is 16. Total 52. Too long for Mono's strict < 24 checks sometimes?
    // Let's use a shorter ref logic:
    const shortRef = `pm_direct_${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;

    const amountInKobo = Math.round(Number(amount) * 100);

    const payload = {
      amount: amountInKobo,
      type: 'onetime-debit',
      description: description || "Planmoni Quick Deposit",
      reference: shortRef,
      redirect_url: 'planmoni://payment-return', // Deep link
      customer: {
        email: email,
        name: name
      }
    };

    console.log("Initiating Direct Pay:", JSON.stringify(payload));

    const response = await fetch('https://api.withmono.com/v2/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY!,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
       console.error("Mono Direct Pay Error:", data);
       return new Response(
         JSON.stringify({ error: `Mono Error: ${data.message}`, details: data }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    return new Response(
      JSON.stringify({ 
        payment_link: data.data.mono_url || data.data.payment_link, // Handle both potential response fields
        reference: shortRef 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Function Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
