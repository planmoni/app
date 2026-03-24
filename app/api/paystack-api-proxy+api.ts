/**
 * Paystack API Proxy - Server-Side API Route
 * 
 * SECURE: Proxies Paystack API requests from client to Paystack API
 * Keeps PAYSTACK_LIVE_SECRET_KEY server-side only
 * 
 * Usage:
 * POST /api/paystack-api-proxy
 * Headers: Authorization: Bearer <user_token>
 * Body: { endpoint: string, method: string, body?: any }
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Paystack API configuration
const PAYSTACK_API_BASE = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_LIVE_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;

interface PaystackProxyRequest {
  endpoint: string; // e.g., '/transaction', '/transaction/verify/{reference}', '/transaction/initialize'
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifyAuth(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized - Missing or invalid authorization header', user: null };
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Unauthorized - Invalid token', user: null };
  }

  return { error: null, user };
}

export async function POST(request: Request) {
  try {
    // Verify user authentication
    const { error: authError, user } = await verifyAuth(request);
    if (authError || !user) {
      return createJsonResponse({ error: authError }, 401);
    }

    // Check if Paystack secret key is configured
    if (!PAYSTACK_SECRET_KEY) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      return createJsonResponse({ error: 'Server configuration error' }, 500);
    }

    // Parse request body
    const proxyRequest: PaystackProxyRequest = await request.json();

    if (!proxyRequest.endpoint || !proxyRequest.method) {
      return createJsonResponse(
        { error: 'Missing required fields: endpoint, method' },
        400
      );
    }

    // Validate endpoint (prevent SSRF attacks)
    const endpoint = proxyRequest.endpoint.startsWith('/')
      ? proxyRequest.endpoint
      : `/${proxyRequest.endpoint}`;

    if (!endpoint.startsWith('/transaction') && !endpoint.startsWith('/bank') && !endpoint.startsWith('/transfer')) {
      return createJsonResponse(
        { error: 'Invalid endpoint - must start with /transaction, /bank, or /transfer' },
        400
      );
    }

    // Build Paystack API URL
    const paystackUrl = `${PAYSTACK_API_BASE}${endpoint}`;

    console.log(`🔄 Proxying Paystack API request: ${proxyRequest.method} ${endpoint}`);

    // Prepare headers for Paystack API
    const paystackHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    };

    // Make request to Paystack API
    const paystackResponse = await fetch(paystackUrl, {
      method: proxyRequest.method,
      headers: paystackHeaders,
      body: proxyRequest.body ? JSON.stringify(proxyRequest.body) : undefined,
    });

    // Get response data
    const responseData = await paystackResponse.json().catch(() => ({}));
    const responseStatus = paystackResponse.status;

    console.log(`📡 Paystack API response: ${responseStatus}`);

    // Return response to client
    return createJsonResponse({
      success: paystackResponse.ok,
      status: responseStatus,
      data: responseData,
    }, paystackResponse.ok ? 200 : responseStatus);

  } catch (error) {
    console.error('❌ Error in Paystack API proxy:', error);
    return createJsonResponse({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}





