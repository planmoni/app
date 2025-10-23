import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safehavenApiService } from '../../lib/safehaven-api-service';
import { kycAuditService } from '../../lib/kyc-audit-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to verify authentication
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  return user;
}

// Helper function to create JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Helper function to get client info
function getClientInfo(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  };
}

/**
 * POST /api/safehaven-subaccounts - Initiate subaccount creation
 */
export async function POST(request: NextRequest) {
  let auditLogId: string | null = null;
  let user: any = null;
  const startTime = Date.now();

  try {
    // Verify authentication
    user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const clientInfo = getClientInfo(request);
    const body = await request.json();
    const { accountName, accountType, currencyCode, description, phoneNumber, email } = body;

    // Validate required fields
    if (!accountName || !accountType) {
      return createJsonResponse({ 
        error: 'Missing required fields: accountName and accountType are required' 
      }, 400);
    }

    // Create initial audit log entry
    auditLogId = await kycAuditService.logKYCOperation(
      user.id,
      'subaccount_creation_initiated',
      {
        verificationType: 'subaccount_creation',
        verificationProvider: 'safehaven',
        requestData: {
          accountName,
          accountType,
          currencyCode: currencyCode || 'NGN',
          description,
          phoneNumber: phoneNumber ? '***' + phoneNumber.slice(-4) : undefined,
          email: email ? email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        metadata: {
          endpoint: 'POST /api/safehaven-subaccounts',
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      }
    );

    // Initiate subaccount creation
    const result = await safehavenApiService.initiateSubaccountCreation(user.id, {
      accountName,
      accountType,
      currencyCode,
      description,
      phoneNumber,
      email
    });

    if (!result.success) {
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        result.error || 'Subaccount creation initiation failed'
      );

      return createJsonResponse({ 
        error: result.error || 'Failed to initiate subaccount creation' 
      }, 500);
    }

    // Store subaccount session in database
    const { data: subaccountData, error: dbError } = await supabase
      .from('safehaven_subaccounts')
      .insert({
        user_id: user.id,
        safehaven_subaccount_id: result.data?.sessionId || `temp_${Date.now()}`,
        client_id: 'd65602ee6533363bfb2e0bc664a76ef3',
        session_id: result.data?.sessionId,
        account_name: accountName,
        account_type: accountType,
        currency_code: currencyCode || 'NGN',
        description,
        phone_number: phoneNumber,
        email,
        status: 'Pending',
        otp_required: result.data?.otpRequired || false,
        metadata: {
          creation_initiated_at: new Date().toISOString(),
          safehaven_response: result.data
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error storing subaccount:', dbError);
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        `Database error: ${dbError.message}`
      );

      return createJsonResponse({ 
        error: 'Failed to store subaccount session' 
      }, 500);
    }

    // Update audit log with success
    await kycAuditService.updateAuditLogStatus(
      auditLogId,
      'completed',
      undefined,
      undefined,
      {
        subaccountId: subaccountData.id,
        sessionId: result.data?.sessionId,
        otpRequired: result.data?.otpRequired,
        responseTime: Date.now() - startTime
      }
    );

    return createJsonResponse({
      success: true,
      data: {
        subaccountId: subaccountData.id,
        sessionId: result.data?.sessionId,
        otpRequired: result.data?.otpRequired,
        message: result.data?.otpRequired ? 
          'Subaccount creation initiated. OTP verification required.' : 
          'Subaccount creation initiated successfully.'
      }
    });

  } catch (error) {
    console.error('Subaccount creation initiation error:', error);
    
    if (auditLogId) {
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }

    return createJsonResponse({ 
      error: 'Internal server error during subaccount creation initiation' 
    }, 500);
  }
}

/**
 * PUT /api/safehaven-subaccounts - Verify OTP and complete subaccount creation
 */
export async function PUT(request: NextRequest) {
  let auditLogId: string | null = null;
  let user: any = null;
  const startTime = Date.now();

  try {
    // Verify authentication
    user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const clientInfo = getClientInfo(request);
    const body = await request.json();
    const { sessionId, otp, subaccountId } = body;

    // Validate required fields
    if (!sessionId || !otp) {
      return createJsonResponse({ 
        error: 'Missing required fields: sessionId and otp are required' 
      }, 400);
    }

    // Create initial audit log entry
    auditLogId = await kycAuditService.logKYCOperation(
      user.id,
      'subaccount_otp_verification',
      {
        verificationType: 'subaccount_otp_verification',
        verificationProvider: 'safehaven',
        requestData: {
          sessionId,
          otp: '***', // Mask OTP for security
          subaccountId
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        metadata: {
          endpoint: 'PUT /api/safehaven-subaccounts',
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      }
    );

    // Verify OTP with SafeHaven
    const result = await safehavenApiService.verifySubaccountOTP(user.id, sessionId, otp);

    if (!result.success) {
      // Update OTP attempts in database
      if (subaccountId) {
        await supabase
          .from('safehaven_subaccounts')
          .update({
            otp_attempts: supabase.raw('otp_attempts + 1'),
            updated_at: new Date().toISOString()
          })
          .eq('id', subaccountId)
          .eq('user_id', user.id);
      }

      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        result.error || 'OTP verification failed'
      );

      return createJsonResponse({ 
        error: result.error || 'OTP verification failed' 
      }, 400);
    }

    // Update subaccount status in database
    const { data: updatedSubaccount, error: dbError } = await supabase
      .from('safehaven_subaccounts')
      .update({
        status: 'Active',
        otp_verified: true,
        otp_verified_at: new Date().toISOString(),
        account_number: result.data?.accountNumber,
        safehaven_subaccount_id: result.data?.subaccountId || result.data?.id,
        updated_at: new Date().toISOString(),
        metadata: supabase.raw(`
          COALESCE(metadata, '{}'::jsonb) || 
          '{"otp_verified_at": "${new Date().toISOString()}", "safehaven_response": ${JSON.stringify(result.data)}}'::jsonb
        `)
      })
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (dbError) {
      console.error('Database error updating subaccount:', dbError);
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        `Database error: ${dbError.message}`
      );

      return createJsonResponse({ 
        error: 'Failed to update subaccount status' 
      }, 500);
    }

    // Update audit log with success
    await kycAuditService.updateAuditLogStatus(
      auditLogId,
      'completed',
      undefined,
      undefined,
      {
        subaccountId: updatedSubaccount.id,
        accountNumber: result.data?.accountNumber,
        responseTime: Date.now() - startTime
      }
    );

    return createJsonResponse({
      success: true,
      data: {
        subaccountId: updatedSubaccount.id,
        accountNumber: result.data?.accountNumber,
        status: 'Active',
        message: 'Subaccount created successfully'
      }
    });

  } catch (error) {
    console.error('Subaccount OTP verification error:', error);
    
    if (auditLogId) {
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }

    return createJsonResponse({ 
      error: 'Internal server error during OTP verification' 
    }, 500);
  }
}

/**
 * GET /api/safehaven-subaccounts - Get user's subaccounts
 */
export async function GET(request: NextRequest) {
  let auditLogId: string | null = null;
  let user: any = null;
  const startTime = Date.now();

  try {
    // Verify authentication
    user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const clientInfo = getClientInfo(request);
    const url = new URL(request.url);
    const subaccountId = url.searchParams.get('subaccountId');

    // Create initial audit log entry
    auditLogId = await kycAuditService.logKYCOperation(
      user.id,
      'subaccounts_fetch',
      {
        verificationType: 'subaccounts_fetch',
        verificationProvider: 'safehaven',
        requestData: {
          subaccountId: subaccountId || 'all'
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        metadata: {
          endpoint: 'GET /api/safehaven-subaccounts',
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      }
    );

    let result;
    if (subaccountId) {
      // Get specific subaccount details
      result = await safehavenApiService.getSubaccountDetails(user.id, subaccountId);
    } else {
      // Get all subaccounts
      result = await safehavenApiService.getSubaccounts(user.id);
    }

    if (!result.success) {
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        result.error || 'Failed to fetch subaccounts'
      );

      return createJsonResponse({ 
        error: result.error || 'Failed to fetch subaccounts' 
      }, 500);
    }

    // Update audit log with success
    await kycAuditService.updateAuditLogStatus(
      auditLogId,
      'completed',
      undefined,
      undefined,
      {
        subaccountCount: Array.isArray(result.data) ? result.data.length : 1,
        responseTime: Date.now() - startTime
      }
    );

    return createJsonResponse({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Subaccounts fetch error:', error);
    
    if (auditLogId) {
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }

    return createJsonResponse({ 
      error: 'Internal server error during subaccounts fetch' 
    }, 500);
  }
}

/**
 * PATCH /api/safehaven-subaccounts - Update subaccount status
 */
export async function PATCH(request: NextRequest) {
  let auditLogId: string | null = null;
  let user: any = null;
  const startTime = Date.now();

  try {
    // Verify authentication
    user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    const clientInfo = getClientInfo(request);
    const body = await request.json();
    const { subaccountId, status } = body;

    // Validate required fields
    if (!subaccountId || !status) {
      return createJsonResponse({ 
        error: 'Missing required fields: subaccountId and status are required' 
      }, 400);
    }

    // Validate status
    if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
      return createJsonResponse({ 
        error: 'Invalid status. Must be one of: Active, Inactive, Suspended' 
      }, 400);
    }

    // Create initial audit log entry
    auditLogId = await kycAuditService.logKYCOperation(
      user.id,
      'subaccount_status_update',
      {
        verificationType: 'subaccount_status_update',
        verificationProvider: 'safehaven',
        requestData: {
          subaccountId,
          status
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        metadata: {
          endpoint: 'PATCH /api/safehaven-subaccounts',
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      }
    );

    // Update subaccount status
    const result = await safehavenApiService.updateSubaccountStatus(user.id, subaccountId, status);

    if (!result.success) {
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        result.error || 'Failed to update subaccount status'
      );

      return createJsonResponse({ 
        error: result.error || 'Failed to update subaccount status' 
      }, 500);
    }

    // Update local database
    const { error: dbError } = await supabase
      .from('safehaven_subaccounts')
      .update({
        status,
        updated_at: new Date().toISOString(),
        metadata: supabase.raw(`
          COALESCE(metadata, '{}'::jsonb) || 
          '{"status_updated_at": "${new Date().toISOString()}", "safehaven_response": ${JSON.stringify(result.data)}}'::jsonb
        `)
      })
      .eq('safehaven_subaccount_id', subaccountId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Database error updating subaccount status:', dbError);
    }

    // Update audit log with success
    await kycAuditService.updateAuditLogStatus(
      auditLogId,
      'completed',
      undefined,
      undefined,
      {
        subaccountId,
        newStatus: status,
        responseTime: Date.now() - startTime
      }
    );

    return createJsonResponse({
      success: true,
      data: {
        subaccountId,
        status,
        message: 'Subaccount status updated successfully'
      }
    });

  } catch (error) {
    console.error('Subaccount status update error:', error);
    
    if (auditLogId) {
      await kycAuditService.updateAuditLogStatus(
        auditLogId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }

    return createJsonResponse({ 
      error: 'Internal server error during subaccount status update' 
    }, 500);
  }
}
