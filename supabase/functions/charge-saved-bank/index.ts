import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    // 1. Get Mandate ID from Profile
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('mandate_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.mandate_id) {
      console.error("Profile Fetch Error or No Mandate:", profileError)
      throw new Error("No saved bank found. Please link your bank again.")
    }

    const mandateId = profile.mandate_id
    const amountInKobo = Math.round(Number(amount) * 100)
    // CRITICAL: Reference must be alphanumeric for Mono V2
    const reference = `charge${userId.replace(/[^a-zA-Z0-9]/g, '')}${Date.now()}`

    console.log(`Charging mandate ${mandateId} for ${amountInKobo} kobo...`)

    // 2. Charge the Mandate
    const response = await fetch(`https://api.withmono.com/v3/payments/mandates/${mandateId}/debit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY,
      },
      body: JSON.stringify({
        amount: amountInKobo,
        description: description || "Planmoni Saved Bank Charge",
        reference: reference
      }),
    })

    const data = await response.json()

    if (!response.ok) {
       console.error("Mono Charge Error:", data)
       
       // Handle specific errors
       const errorMessage = data.message?.toLowerCase() || "";
       if (errorMessage.includes("insufficient") || data.code === "INSUFFICIENT_FUNDS") {
          throw new Error("Insufficient funds in the linked account")
       }
       
       throw new Error(data.message || "Failed to charge saved bank")
    }

    return new Response(
      JSON.stringify({ success: true, transaction: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Function Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
