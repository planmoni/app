import { createClient } from '@supabase/supabase-js';
import { kycAuditService } from '../../lib/kyc-audit-service';

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

// Get audit trail for a user
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Parse query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const operationType = url.searchParams.get('operationType');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // Validate date parameters
    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;

    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return createJsonResponse({ error: 'Invalid startDate format' }, 400);
      }
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return createJsonResponse({ error: 'Invalid endDate format' }, 400);
      }
    }

    // Get audit trail
    const auditTrail = await kycAuditService.getUserAuditTrail({
      userId: user.id,
      startDate: startDateObj,
      endDate: endDateObj,
      operationType: operationType as any,
      limit
    });

    return createJsonResponse({
      status: 'success',
      data: auditTrail,
      meta: {
        userId: user.id,
        startDate: startDateObj?.toISOString(),
        endDate: endDateObj?.toISOString(),
        operationType,
        limit,
        count: auditTrail.length
      }
    });

  } catch (error) {
    console.error('Error getting audit trail:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error while fetching audit trail',
      details: errorMessage
    }, 500);
  }
}

// Generate audit report for a user
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Parse request body
    const { startDate, endDate } = await request.json();

    // Validate required parameters
    if (!startDate || !endDate) {
      return createJsonResponse({ 
        error: 'startDate and endDate are required' 
      }, 400);
    }

    // Parse dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return createJsonResponse({ 
        error: 'Invalid date format' 
      }, 400);
    }

    // Validate date range
    if (startDateObj >= endDateObj) {
      return createJsonResponse({ 
        error: 'startDate must be before endDate' 
      }, 400);
    }

    // Check date range limits (max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (endDateObj.getTime() - startDateObj.getTime() > maxRange) {
      return createJsonResponse({ 
        error: 'Date range cannot exceed 1 year' 
      }, 400);
    }

    // Generate audit report
    const report = await kycAuditService.generateAuditReport(
      user.id,
      startDateObj,
      endDateObj
    );

    return createJsonResponse({
      status: 'success',
      data: report
    });

  } catch (error) {
    console.error('Error generating audit report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error while generating audit report',
      details: errorMessage
    }, 500);
  }
}

// Verify audit trail integrity
export async function PUT(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Parse request body
    const { auditLogId } = await request.json();

    // Validate required parameters
    if (!auditLogId) {
      return createJsonResponse({ 
        error: 'auditLogId is required' 
      }, 400);
    }

    // Verify audit trail integrity
    const isIntegrityValid = await kycAuditService.verifyAuditTrailIntegrity(auditLogId);

    return createJsonResponse({
      status: 'success',
      data: {
        auditLogId,
        integrityValid: isIntegrityValid,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error verifying audit trail integrity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error while verifying audit trail integrity',
      details: errorMessage
    }, 500);
  }
}
