import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// OTP configuration
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

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

// Generate a random OTP
function generateOTP(length: number = OTP_LENGTH): string {
  const digits = '0123456789';
  let otp = '';
  
  // Generate random bytes and use them to select digits
  const randomBytesBuffer = randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytesBuffer[i] % digits.length];
  }
  
  return otp;
}

// Send OTP via email
async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  try {
    // In a real implementation, you would use an email service like SendGrid, Resend, etc.
    // For now, we'll simulate sending an email and log the OTP to the console
    console.log(`Sending OTP ${otp} to ${email}`);
    
    // For demo purposes, we'll store the OTP in the database
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    
    // First, delete any existing OTPs for this email
    await supabase
      .from('otps')
      .delete()
      .eq('email', email);
    
    // Then, insert the new OTP
    const { error } = await supabase
      .from('otps')
      .insert({
        email,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        is_used: false
      });
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

// Verify OTP
async function verifyOTP(email: string, otp: string): Promise<boolean> {
  try {
    // Get the OTP record from the database
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otp)
      .eq('is_used', false)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    // Check if the OTP has expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      return false;
    }
    
    // Mark the OTP as used
    await supabase
      .from('otps')
      .update({ is_used: true })
      .eq('id', data.id);
    
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
}

// POST endpoint to send OTP
export async function POST(request: Request) {
  try {
    // Get email from request body
    const { email } = await request.json();
    
    if (!email) {
      return createJsonResponse({ error: 'Email is required' }, 400);
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Send OTP via email
    const sent = await sendOTPEmail(email, otp);
    
    if (!sent) {
      return createJsonResponse({ error: 'Failed to send OTP' }, 500);
    }
    
    return createJsonResponse({ 
      success: true, 
      message: 'OTP sent successfully',
      expiresInMinutes: OTP_EXPIRY_MINUTES
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// PUT endpoint to verify OTP
export async function PUT(request: Request) {
  try {
    // Get email and OTP from request body
    const { email, otp } = await request.json();
    
    if (!email || !otp) {
      return createJsonResponse({ error: 'Email and OTP are required' }, 400);
    }
    
    // Verify OTP
    const isValid = await verifyOTP(email, otp);
    
    if (!isValid) {
      return createJsonResponse({ error: 'Invalid or expired OTP' }, 400);
    }
    
    // If the user is already authenticated, update their profile
    const user = await verifyAuth(request);
    if (user) {
      // Update the user's profile to mark email as verified
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', user.id);
    }
    
    return createJsonResponse({ 
      success: true, 
      message: 'OTP verified successfully' 
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return createJsonResponse({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}