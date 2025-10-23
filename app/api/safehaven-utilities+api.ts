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

// Get bank list
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
    const operation = url.searchParams.get('operation');

    let result;

    switch (operation) {
      case 'banks':
        result = await safeHavenApiService.getBankList(user.id);
        break;
      default:
        return createJsonResponse({ 
          error: 'Invalid operation. Supported operations: banks' 
        }, 400);
    }

    if (!result.success) {
      return createJsonResponse({ 
        error: `Failed to fetch ${operation}`,
        details: result.error,
        auditLogId: result.auditLogId
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      message: `${operation} retrieved successfully`,
      data: result.data,
      meta: {
        userId: user.id,
        operation,
        responseTime: result.responseTime,
        auditLogId: result.auditLogId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching utilities:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error while fetching utilities',
      details: errorMessage
    }, 500);
  }
}

// Name enquiry and transaction fees
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
    const requestData = await request.json();
    const { operation } = requestData;

    let result;

    switch (operation) {
      case 'nameEnquiry':
        const { accountNumber, bankCode } = requestData;
        if (!accountNumber || !bankCode) {
          return createJsonResponse({ 
            error: 'accountNumber and bankCode are required for name enquiry' 
          }, 400);
        }
        result = await safeHavenApiService.getNameEnquiry(user.id, accountNumber, bankCode);
        break;

      case 'transactionFees':
        const { amount, transactionType } = requestData;
        if (!amount || !transactionType) {
          return createJsonResponse({ 
            error: 'amount and transactionType are required for transaction fees' 
          }, 400);
        }
        if (amount <= 0) {
          return createJsonResponse({ 
            error: 'amount must be greater than 0' 
          }, 400);
        }
        result = await safeHavenApiService.getTransactionFees(user.id, amount, transactionType);
        break;

      default:
        return createJsonResponse({ 
          error: 'Invalid operation. Supported operations: nameEnquiry, transactionFees' 
        }, 400);
    }

    if (!result.success) {
      return createJsonResponse({ 
        error: `Failed to process ${operation}`,
        details: result.error,
        auditLogId: result.auditLogId
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      message: `${operation} processed successfully`,
      data: result.data,
      meta: {
        userId: user.id,
        operation,
        responseTime: result.responseTime,
        auditLogId: result.auditLogId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error processing utility operation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({ 
      error: 'Internal server error during utility operation',
      details: errorMessage
    }, 500);
  }
}
