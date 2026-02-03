/**
 * Mono API Proxy - Supabase Edge Function
 * 
 * SECURITY: Proxies Mono API requests from client to Mono API
 * Keeps MONO_SECRET_KEY server-side only
 * 
 * Usage:
 * POST /functions/v1/mono-api-proxy
 * Headers: Authorization: Bearer <user_token>
 * Body: { endpoint: string, method: string, body?: any }
 * 
 * SECURITY FEATURES:
 * - User authentication required
 * - Server-side secret key storage
 * - Endpoint validation (prevents SSRF)
 * - HTTPS-only communication
 * - Request logging for audit
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mono API configuration - LIVE API ONLY
const MONO_API_BASE = 'https://api.withmono.com';
const MONO_SECRET_KEY = Deno.env.get('MONO_SECRET_KEY');

interface MonoProxyRequest {
  endpoint: string; // e.g., '/v2/payments/initiate', '/v2/payments/verify/{reference}'
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // SECURITY: Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Invalid authentication token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check if Mono secret key is configured
    if (!MONO_SECRET_KEY) {
      console.error('❌ MONO_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify we're using LIVE credentials (not test)
    if (!MONO_SECRET_KEY.startsWith('live_sk_')) {
      console.error('❌ Invalid Mono secret key format - must be LIVE key (live_sk_...)');
      return new Response(
        JSON.stringify({ error: 'Server configuration error - Invalid key format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const proxyRequest: MonoProxyRequest = await req.json();

    if (!proxyRequest.endpoint || !proxyRequest.method) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: endpoint, method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate endpoint (prevent SSRF attacks)
    const endpoint = proxyRequest.endpoint.startsWith('/') 
      ? proxyRequest.endpoint 
      : `/${proxyRequest.endpoint}`;
    
    // Only allow Mono API v2 endpoints
    if (!endpoint.startsWith('/v2/')) {
      console.error(`❌ Invalid endpoint - must start with /v2/: ${endpoint}`);
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint - must start with /v2/' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Block dangerous endpoints
    const blockedEndpoints = ['/v2/transactions/credits']; // Example: block direct crediting if applicable
    if (blockedEndpoints.some(blocked => endpoint.includes(blocked))) {
      console.error(`❌ Blocked endpoint access: ${endpoint}`);
      return new Response(
        JSON.stringify({ error: 'Endpoint not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Mono API URL
    const monoUrl = `${MONO_API_BASE}${endpoint}`;

    console.log(`🔄 Proxying Mono API request: ${proxyRequest.method} ${endpoint} for user ${user.id}`);

    // SECURITY: Prepare headers for Mono API (HTTPS-only)
    const monoHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'mono-sec-key': MONO_SECRET_KEY,
      'accept': 'application/json',
    };

    // Make request to Mono API
    const monoResponse = await fetch(monoUrl, {
      method: proxyRequest.method,
      headers: monoHeaders,
      body: proxyRequest.body ? JSON.stringify(proxyRequest.body) : undefined,
    });

    // Get response data
    const responseData = await monoResponse.json().catch(() => ({}));
    const responseStatus = monoResponse.status;

    console.log(`📡 Mono API response: ${responseStatus} for ${endpoint}`);

    // Log errors for monitoring
    if (!monoResponse.ok) {
      console.error(`❌ Mono API error: ${responseStatus}`, responseData);
    }

    // Return response to client
    return new Response(
      JSON.stringify({
        success: monoResponse.ok,
        status: responseStatus,
        data: responseData,
      }),
      {
        status: monoResponse.ok ? 200 : responseStatus,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Error in Mono API proxy:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});



