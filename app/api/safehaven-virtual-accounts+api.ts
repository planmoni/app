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

// Create a virtual account
export async function POST(request: Request) {
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

    // Parse request body
    const virtualAccountData = await request.json();

    // Validate required fields
    if (!virtualAccountData.accountName) {
      return createJsonResponse({ 
        error: 'accountName is required' 
      }, 400);
    }

    // Create the virtual account
    const result = await safeHavenApiService.createVirtualAccount(user.id, virtualAccountData);

    if (!result.success) {
      return createJsonResponse({ 
        error: 'Failed to create virtual account',
        details: result.error,
        auditLogId: result.auditLogId
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      message: 'Virtual account created successfully',
      data: result.data,
      meta: {
        userId: user.id,
        responseTime: result.responseTime,
        auditLogId: result.auditLogId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating virtual account:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error during virtual account creation',
      details: errorMessage
    }, 500);
  }
}

// Get virtual accounts
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
    const virtualAccountId = url.searchParams.get('virtualAccountId');

    let result;

    if (virtualAccountId) {
      // Get specific virtual account details
      result = await safeHavenApiService.getVirtualAccountDetails(user.id, virtualAccountId);
    } else {
      // Get all virtual accounts
      result = await safeHavenApiService.getVirtualAccounts(user.id);
    }

    if (!result.success) {
      return createJsonResponse({ 
        error: 'Failed to fetch virtual accounts',
        details: result.error,
        auditLogId: result.auditLogId
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      message: 'Virtual accounts retrieved successfully',
      data: result.data,
      meta: {
        userId: user.id,
        virtualAccountId,
        responseTime: result.responseTime,
        auditLogId: result.auditLogId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching virtual accounts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error while fetching virtual accounts',
      details: errorMessage
    }, 500);
  }
}

// Update virtual account status
export async function PUT(request: Request) {
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

    // Parse request body
    const { virtualAccountId, status } = await request.json();

    // Validate required fields
    if (!virtualAccountId || !status) {
      return createJsonResponse({ 
        error: 'virtualAccountId and status are required' 
      }, 400);
    }

    // Validate status
    const validStatuses = ['Active', 'Inactive', 'Suspended'];
    if (!validStatuses.includes(status)) {
      return createJsonResponse({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, 400);
    }

    // Update virtual account status
    const result = await safeHavenApiService.updateVirtualAccountStatus(user.id, virtualAccountId, status);

    if (!result.success) {
      return createJsonResponse({ 
        error: 'Failed to update virtual account status',
        details: result.error,
        auditLogId: result.auditLogId
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      message: 'Virtual account status updated successfully',
      data: result.data,
      meta: {
        userId: user.id,
        virtualAccountId,
        newStatus: status,
        responseTime: result.responseTime,
        auditLogId: result.auditLogId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error updating virtual account status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error during virtual account status update',
      details: errorMessage
    }, 500);
  }
}
