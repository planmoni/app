import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, userId } = await req.json()
    
    // 1. THE CRITICAL FIX: Use 'payments/initiate'
    const response = await fetch('https://api.withmono.com/v1/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': Deno.env.get('MONO_SECRET_KEY')!,
      },
      body: JSON.stringify({ 
        code, // The code from the SDK
        type: 'recurring-debit' 
      }),
    })

    const data = await response.json()

    if (!response.ok) {
       console.error("Mono API Error:", data)
       return new Response(
         JSON.stringify({ error: `Mono Auth Failed: ${data.message || 'Unknown'}`, details: data }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    // 2. Save Mandate ID
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ mandate_id: data.id })
      .eq('id', userId)

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, mandate_id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
