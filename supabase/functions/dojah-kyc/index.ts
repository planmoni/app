import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOJAH_API_URL = 'https://api.dojah.io';
const DOJAH_APP_ID = Deno.env.get('DOJAH_APP_ID');
const DOJAH_PRIVATE_KEY = Deno.env.get('DOJAH_PRIVATE_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if Dojah API keys are available
    if (!DOJAH_APP_ID || !DOJAH_PRIVATE_KEY) {
      console.error('Dojah API keys not configured');
      return new Response(
        JSON.stringify({ 
          error: 'KYC service not properly configured. Please contact support.',
          details: 'Missing Dojah API credentials'
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get verification data from request body
    const { verificationType, verificationData } = await req.json();

    // Validate required fields
    if (!verificationType || !verificationData) {
      return new Response(
        JSON.stringify({ error: 'Missing required verification details' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let endpoint = '';
    let payload = {};

    // Determine which Dojah endpoint to use based on verification type
    switch (verificationType) {
      case 'bvn':
        // If selfie_image is provided, use BVN + selfie verification endpoint
        // This endpoint returns face match results and BVN photo
        if (verificationData.selfie_image) {
          endpoint = '/v1/kyc/bvn/verify';
          payload = { 
            bvn: verificationData.bvn,
            selfie_image: verificationData.selfie_image 
          };
        } else {
          endpoint = '/v1/kyc/bvn/advance';
          payload = { bvn: verificationData.bvn };
        }
        break;
      case 'nin':
        endpoint = '/v1/kyc/nin';
        payload = { nin: verificationData.nin };
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid verification type' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log('Making request to Dojah API:', {
      endpoint,
      url: `${DOJAH_API_URL}${endpoint}`,
      hasAppId: !!DOJAH_APP_ID,
      hasPrivateKey: !!DOJAH_PRIVATE_KEY
    });

    // Make request to Dojah API
    const response = await fetch(`${DOJAH_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppId': DOJAH_APP_ID,
        'Authorization': `${DOJAH_PRIVATE_KEY}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Dojah API response status:', response.status, response.statusText);

    // Safely parse the response
    let data;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('Error parsing Dojah API response:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response from verification service',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the request was successful
    if (!response.ok) {
      console.error('Dojah API error response:', {
        status: response.status,
        statusText: response.statusText,
        data
      });

      return new Response(
        JSON.stringify({ 
          error: data?.message || `Verification service error: ${response.status} ${response.statusText}`,
          details: data
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the verification result
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Dojah KYC function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
