import { supabase } from './supabase';

// Resend API key for sending emails
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu';

/**
 * Safely parse response as JSON, handling non-JSON responses
 */
async function safeParseResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    // If it's not JSON, get the text content for error reporting
    const textContent = await response.text();
    throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}. Response: ${textContent.substring(0, 200)}`);
  }
  
  try {
    return await response.json();
  } catch (parseError) {
    const textContent = await response.text();
    throw new Error(`Failed to parse JSON response. Content: ${textContent.substring(0, 200)}`);
  }
}

/**
 * Send an email using the Resend API
 * @param to Recipient email address
 * @param subject Email subject
 * @param html Email HTML content
 * @returns Response from the Resend API
 */
export async function sendEmail(to: string, subject: string, html: string) {
  try {
    console.log(`Sending email to ${to} with subject: ${subject}`);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Planmoni <notifications@planmoni.com>',
        to,
        subject,
        html
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await safeParseResponse(response);
      } catch (parseError) {
        throw new Error(`Failed to send email: HTTP ${response.status} - ${response.statusText}`);
      }
      console.error('Failed to send email:', errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const data = await safeParseResponse(response);
    console.log('Email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send an OTP email to a user
 * @param email Recipient email address
 * @param firstName User's first name (optional)
 * @param lastName User's last name (optional)
 * @returns Response indicating success or failure
 */
export async function sendOtpEmail(email: string, firstName?: string, lastName?: string) {
  try {
    console.log(`Sending OTP email to ${email}`);
    
    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    // Store OTP in database
    const { error: insertError } = await supabase
      .from('otps')
      .insert({
        email: email.toLowerCase(),
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        is_used: false
      });
      
    if (insertError) {
      console.error("Error inserting OTP:", insertError);
      throw new Error("Failed to generate OTP");
    }
    
    // Store the email in the verification cache (unverified)
    try {
      await supabase
        .from('email_verification_cache')
        .upsert([
          { 
            email: email.trim().toLowerCase(),
            first_name: firstName || null,
            last_name: lastName || null,
            verified: false,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
          }
        ]);
    } catch (storageError) {
      console.error('Error storing email in verification cache:', storageError);
      // Continue anyway as this is not critical for OTP sending
    }
    
    // Send email with OTP
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
          .code { font-size: 32px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 5px; color: #1E3A8A; }
          .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Your Verification Code</h2>
        </div>
        <div class="content">
          <p>Hello${firstName ? ` ${firstName}` : ''},</p>
          <p>Your verification code is:</p>
          <div class="code">${otpCode}</div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(
      email.toLowerCase(),
      "Your Planmoni Verification Code",
      emailHtml
    );
    
    console.log('OTP email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
}

/**
 * Verify an OTP code
 * @param email User's email address
 * @param otp OTP code to verify
 * @returns Boolean indicating if the OTP is valid
 */
export async function verifyOtp(email: string, otp: string) {
  try {
    console.log(`Verifying OTP for ${email}`);
    
    // Find the OTP record
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('otp_code', otp)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error querying OTP:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('Invalid or expired OTP');
      return false;
    }
    
    // Mark OTP as used
    const { error: updateError } = await supabase
      .from('otps')
      .update({ is_used: true })
      .eq('id', data[0].id);
    
    if (updateError) {
      console.error('Error marking OTP as used:', updateError);
      // Continue anyway as the OTP was valid
    }
    
    // Update the verification cache to mark email as verified
    try {
      await supabase
        .from('email_verification_cache')
        .upsert([
          { 
            email: email.trim().toLowerCase(),
            verified: true,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
          }
        ]);
    } catch (storageError) {
      console.error('Error updating verification cache:', storageError);
      // Continue anyway as the OTP was successfully verified
    }
    
    console.log('OTP verified successfully');
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
}

/**
 * Send a notification email
 * @param type Type of notification
 * @param data Data for the notification
 * @param accessToken User's access token
 * @returns Boolean indicating success or failure
 */
export async function sendNotificationEmail(
  type: 'new_login' | 'payout_completed' | 'plan_expiry' | 'wallet_summary',
  data: any,
  accessToken: string
) {
  try {
    console.log(`Sending ${type} notification`);
    
    const response = await fetch('/api/email-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ 
        type,
        data
      })
    });
    
    // Check if response is ok before attempting to parse
    if (!response.ok) {
      console.error(`Error sending notification: HTTP ${response.status} - ${response.statusText}`);
      
      // Try to get error details
      try {
        const errorData = await safeParseResponse(response);
        console.error('Error details:', errorData);
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      
      return false;
    }
    
    // Parse the successful response
    try {
      const responseData = await safeParseResponse(response);
      console.log('Notification sent successfully:', responseData);
      return true;
    } catch (parseError) {
      console.error('Error parsing successful response:', parseError);
      return false;
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

// Export email template generators
export { 
  generateLoginNotificationHtml,
  generatePayoutNotificationHtml,
  generateExpiryReminderHtml,
  generateWalletSummaryHtml
} from './email-templates';