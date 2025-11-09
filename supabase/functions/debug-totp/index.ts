import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user profile to check TOTP status
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, two_factor_enabled, totp_enabled, totp_secret, two_factor_method')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return new Response(JSON.stringify({ 
        error: 'Profile error', 
        details: profileError.message 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return debug information
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      profile: {
        id: profile.id,
        two_factor_enabled: profile.two_factor_enabled,
        totp_enabled: profile.totp_enabled,
        has_totp_secret: !!profile.totp_secret,
        two_factor_method: profile.two_factor_method
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
