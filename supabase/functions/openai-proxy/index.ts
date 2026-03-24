/**
 * OpenAI API Proxy - Supabase Edge Function
 * 
 * SECURE: Proxies OpenAI API requests from client to OpenAI API
 * Keeps OPENAI_API_KEY server-side only
 * 
 * Usage:
 * POST /functions/v1/openai-proxy
 * Headers: Authorization: Bearer <user_token>
 * Body: { messages: Array, model?: string, temperature?: number, max_tokens?: number }
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

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface OpenAIProxyRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
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
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error - OpenAI API key not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const proxyRequest: OpenAIProxyRequest = await req.json();

    if (!proxyRequest.messages || !Array.isArray(proxyRequest.messages) || proxyRequest.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: messages (array)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set defaults
    const model = proxyRequest.model || 'gpt-3.5-turbo';
    const temperature = proxyRequest.temperature ?? 0.7;
    const max_tokens = proxyRequest.max_tokens ?? 512;

    console.log(`🔄 Proxying OpenAI API request: model=${model}, messages=${proxyRequest.messages.length}`);

    // Make request to OpenAI API
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: proxyRequest.messages,
        temperature,
        max_tokens,
      }),
    });

    // Get response data
    const responseData = await openaiResponse.json().catch(() => ({}));
    const responseStatus = openaiResponse.status;

    console.log(`📡 OpenAI API response: ${responseStatus}`);

    // Return response to client
    return new Response(
      JSON.stringify({
        success: openaiResponse.ok,
        status: responseStatus,
        data: responseData,
      }),
      {
        status: openaiResponse.ok ? 200 : responseStatus,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Error in OpenAI API proxy:', error);
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





