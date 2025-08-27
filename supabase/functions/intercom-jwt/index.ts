import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the user from the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Your Intercom API Secret from Messenger Security settings
    const INTERCOM_SECRET = Deno.env.get('INTERCOM_SECRET')
    console.log('INTERCOM_SECRET', INTERCOM_SECRET);

    if (!INTERCOM_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Intercom secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user name from metadata
    const firstName = user.user_metadata?.first_name || '';
    const lastName = user.user_metadata?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // Create JWT payload as per Intercom documentation
    const payload = {
      user_id: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
      name: fullName || user.email?.split('@')[0] || 'User',
      created_at: Math.floor(Date.now() / 1000),
      // Add any custom attributes you want to secure
      custom_attribute: 'value'
    }

    // Generate JWT using HMAC-SHA256 (HS256 algorithm)
    // Note: In Deno, we need to use the Web Crypto API
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(INTERCOM_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Create the JWT header and payload
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = btoa(JSON.stringify(header))
    const encodedPayload = btoa(JSON.stringify(payload))
    
    // Create the signature
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`)
    const signature = await crypto.subtle.sign('HMAC', key, data)
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))

    const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`

    return new Response(
      JSON.stringify({ jwt: token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating Intercom JWT:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate JWT' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
