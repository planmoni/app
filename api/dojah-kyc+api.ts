import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dojah API configuration - get from expo config
const DOJAH_API_URL = 'https://api.dojah.io';
const DOJAH_APP_ID = Constants.expoConfig?.extra?.DOJAH_APP_ID || process.env.DOJAH_APP_ID;
const DOJAH_PRIVATE_KEY = Constants.expoConfig?.extra?.DOJAH_PRIVATE_KEY || process.env.DOJAH_PRIVATE_KEY;

// Debug logging for environment variables
console.log('Dojah API credentials check:', {
  hasAppId: !!DOJAH_APP_ID,
  hasPrivateKey: !!DOJAH_PRIVATE_KEY,
  appIdLength: DOJAH_APP_ID?.length || 0,
  privateKeyLength: DOJAH_PRIVATE_KEY?.length || 0
});

// Verify user authentication
async function verifyAuth(request: Request) {
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
}

// Helper function to safely parse response
async function safeParseResponse(response: Response) {
  const contentType = response.headers.get('Content-Type') || '';
  console.log('Response details:', {
    status: response.status,
    statusText: response.statusText,
    contentType,
    url: response.url
  });

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      console.error('JSON parse error:', error);
      const text = await response.text();
      console.error('Response text:', text.substring(0, 500));
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  } else {
    const text = await response.text();
    console.error('Non-JSON response received:', text.substring(0, 500));
    throw new Error(`Expected JSON response but received ${contentType}. Response: ${text.substring(0, 200)}`);
  }
}

// Verify BVN
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if Dojah API keys are available
    if (!DOJAH_APP_ID || !DOJAH_PRIVATE_KEY) {
      console.error('Dojah API keys not configured:', {
        hasAppId: !!DOJAH_APP_ID,
        hasPrivateKey: !!DOJAH_PRIVATE_KEY
      });
      return new Response(JSON.stringify({ 
        error: 'KYC service not properly configured. Please contact support.',
        details: 'Missing Dojah API credentials'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get verification data from request body
    const requestBody = await request.json();
    const { verificationType, verificationData } = requestBody;

    // Validate required fields
    if (!verificationType || !verificationData) {
      return new Response(JSON.stringify({ error: 'Missing required verification details' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let endpoint = '';
    let payload = {};

    // Determine which Dojah endpoint to use based on verification type
    switch (verificationType) {
      case 'bvn':
        endpoint = '/v1/kyc/bvn';
        payload = { bvn: verificationData.bvn };
        break;
      case 'nin':
        endpoint = '/v1/kyc/nin';
        payload = { nin: verificationData.nin };
        break;
      case 'passport':
        endpoint = '/v1/kyc/passport';
        payload = { 
          passport_number: verificationData.passportNumber,
          first_name: verificationData.firstName,
          last_name: verificationData.lastName
        };
        break;
      case 'drivers_license':
        endpoint = '/v1/kyc/dl';
        payload = { 
          license_number: verificationData.licenseNumber,
          first_name: verificationData.firstName,
          last_name: verificationData.lastName
        };
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid verification type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    console.log('Making request to Dojah API:', {
      endpoint,
      url: `${DOJAH_API_URL}${endpoint}`,
      payload
    });

    // Make request to Dojah API
    const response = await fetch(`${DOJAH_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppId': DOJAH_APP_ID,
        'Authorization': `${DOJAH_PRIVATE_KEY}`
      },
      body: JSON.stringify(payload)
    });

    // Safely parse the response
    let data;
    try {
      data = await safeParseResponse(response);
    } catch (parseError) {
      console.error('Error parsing Dojah API response:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid response from verification service',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if the request was successful
    if (!response.ok) {
      console.error('Dojah API error response:', {
        status: response.status,
        statusText: response.statusText,
        data
      });
      return new Response(JSON.stringify({ 
        error: data?.message || `Verification service error: ${response.status} ${response.statusText}`,
        details: data
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store verification result in database
    const { error: dbError } = await supabase
      .from('kyc_verifications')
      .insert({
        user_id: user.id,
        verification_type: verificationType,
        verification_data: verificationData,
        verification_result: data,
        status: data.entity?.verification_status || 'pending'
      });

    if (dbError) {
      console.error('Error storing verification result:', dbError);
      // Continue anyway, as the verification was successful
    }

    // Return the verification result
    return Response.json({
      status: 'success',
      message: 'Identity verified successfully',
      data: data.entity
    });
  } catch (error) {
    console.error('Error verifying identity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Internal server error during identity verification',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Document verification endpoint
export async function PUT(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if Dojah API keys are available
    if (!DOJAH_APP_ID || !DOJAH_PRIVATE_KEY) {
      console.error('Dojah API keys not configured for document verification');
      return new Response(JSON.stringify({ 
        error: 'KYC service not properly configured. Please contact support.',
        details: 'Missing Dojah API credentials'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get document data from request body
    const { documentType, documentImage, selfieImage } = await request.json();

    if (!documentType || !documentImage) {
      return new Response(JSON.stringify({ error: 'Document type and image are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Making document verification request to Dojah API');

    // For document verification, we'll use Dojah's document analysis endpoint
    const response = await fetch(`${DOJAH_API_URL}/v1/kyc/document/analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppId': DOJAH_APP_ID,
        'Authorization': `${DOJAH_PRIVATE_KEY}`
      },
      body: JSON.stringify({
        document_type: documentType,
        image: documentImage,
        selfie_image: selfieImage || null
      })
    });

    // Safely parse the response
    let data;
    try {
      data = await safeParseResponse(response);
    } catch (parseError) {
      console.error('Error parsing Dojah document verification response:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid response from document verification service',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if the request was successful
    if (!response.ok) {
      console.error('Dojah document verification error:', {
        status: response.status,
        statusText: response.statusText,
        data
      });
      return new Response(JSON.stringify({ 
        error: data?.message || `Document verification service error: ${response.status} ${response.statusText}`,
        details: data
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store document verification result in database
    const { error: dbError } = await supabase
      .from('kyc_documents')
      .insert({
        user_id: user.id,
        document_type: documentType,
        verification_result: data,
        status: data.entity?.verification_status || 'pending'
      });

    if (dbError) {
      console.error('Error storing document verification result:', dbError);
      // Continue anyway, as the verification was successful
    }

    // Return the verification result
    return Response.json({
      status: 'success',
      message: 'Document verified successfully',
      data: data.entity
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Internal server error during document verification',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get verification status
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the latest verification status from the database
    const { data: verificationData, error: verificationError } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (verificationError) {
      console.error('Error fetching verification status:', verificationError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch verification status',
        details: verificationError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the latest document verification status
    const { data: documentData, error: documentError } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (documentError) {
      console.error('Error fetching document verification status:', documentError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch document verification status',
        details: documentError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine overall verification status
    let overallStatus = 'unverified';
    let tier = 1;

    if (verificationData && verificationData.length > 0) {
      const verification = verificationData[0];
      if (verification.status === 'verified') {
        overallStatus = 'partially_verified';
        tier = 2;
      }
    }

    if (documentData && documentData.length > 0) {
      const document = documentData[0];
      if (document.status === 'verified' && overallStatus === 'partially_verified') {
        overallStatus = 'fully_verified';
        tier = 3;
      }
    }

    // Update user's KYC tier in the database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ kyc_tier: tier })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user KYC tier:', updateError);
      // Continue anyway
    }

    return Response.json({
      status: 'success',
      verification: verificationData && verificationData.length > 0 ? verificationData[0] : null,
      document: documentData && documentData.length > 0 ? documentData[0] : null,
      overallStatus,
      tier
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Internal server error while fetching verification status',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}