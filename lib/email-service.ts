import { supabase } from './supabase';

export async function sendOtpEmail(email: string): Promise<void> {
  try {
    // Call the Supabase Edge Function to send OTP
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-otp-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error from Edge Function:', data);
      throw new Error(data.error || 'Failed to send verification code');
    }
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
}

export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  try {
    // Call the Supabase function to verify OTP
    const { data, error: verifyError } = await supabase.rpc('verify_otp', { 
      p_email: email.trim().toLowerCase(),
      p_otp: otp
    });
    
    if (verifyError) {
      console.error('Error verifying OTP:', verifyError);
      throw new Error(verifyError.message || 'Failed to verify OTP');
    }
    
    if (!data) {
      throw new Error('Invalid or expired verification code');
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
}

export async function confirmEmailWithSupabase(token: string, email: string): Promise<boolean> {
  try {
    // Use Supabase's built-in email confirmation
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'signup'
    });
    
    if (error) {
      console.error('Error confirming email with Supabase:', error);
      throw new Error(error.message || 'Failed to confirm email');
    }
    
    return true;
  } catch (error) {
    console.error('Error confirming email:', error);
    throw error;
  }
}