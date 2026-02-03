import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId, email, name, amount } = await req.json()
    const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!userId) throw new Error("Missing userId")

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    // 1. Get Profile & KYC Data
    const { data: profile } = await supabase
      .from('profiles')
      .select('mono_customer_id, phone, address')
      .eq('id', userId)
      .single()

    const { data: kyc } = await supabase
      .from('kyc_data')
      .select('bvn')
      .eq('user_id', userId)
      .single()

    let customerId = profile?.mono_customer_id
    const userPhone = profile?.phone || "08012345678"; 
    const userAddress = profile?.address || "Lagos, Nigeria"; 
    const userBvn = kyc?.bvn; // Get BVN from KYC Data

    // 2. Create/Resolve Customer
    if (!customerId) {
        console.log(`Creating/Resolving Customer for ${email}...`);
        
        const customerPayload: any = {
            email, 
            first_name: name.split(' ')[0], 
            last_name: name.split(' ').slice(1).join(' ') || 'User',
            phone: userPhone,
            address: userAddress,
            type: 'individual'
        };

        // Add Identity (BVN) if available - Recommended for Mandates
        if (userBvn) {
            customerPayload.identity = {
                type: "bvn",
                number: userBvn
            };
        }

        // Try V2 Create
        const v2Res = await fetch('https://api.withmono.com/v2/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! },
            body: JSON.stringify(customerPayload)
        });
        
        const v2Data = await v2Res.json();
        
        if (v2Data.status === "successful" || v2Data.id) {
            customerId = v2Data.id || v2Data.data?.id;
            await supabase.from('profiles').update({ mono_customer_id: customerId }).eq('id', userId);
        } else {
            // Error handling: If "Already Exists", try V1 Lookup
            const errorMsg = v2Data.message || "";
            if (errorMsg.includes("exists")) {
                console.log("Customer exists. Retrieving ID via V1...");
                // Remove identity to avoid conflict during lookup
                delete customerPayload.identity; 
                // V1 payload keys
                const v1Payload = { email, name, phone: userPhone, address: userAddress };

                const v1Res = await fetch('https://api.withmono.com/v1/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! },
                    body: JSON.stringify(v1Payload)
                });
                const v1Data = await v1Res.json();
                
                if (v1Data.status === "successful" || v1Data.id) {
                    customerId = v1Data.id || v1Data.data?.id;
                    await supabase.from('profiles').update({ mono_customer_id: customerId }).eq('id', userId);
                } else {
                    throw new Error(`Customer Resolution Failed: ${v2Data.message || JSON.stringify(v2Data)}`);
                }
            } else {
                throw new Error(`Customer Creation Failed: ${errorMsg}`);
            }
        }
    }

    // 3. Initiate Mandate
    if (!customerId) throw new Error("Failed to resolve Mono Customer ID");

    const startDate = new Date().toISOString().split('T')[0] 
    const endDateObj = new Date();
    endDateObj.setFullYear(endDateObj.getFullYear() + 5); 
    const endDate = endDateObj.toISOString().split('T')[0];
    const limitAmount = amount ? Math.round(Number(amount) * 100) : 50000000; 

    const payload = {
      amount: limitAmount, 
      type: "recurring-debit",
      method: "mandate",
      mandate_type: "emandate",
      debit_type: "variable",
      description: "Planmoni Wallet Funding",
      reference: `m${userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}${Date.now()}`,
      redirect_url: "myapp://mandate-approved", 
      customer: { id: customerId },
      start_date: startDate,
      end_date: endDate,
      meta: { user_id: userId }
    }

    console.log("Initiating Mandate Request...");
    const response = await fetch('https://api.withmono.com/v2/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
       return new Response(
         JSON.stringify({ error: `Mono Mandate Failed: ${data.message || 'Unknown error'}` }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    const result = data.data 
    await supabase.from('profiles').update({ mandate_id: result.mandate_id }).eq('id', userId)

    return new Response(
      JSON.stringify({ success: true, mono_url: result.mono_url, mandate_id: result.mandate_id }),
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
