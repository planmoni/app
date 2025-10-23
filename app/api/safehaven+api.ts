import { createClient } from '@supabase/supabase-js';
import { safeHavenService } from '../../lib/safehaven-service';

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

// Refresh SafeHaven token
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Check if SafeHaven service is configured
    if (!safeHavenService.isConfigured()) {
      return createJsonResponse({ 
        error: 'SafeHaven service not properly configured. Please contact support.',
        details: safeHavenService.getConfigurationStatus()
      }, 500);
    }

    // Parse request body
    const { refresh_token, fetch_accounts = true } = await request.json();

    if (!refresh_token) {
      return createJsonResponse({ 
        error: 'refresh_token is required' 
      }, 400);
    }

    // Refresh the token
    const result = await safeHavenService.refreshToken(user.id, refresh_token);

    if (!result.success) {
      return createJsonResponse({ 
        error: 'Failed to refresh SafeHaven token',
        details: result.error,
        auditLogId: result.auditLogId
      }, 500);
    }

    let accountsData = null;
    if (fetch_accounts) {
      // Fetch accounts using the new token
      const accountsResult = await safeHavenService.fetchAccounts(user.id);
      if (accountsResult.success) {
        accountsData = accountsResult.data;
      }
    }

    // Return success response
    return createJsonResponse({
      status: 'success',
      message: 'SafeHaven token refreshed successfully',
      data: {
        token: {
          access_token: result.data.access_token,
          token_type: result.data.token_type,
          expires_in: result.data.expires_in,
          expires_at: new Date(Date.now() + (result.data.expires_in * 1000)).toISOString(),
          ibs_client_id: result.data.ibs_client_id,
          ibs_user_id: result.data.ibs_user_id
        },
        accounts: accountsData ? accountsData.map((account: any) => ({
          id: account._id,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
          accountType: account.accountType,
          currencyCode: account.currencyCode,
          accountBalance: account.accountBalance,
          bookBalance: account.bookBalance,
          status: account.status,
          isDefault: account.isDefault,
          canDebit: account.canDebit,
          canCredit: account.canCredit
        })) : null
      },
      meta: {
        userId: user.id,
        responseTime: result.responseTime,
        auditLogId: result.auditLogId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in SafeHaven token refresh:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error during SafeHaven token refresh',
      details: errorMessage
    }, 500);
  }
}

// Get SafeHaven accounts
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Check if SafeHaven service is configured
    if (!safeHavenService.isConfigured()) {
      return createJsonResponse({ 
        error: 'SafeHaven service not properly configured. Please contact support.',
        details: safeHavenService.getConfigurationStatus()
      }, 500);
    }

    // Parse query parameters
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === 'true';
    const includeSummary = url.searchParams.get('includeSummary') === 'true';

    let accountsData = null;
    let summaryData = null;

    if (refresh) {
      // Fetch fresh data from SafeHaven API
      const result = await safeHavenService.fetchAccounts(user.id);
      if (result.success) {
        accountsData = result.data;
      } else {
        return createJsonResponse({ 
          error: 'Failed to fetch accounts from SafeHaven',
          details: result.error,
          auditLogId: result.auditLogId
        }, 500);
      }
    } else {
      // Get cached data from database
      accountsData = await safeHavenService.getUserAccounts(user.id);
    }

    if (includeSummary) {
      summaryData = await safeHavenService.getAccountSummary(user.id);
    }

    return createJsonResponse({
      status: 'success',
      message: 'SafeHaven accounts retrieved successfully',
      data: {
        accounts: accountsData,
        summary: summaryData
      },
      meta: {
        userId: user.id,
        refreshed: refresh,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting SafeHaven accounts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error while fetching SafeHaven accounts',
      details: errorMessage
    }, 500);
  }
}

// Get SafeHaven audit logs
export async function PUT(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Parse request body
    const { operationType, limit = 50 } = await request.json();

    // Get audit logs
    const auditLogs = await safeHavenService.getAuditLogs(user.id, operationType, limit);

    return createJsonResponse({
      status: 'success',
      message: 'SafeHaven audit logs retrieved successfully',
      data: auditLogs,
      meta: {
        userId: user.id,
        operationType,
        limit,
        count: auditLogs.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting SafeHaven audit logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error while fetching SafeHaven audit logs',
      details: errorMessage
    }, 500);
  }
}
