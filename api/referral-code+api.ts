import { supabase } from '../lib/supabase';

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

// Generate a unique referral code
function generateReferralCode(firstName: string, userId: string): string {
  // Take first 3 characters of first name (or fewer if name is shorter)
  const namePrefix = firstName.substring(0, 3).toUpperCase();
  
  // Take last 6 characters of user ID
  const idSuffix = userId.substring(userId.length - 6).toUpperCase();
  
  // Combine to create a unique code
  return `${namePrefix}${idSuffix}`;
}

// Validate a referral code
export async function GET(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    
    if (!code) {
      return createJsonResponse({ error: 'Referral code is required' }, 400);
    }
    
    // Check if the referral code exists
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('referral_code', code.toUpperCase())
      .single();
    
    if (error || !data) {
      return createJsonResponse({ 
        valid: false,
        message: 'Invalid referral code'
      });
    }
    
    return createJsonResponse({
      valid: true,
      referrer: {
        id: data.id,
        name: `${data.first_name} ${data.last_name}`
      }
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    return createJsonResponse({ 
      error: 'Failed to validate referral code',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// Generate or retrieve a user's referral code
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Check if user already has a referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code, first_name')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      return createJsonResponse({ 
        error: 'Failed to retrieve user profile',
        details: profileError.message
      }, 500);
    }
    
    let referralCode = profile.referral_code;
    
    // If no referral code exists, generate one
    if (!referralCode) {
      referralCode = generateReferralCode(profile.first_name, user.id);
      
      // Save the generated code
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ referral_code: referralCode })
        .eq('id', user.id);
      
      if (updateError) {
        return createJsonResponse({ 
          error: 'Failed to generate referral code',
          details: updateError.message
        }, 500);
      }
    }
    
    return createJsonResponse({
      referralCode,
      shareText: `Join me on Planmoni! Use my referral code ${referralCode} to get started. Download the app at https://planmoni.app`
    });
  } catch (error) {
    console.error('Error generating referral code:', error);
    return createJsonResponse({ 
      error: 'Failed to generate referral code',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}