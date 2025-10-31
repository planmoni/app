import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert base64 to base64url (required for JWT)
function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper function to convert ArrayBuffer to base64url
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64urlEncode(binary);
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔐 Intercom JWT function called');

    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user from the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('❌ User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Get Intercom API Secret from environment
    const INTERCOM_SECRET = Deno.env.get('INTERCOM_SECRET');

    if (!INTERCOM_SECRET) {
      console.error('❌ Intercom secret not configured');
      return new Response(
        JSON.stringify({ error: 'Intercom secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Intercom secret found');

    // Get user name from metadata
    const firstName = user.user_metadata?.first_name || '';
    const lastName = user.user_metadata?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    console.log('👤 User data:', {
      userId: user.id,
      email: user.email,
      firstName,
      lastName,
      fullName
    });

    // Create JWT payload as per Intercom documentation
    const payload = {
      user_id: user.id,                    // Required
      email: user.email,                   // Optional
      name: fullName || user.email?.split('@')[0] || 'User', // Optional
      // Add any sensitive attributes you want to secure
      first_name: firstName,
      last_name: lastName,
      user_type: 'customer',
      app_version: '1.0.0'
    };

    console.log('🔐 JWT payload created:', payload);

    // Generate JWT using HMAC-SHA256 (HS256 algorithm)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(INTERCOM_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    console.log('🔐 JWT key imported');

    // Create the JWT header and payload
    const header = { alg: 'HS256', typ: 'JWT' };

    // Encode header and payload using base64url (required for JWT)
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(payload));

    console.log('🔐 Encoded Header:', encodedHeader);
    console.log('🔐 Encoded Payload:', encodedPayload);

    // Create the signature
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const encodedSignature = arrayBufferToBase64url(signature);

    console.log('🔐 Encoded Signature:', encodedSignature);

    const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

    console.log('✅ JWT generated successfully, length:', token.length);
    console.log('🔍 Full JWT Token:', token);

    // Verify the JWT structure
    const parts = token.split('.');
    console.log('🔍 JWT Parts:', {
      header: parts[0],
      payload: parts[1],
      signature: parts[2],
      totalParts: parts.length
    });

    return new Response(
      JSON.stringify({ jwt: token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error generating Intercom JWT:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate JWT' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});