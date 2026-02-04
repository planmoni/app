import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { amount, userId, description } = await req.json()
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!amount || !userId) {
      throw new Error("Missing amount or userId")
    }

    if (!MONO_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Server configuration missing")
    }

    // 1. Get Mandate/Account ID AND Customer ID from Profile
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('mandate_id, mono_customer_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.mandate_id) {
      console.error("Profile Fetch Error or No Mandate:", profileError)
      throw new Error("No saved bank found. Please link your bank again.")
    }

    const savedId = profile.mandate_id
    const customerId = profile.mono_customer_id
    const amountInKobo = Math.round(Number(amount) * 100)
    const shortRef = `tx${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6)}`;

    console.log(`Charging Saved ID ${savedId} for ${amountInKobo} kobo...`)

    // 2. Charge using /v2/payments/initiate
    const response = await fetch('https://api.withmono.com/v2/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
      },
      body: JSON.stringify({
        amount: amountInKobo,
        type: "onetime-debit", 
        description: description || "Planmoni Charge",
        reference: shortRef,
        account: savedId,
        customer: { id: customerId } // Added as required
      }),
    })

    const data = await response.json()

    if (!response.ok) {
       console.error("Mono Charge Error:", data)
       
       const errorMessage = data.message || "Failed to charge saved bank";
       if (errorMessage.toLowerCase().includes("insufficient") || data.code === "INSUFFICIENT_FUNDS") {
          return new Response(
            JSON.stringify({ error: "Insufficient funds in the linked account", code: "INSUFFICIENT_FUNDS" }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
       }
       
       return new Response(
         JSON.stringify({ error: `Charge Failed: ${errorMessage}`, details: data }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       )
    }

    return new Response(
      JSON.stringify({ success: true, transaction: data, message: "Charge Initiated Successfully" }),
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
