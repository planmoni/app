import { supabase } from '@/lib/supabase';

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

// POST endpoint to send OTP
export async function POST(request: Request) {
  try {
    console.log('[OTP API] POST request received');
    
    // Get email from request body
    const requestBody = await request.json();
    const { email } = requestBody;
    
    console.log(`[OTP API] Request body:`, requestBody);
    
    if (!email) {
      console.log('[OTP API] Email is required but was not provided');
      return createJsonResponse({ error: 'Email is required' }, 400);
    }
    
    // Call the Supabase Edge Function to send OTP
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl) {
      return createJsonResponse({ error: 'Supabase URL not configured' }, 500);
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-otp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[OTP API] Error from Edge Function:', data);
      return createJsonResponse({ 
        error: data.error || 'Failed to send OTP' 
      }, response.status);
    }
    
    console.log('[OTP API] OTP sent successfully');
    return createJsonResponse({ 
      success: true, 
      message: 'OTP sent successfully',
      expiresInMinutes: 10
    });
  } catch (error) {
    console.error('[OTP API] Error sending OTP:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// PUT endpoint to verify OTP
export async function PUT(request: Request) {
  try {
    console.log('[OTP API] PUT request received');
    
    // Get email and OTP from request body
    const requestBody = await request.json();
    const { email, otp } = requestBody;
    
    console.log(`[OTP API] Verification request:`, { email, otp: otp ? '******' : 'missing' });
    
    if (!email || !otp) {
      console.log('[OTP API] Email and OTP are required but one or both were not provided');
      return createJsonResponse({ error: 'Email and OTP are required' }, 400);
    }
    
    // Call the Supabase function to verify OTP
    const { data, error: verifyError } = await supabase.rpc('verify_otp', { 
      p_email: email,
      p_otp: otp
    });
    
    if (verifyError) {
      console.error('[OTP API] Error verifying OTP:', verifyError);
      return createJsonResponse({ error: verifyError.message || 'Failed to verify OTP' }, 500);
    }
    
    if (!data) {
      console.log('[OTP API] Invalid or expired OTP');
      return createJsonResponse({ error: 'Invalid or expired OTP' }, 400);
    }
    
    // If the user is already authenticated, update their profile
    const user = await verifyAuth(request);
    if (user) {
      console.log(`[OTP API] User is authenticated, updating profile for user ID: ${user.id}`);
      // Update the user's profile to mark email as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', user.id);
        
      if (updateError) {
        console.error(`[OTP API] Error updating profile:`, updateError);
      } else {
        console.log(`[OTP API] Profile updated successfully`);
      }
    } else {
      console.log(`[OTP API] User is not authenticated, skipping profile update`);
    }
    
    console.log('[OTP API] OTP verified successfully');
    return createJsonResponse({ 
      success: true, 
      message: 'OTP verified successfully' 
    });
  } catch (error) {
    console.error('[OTP API] Error verifying OTP:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}