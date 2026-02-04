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
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!code || !userId) throw new Error("Missing code or userId")

    console.log(`[DEBUG] Exchanging V2 Code for user ${userId}...`)

    // Strictly V2 Account Auth
    const v2Res = await fetch('https://api.withmono.com/v2/accounts/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': MONO_SECRET_KEY!,
      },
      body: JSON.stringify({ code }),
    })

    const data = await v2Res.json()

    if (!v2Res.ok) {
       console.error("[ERROR] V2 Auth Failed:", data)
       return new Response(
         JSON.stringify({ error: `V2 Mono Auth Failed: ${data.message || 'Not Found'}`, details: data }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    const accountId = data.id || data.data?.id;

    if (!accountId) throw new Error("No Account ID returned from Mono V2");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    await supabase.from('profiles').update({ mandate_id: accountId }).eq('id', userId)

    return new Response(
      JSON.stringify({ success: true, mandate_id: accountId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[ERROR] V2 Exchange Exception:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})