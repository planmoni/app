import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

// Dojah API configuration
const DOJAH_API_URL = 'https://api.dojah.io/api/v1';
// ✅ SECURE: Using server-side environment variables (no EXPO_PUBLIC_ prefix)
const DOJAH_APP_ID = process.env.EXPO_PUBLIC_DOJAH_APP_ID; // App ID is safe to be public
const DOJAH_PRIVATE_KEY = process.env.DOJAH_PRIVATE_KEY; // Private key must be server-side only

// Helper function to create JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Helper function to verify authentication
async function verifyAuth(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Helper function to safely parse response
async function safeParseResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse response as JSON. Response:', text.substring(0, 200));
    throw new Error(`Invalid JSON response from Dojah API. Status: ${response.status}. Response: ${text.substring(0, 200)}`);
  }
}

// Document analysis endpoint
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

    // Check if Dojah API keys are available
    if (!DOJAH_APP_ID || !DOJAH_PRIVATE_KEY) {
      console.error('Dojah API keys not configured:', {
        hasAppId: !!DOJAH_APP_ID,
        hasPrivateKey: !!DOJAH_PRIVATE_KEY
      });
      return createJsonResponse({ 
        error: 'Document analysis service not properly configured. Please contact support.',
        details: 'Missing Dojah API credentials'
      }, 500);
    }

    // Get analysis data from request body
    const requestBody = await request.json();
    const { 
      inputType = 'url',
      imageFrontSide,
      imageBackSide,
      images
    } = requestBody;

    // Validate required parameters
    if (!imageFrontSide) {
      return createJsonResponse({ 
        error: 'Front side image is required',
        details: 'imageFrontSide parameter is missing'
      }, 400);
    }

    // Extract client information for audit logging
    const clientInfo = {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    // Create initial audit log entry
    try {
      const { data: auditLog } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: user.id,
        p_operation_type: 'document_analysis',
        p_verification_type: 'document',
        p_verification_provider: 'dojah',
        p_request_data: {
          action: 'document_analysis_started',
          input_type: inputType,
          has_front_image: !!imageFrontSide,
          has_back_image: !!imageBackSide,
          has_additional_images: !!images,
          client_info: clientInfo
        },
        p_response_data: {
          status: 'processing'
        },
        p_status: 'pending',
        p_result_message: 'Document analysis initiated',
        p_metadata: {
          component: 'dojah-document-analysis-api',
          action: 'document_analysis',
          input_type: inputType
        }
      });
      auditLogId = auditLog;
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      // Continue anyway, as the analysis is more important
    }

    // Prepare request payload
    const payload: any = {
      input_type: inputType,
      imagefrontside: imageFrontSide
    };

    if (imageBackSide) {
      payload.imagebackside = imageBackSide;
    }

    if (images) {
      payload.images = images;
    }

    console.log('Making request to Dojah Document Analysis API:', {
      url: `${DOJAH_API_URL}/document/analysis`,
      payload: {
        ...payload,
        imagefrontside: imageFrontSide ? '***[REDACTED]***' : undefined,
        imagebackside: imageBackSide ? '***[REDACTED]***' : undefined,
        images: images ? '***[REDACTED]***' : undefined
      },
      appId: DOJAH_APP_ID ? '***' + DOJAH_APP_ID.slice(-4) : 'missing',
      privateKey: DOJAH_PRIVATE_KEY ? '***' + DOJAH_PRIVATE_KEY.slice(-4) : 'missing'
    });

    // Make request to Dojah API
    const response = await fetch(`${DOJAH_API_URL}/document/analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppId': DOJAH_APP_ID,
        'Authorization': `${DOJAH_PRIVATE_KEY}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Dojah Document Analysis API response status:', response.status, response.statusText);

    // Safely parse the response
    let data;
    try {
      data = await safeParseResponse(response);
    } catch (parseError) {
      console.error('Error parsing Dojah response:', parseError);
      return createJsonResponse({ 
        error: 'Invalid response from document analysis service',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, 500);
    }

    if (!response.ok) {
      console.error('Dojah Document Analysis API error:', data);
      return createJsonResponse({ 
        error: 'Document analysis failed',
        details: data.message || data.error || 'Unknown error from Dojah API',
        dojah_response: data
      }, response.status);
    }

    console.log('Document analysis successful:', {
      overall_status: data.entity?.status?.overall_status,
      reason: data.entity?.status?.reason,
      document_type: data.entity?.document_type?.document_name,
      has_images: data.entity?.status?.document_images === 'Yes',
      has_text: data.entity?.status?.text === 'Yes'
    });

    // Update audit log with success
    if (auditLogId) {
      try {
        const overallStatus = data.entity?.status?.overall_status;
        const isSuccess = overallStatus === 1;
        
        await supabase.rpc('update_kyc_audit_log', {
          p_audit_log_id: auditLogId,
          p_status: isSuccess ? 'success' : 'failed',
          p_result_message: data.entity?.status?.reason || 'Document analysis completed',
          p_response_data: {
            ...data,
            // Remove sensitive image data from audit trail
            entity: data.entity ? {
              ...data.entity,
              document_images: data.entity.document_images ? {
                portrait: '[REDACTED]',
                document_front_side: '[REDACTED]',
                document_back_side: '[REDACTED]'
              } : undefined
            } : undefined
          },
          p_confidence_score: isSuccess ? 95.0 : 0.0,
          p_processing_time: Date.now() - startTime
        });

        // Create additional audit event for document analysis completion
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: user.id,
            event_type: isSuccess ? 'document_analyzed' : 'document_analysis_failed',
            event_data: {
              action: 'document_analysis_completed',
              provider: 'dojah',
              response_time: Date.now() - startTime,
              overall_status: overallStatus,
              document_type: data.entity?.document_type?.document_name,
              has_images: data.entity?.status?.document_images === 'Yes',
              has_text: data.entity?.status?.text === 'Yes'
            },
            severity: isSuccess ? 'medium' : 'high'
          });
      } catch (auditError) {
        console.error('Error updating audit log:', auditError);
        // Continue anyway, as the analysis was successful
      }
    }

    // Remove portrait image data for privacy/security before returning
    const cleanedEntity = data.entity ? {
      ...data.entity,
      document_images: data.entity.document_images ? {
        ...data.entity.document_images,
        portrait: '[REDACTED]' // Remove base64 portrait data
      } : data.entity.document_images
    } : data.entity;

    // Return the analysis result
    return createJsonResponse({
      status: 'success',
      message: 'Document analysis completed successfully',
      data: cleanedEntity,
      auditLogId: auditLogId // Include audit log ID for tracking
    });

  } catch (error) {
    console.error('Error analyzing document:', error);
    
    // Update audit log with failure
    if (auditLogId) {
      try {
        await supabase.rpc('update_kyc_audit_log', {
          p_audit_log_id: auditLogId,
          p_status: 'failed',
          p_result_message: error instanceof Error ? error.message : 'Document analysis failed',
          p_response_data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            processing_time: Date.now() - startTime
          },
          p_confidence_score: 0.0,
          p_processing_time: Date.now() - startTime
        });
      } catch (auditError) {
        console.error('Error updating audit log on failure:', auditError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Document analysis failed',
      details: errorMessage,
      auditLogId: auditLogId
    }, 500);
  }
}
