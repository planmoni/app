import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dojah API configuration
const DOJAH_API_URL = 'https://api.dojah.io';
const DOJAH_APP_ID = process.env.DOJAH_APP_ID;
const DOJAH_PRIVATE_KEY = process.env.DOJAH_PRIVATE_KEY;

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

// Address matching function
function matchAddresses(utilityAddress: any, userAddress: string): boolean {
  if (!utilityAddress || !userAddress) return false;

  // Normalize addresses for comparison
  const normalizeAddress = (addr: string) => {
    return addr.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const normalizedUserAddress = normalizeAddress(userAddress);
  
  // Check if any part of the utility address matches
  const addressParts = [
    utilityAddress.street,
    utilityAddress.city,
    utilityAddress.state,
    utilityAddress.country
  ].filter(Boolean).map(normalizeAddress);

  // Check if any address part is contained in user address or vice versa
  for (const part of addressParts) {
    if (part && (normalizedUserAddress.includes(part) || part.includes(normalizedUserAddress))) {
      return true;
    }
  }

  return false;
}

// Validate utility bill using Dojah API
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Check if Dojah API keys are available
    if (!DOJAH_APP_ID || !DOJAH_PRIVATE_KEY) {
      console.error('Dojah API keys not configured for utility bill validation');
      return createJsonResponse({ 
        error: 'KYC service not properly configured. Please contact support.',
        details: 'Missing Dojah API credentials'
      }, 500);
    }

    // Get utility bill data from request body
    const { utilityBillImage, userAddress } = await request.json();

    if (!utilityBillImage) {
      return createJsonResponse({ error: 'Utility bill image is required' }, 400);
    }

    console.log('Making utility bill validation request to Dojah API');

    // Convert storage URL to base64 for Dojah API
    let base64Image: string;
    
    try {
      // Check if it's a storage URL or base64
      if (utilityBillImage.startsWith('data:')) {
        // Already base64
        base64Image = utilityBillImage;
      } else if (utilityBillImage.includes('supabase') || utilityBillImage.includes('storage')) {
        // It's a storage URL, fetch and convert to base64
        const imageResponse = await fetch(utilityBillImage);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from storage: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        
        const imageBlob = await imageResponse.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageBlob.type || 'image/jpeg';
        base64Image = `data:${mimeType};base64,${base64}`;
      } else {
        // Assume it's a regular URL
        const imageResponse = await fetch(utilityBillImage);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        
        const imageBlob = await imageResponse.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageBlob.type || 'image/jpeg';
        base64Image = `data:${mimeType};base64,${base64}`;
      }
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return createJsonResponse({ 
        error: 'Failed to process utility bill image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }

    // Call Dojah utility bill analysis endpoint
    const response = await fetch(`${DOJAH_API_URL}/api/v1/document/analysis/utility_bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppId': DOJAH_APP_ID,
        'Authorization': `${DOJAH_PRIVATE_KEY}`
      },
      body: JSON.stringify({
        image: base64Image
      })
    });

    // Safely parse the response
    let data;
    try {
      data = await safeParseResponse(response);
    } catch (parseError) {
      console.error('Error parsing Dojah utility bill validation response:', parseError);
      return createJsonResponse({ 
        error: 'Invalid response from utility bill validation service',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, 502);
    }

    // Check if the request was successful
    if (!response.ok) {
      console.error('Dojah utility bill validation error:', {
        status: response.status,
        statusText: response.statusText,
        data
      });
      return createJsonResponse({ 
        error: data?.message || `Utility bill validation service error: ${response.status} ${response.statusText}`,
        details: data
      }, response.status);
    }

    // Extract validation results
    const validationResult = data.entity || data;
    const addressInfo = validationResult.address_info;
    
    // Perform validation checks
    const validationChecks = {
      isRecent: validationResult.is_recent === true,
      hasAddressInfo: addressInfo && 
        addressInfo.street && 
        addressInfo.city && 
        addressInfo.state && 
        addressInfo.country,
      addressMatches: userAddress ? matchAddresses(addressInfo, userAddress) : true
    };

    // Determine if validation passed
    const isValid = validationChecks.isRecent && 
                   validationChecks.hasAddressInfo && 
                   validationChecks.addressMatches;

    // Store validation result in database
    try {
      const { error: dbError } = await supabase
        .from('utility_bill_validations')
        .insert({
          user_id: user.id,
          validation_result: validationResult,
          validation_checks: validationChecks,
          is_valid: isValid,
          user_address: userAddress
        });

      if (dbError) {
        console.error('Error storing utility bill validation result:', dbError);
        // Continue anyway, as the validation was successful
      }
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      // Continue anyway, as the validation was successful
    }

    // Return validation result
    return createJsonResponse({
      status: 'success',
      message: isValid ? 'Utility bill validation passed' : 'Utility bill validation failed',
      isValid,
      validationChecks,
      addressInfo,
      details: {
        isRecent: validationChecks.isRecent,
        hasAddressInfo: validationChecks.hasAddressInfo,
        addressMatches: validationChecks.addressMatches,
        extractedAddress: addressInfo
      }
    });

  } catch (error) {
    console.error('Error validating utility bill:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error during utility bill validation',
      details: errorMessage
    }, 500);
  }
}

// Get utility bill validation status
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get the latest utility bill validation status from the database
    const { data: validationData, error: validationError } = await supabase
      .from('utility_bill_validations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (validationError) {
      console.error('Error fetching utility bill validation status:', validationError);
      return createJsonResponse({ 
        error: 'Failed to fetch utility bill validation status',
        details: validationError.message
      }, 500);
    }

    return createJsonResponse({
      status: 'success',
      validation: validationData && validationData.length > 0 ? validationData[0] : null
    });

  } catch (error) {
    console.error('Error fetching utility bill validation status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error while fetching utility bill validation status',
      details: errorMessage
    }, 500);
  }
}

