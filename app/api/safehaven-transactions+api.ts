import { createClient } from '@supabase/supabase-js';
import { safeHavenApiService } from '../../lib/safehaven-api-service';

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

// Verify user authentication
async function verifyAuth(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Get transaction history
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Check if SafeHaven service is configured
    if (!safeHavenApiService.getServiceStatus().isConfigured) {
      return createJsonResponse({ 
        error: 'SafeHaven service not properly configured. Please contact support.',
        details: safeHavenApiService.getServiceStatus()
      }, 500);
    }

    // Parse query parameters
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate required fields
    if (!accountId) {
      return createJsonResponse({ 
        error: 'accountId is required' 
      }, 400);
    }

    // Get transaction history
    const result = await safeHavenApiService.getTransactionHistory(user.id, accountId, {
      startDate,
      endDate,
      limit,
      offset
    });

    if (!result.success) {
      return createJsonResponse({ 
        error: 'Failed to fetch transaction history',
        details: result.error,
        auditLogId: result.auditLogId
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      message: 'Transaction history retrieved successfully',
      data: result.data,
      meta: {
        userId: user.id,
        accountId,
        startDate,
        endDate,
        limit,
        offset,
        count: result.data?.length || 0,
        responseTime: result.responseTime,
        auditLogId: result.auditLogId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching transaction history:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error while fetching transaction history',
      details: errorMessage
    }, 500);
  }
}
