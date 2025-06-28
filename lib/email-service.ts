import { supabase } from './supabase';
import { 
  generateLoginNotificationHtml, 
  generatePayoutNotificationHtml, 
  generateExpiryReminderHtml, 
  generateWalletSummaryHtml 
} from './email-templates';

// Resend API key for sending emails
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu';

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
      const errorData = await response.json();
      console.error('Failed to send email:', errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
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
 * @param firstName User's first name
 * @param lastName User's last name
 * @returns Response indicating success or failure
 */
export async function sendOtpEmail(email: string, firstName?: string, lastName?: string) {
  try {
    console.log(`Sending OTP email to ${email}`);
    
    // Call the Supabase function to send OTP
    const { data, error } = await supabase.rpc('send_otp_email', {
      p_email: email.trim().toLowerCase(),
      p_first_name: firstName || null,
      p_last_name: lastName || null
    });
    
    if (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error('Failed to send verification code');
    }
    
    console.log('OTP email sent successfully');
    return data;
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
    
    // Call the Supabase function to verify OTP
    const { data, error } = await supabase.rpc('verify_otp', {
      p_email: email.trim().toLowerCase(),
      p_otp: otp
    });
    
    if (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
    
    if (!data) {
      console.log('Invalid or expired OTP');
      return false;
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
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Failed to send notification:', responseData);
      return false;
    }
    
    console.log('Notification sent successfully');
    return true;
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