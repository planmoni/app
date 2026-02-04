import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId, email, name } = await req.json()
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!userId) throw new Error("Missing userId")

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    // 1. Get Profile & KYC
    const { data: profile } = await supabase
      .from('profiles')
      .select('mono_customer_id') 
      .eq('id', userId)
      .single()

    const { data: kyc } = await supabase
      .from('kyc_data')
      .select('bvn, phone_number, address')
      .eq('user_id', userId)
      .single()

    let customerId = profile?.mono_customer_id
    const userPhone = kyc?.phone_number || "08012345678"; 
    const userAddress = kyc?.address || "Lagos, Nigeria"; 
    const userBvn = kyc?.bvn;

    // 2. Resolve Customer ID (STRICT V2)
    if (!customerId) {
        console.log(`[DEBUG] Creating Customer V2 for ${email}...`);
        
        const v2Payload: any = {
            email, 
            first_name: name.split(' ')[0], 
            last_name: name.split(' ').slice(1).join(' ') || 'User',
            phone: userPhone,
            address: userAddress,
            type: 'individual'
        };
        if (userBvn) v2Payload.identity = { type: "bvn", number: userBvn };

        const v2Res = await fetch('https://api.withmono.com/v2/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! },
            body: JSON.stringify(v2Payload)
        });
        
        const v2Data = await v2Res.json();
        
        if (v2Res.ok && (v2Data.status === "successful" || v2Data.id)) {
            customerId = v2Data.id || v2Data.data?.id;
            await supabase.from('profiles').update({ mono_customer_id: customerId }).eq('id', userId);
        } else {
            // Self-Heal from conflict error (V2 behavior)
            const existingId = v2Data.data?.existing_customer?.id;
            if (existingId) {
                customerId = existingId;
                await supabase.from('profiles').update({ mono_customer_id: customerId }).eq('id', userId);
            } else {
                throw new Error(`V2 Customer Creation Failed: ${v2Data.message}`);
            }
        }
    }

    // 3. Patch Identity (STRICT V2)
    if (customerId) {
        console.log(`[DEBUG] Patching Customer V2: ${customerId}`);
        await fetch(`https://api.withmono.com/v2/customers/${customerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! },
            body: JSON.stringify({ phone: userPhone, address: userAddress })
        });
    }

    return new Response(
      JSON.stringify({ success: true, customer_id: customerId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[ERROR] V2 Function Exception:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
