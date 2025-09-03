import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Trigger automated payout processing
export async function POST(request: Request) {
  try {
    console.log('[Process Payouts API] Starting automated payout processing');
    
    // Call the Supabase Edge function to process automated payouts
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Process Payouts API] Missing Supabase configuration');
      return createJsonResponse({ 
        error: 'Server configuration error',
        details: 'Missing Supabase URL or service key'
      }, 500);
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/process-automated-payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({})
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('[Process Payouts API] Edge function error:', result);
      return createJsonResponse({ 
        error: 'Failed to process automated payouts',
        details: result.error || 'Unknown error'
      }, response.status);
    }
    
    console.log('[Process Payouts API] Processing completed:', result);
    
    return createJsonResponse({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('[Process Payouts API] Error:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// Schedule automated payouts
export async function PUT(request: Request) {
  try {
    console.log('[Process Payouts API] Starting automated payout scheduling');
    
    // Call the Supabase Edge function to schedule automated payouts
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Process Payouts API] Missing Supabase configuration');
      return createJsonResponse({ 
        error: 'Server configuration error',
        details: 'Missing Supabase URL or service key'
      }, 500);
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/schedule-automated-payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({})
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('[Process Payouts API] Edge function error:', result);
      return createJsonResponse({ 
        error: 'Failed to schedule automated payouts',
        details: result.error || 'Unknown error'
      }, response.status);
    }
    
    console.log('[Process Payouts API] Scheduling completed:', result);
    
    return createJsonResponse({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('[Process Payouts API] Error:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// Get automated payout status
export async function GET(request: Request) {
  try {
    console.log('[Process Payouts API] Getting automated payout status');
    
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const planId = url.searchParams.get('plan_id');
    
    let query = supabase
      .from('automated_payouts')
      .select(`
        *,
        payout_plans (
          name,
          payout_amount
        )
      `)
      .order('scheduled_date', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (planId) {
      query = query.eq('payout_plan_id', planId);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('[Process Payouts API] Error fetching automated payouts:', error);
      return createJsonResponse({ 
        error: 'Failed to fetch automated payouts',
        details: error.message
      }, 500);
    }
    
    return createJsonResponse({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('[Process Payouts API] Error:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}