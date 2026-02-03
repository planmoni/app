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
    
    // 1. Fetch Profile & KYC Data
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
    const userBvn = kyc?.bvn;

    // 2. Resolve Customer ID
    if (!customerId) {
        console.log(`Resolving Customer for ${email}...`);
        
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
        } else {
            // Extract existing ID from conflict error
            const existingId = v2Data.data?.existing_customer?.id;
            if (existingId) {
                customerId = existingId;
            } else {
                return new Response(
                    JSON.stringify({ error: `Customer Creation Failed: ${v2Data.message}`, details: v2Data }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        if (customerId) {
            await supabase.from('profiles').update({ mono_customer_id: customerId }).eq('id', userId);
        }
    }

    // 3. Ensure Identity Readiness
    if (customerId) {
        console.log(`Checking readiness for ${customerId}...`);
        const getRes = await fetch(`https://api.withmono.com/v2/customers/${customerId}`, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! }
        });

        if (getRes.ok) {
            const getData = await getRes.json();
            const customer = getData.data;
            if (!customer.phone || !customer.address) {
                console.log("Patching missing info...");
                await fetch(`https://api.withmono.com/v2/customers/${customerId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! },
                    body: JSON.stringify({ phone: userPhone, address: userAddress })
                });
            }
        }
    }

    if (!customerId) throw new Error("Failed to resolve Mono Customer ID");

    // 4. Initiate Mandate V2
    // START DATE: TOMORROW as requested
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDate = tomorrow.toISOString().split('T')[0];

    const endDateObj = new Date();
    endDateObj.setFullYear(endDateObj.getFullYear() + 10); 
    const endDate = endDateObj.toISOString().split('T')[0];
    const limitAmount = amount ? Math.round(Number(amount) * 100) : 50000000; 

    const payload = {
      amount: limitAmount, 
      type: "recurring-debit",
      method: "mandate",
      mandate_type: "emandate",
      debit_type: "variable",
      description: "Planmoni Salary Savings",
      reference: `m${userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}${Date.now()}`,
      // Use Proxy Function to handle Deep Link redirect safely
      redirect_url: "https://rqmpnoaavyizlwzfngpr.supabase.co/functions/v1/mono-redirect", 
      customer: { id: customerId },
      start_date: startDate,
      end_date: endDate
    }

    console.log("Initiating Mandate Request...");
    const response = await fetch('https://api.withmono.com/v2/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'mono-sec-key': MONO_SECRET_KEY! },
      body: JSON.stringify(payload),
    })

    const mandateData = await response.json()

    if (!response.ok) {
       console.error("Mono Mandate Error:", mandateData);
       return new Response(
         JSON.stringify({ error: `Mono Mandate Failed: ${mandateData.message || 'Unknown error'}`, details: mandateData }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    const result = mandateData.data 
    await supabase.from('profiles').update({ mandate_id: result.mandate_id }).eq('id', userId)

    return new Response(
      JSON.stringify({ success: true, mono_url: result.mono_url, mandate_id: result.mandate_id, reference: payload.reference }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Function Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})