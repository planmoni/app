import { supabase } from './supabase';

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
 * @returns Response indicating success or failure
 */
export async function sendOtpEmail(email: string) {
  try {
    console.log(`Sending OTP email to ${email}`);
    
    // Call the Supabase function to send OTP
    const { data, error } = await supabase.rpc('send_otp_email', {
      p_email: email.trim().toLowerCase()
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

/**
 * Send account creation email notification
 * @param userId User ID
 * @param accountNumber Account number
 * @param accountName Account name
 * @param bankName Bank name (defaults to SafeHaven Microfinance Bank)
 * @returns Boolean indicating success or failure
 */
export async function sendAccountCreationEmail(
  userId: string,
  accountNumber: string,
  accountName: string,
  bankName: string = 'SafeHaven Microfinance Bank'
): Promise<{ success: boolean; emailRecordId?: string; error?: string }> {
  try {
    console.log(`Sending account creation email for user ${userId}, account ${accountNumber}`);

    // Get user profile to get email and first name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return { success: false, error: 'User profile not found' };
    }

    const userEmail = profile.email;
    if (!userEmail) {
      console.error('User email not found');
      return { success: false, error: 'User email not found' };
    }

    const firstName = profile.first_name || 'User';

    // Create email record in database
    let emailRecordId: string | undefined;
    try {
      const { data: emailRecord, error: insertError } = await supabase
        .from('account_creation_emails')
        .insert({
          user_id: userId,
          account_number: accountNumber,
          account_name: accountName,
          bank_name: bankName,
          email_sent: false
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating email record:', insertError);
        // Try to find existing record for this user/account combination
        const { data: existingRecord } = await supabase
          .from('account_creation_emails')
          .select('id')
          .eq('user_id', userId)
          .eq('account_number', accountNumber)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        emailRecordId = existingRecord?.id;
      } else {
        emailRecordId = emailRecord?.id;
      }
    } catch (recordError) {
      console.error('Error creating email record:', recordError);
      // Continue - we'll try to send email anyway
    }

    // Generate email HTML
    let html: string;
    try {
      const { generateAccountCreationEmailHtml } = await import('@/lib/email-templates');
      html = generateAccountCreationEmailHtml({
        firstName,
        accountNumber,
        accountName,
        bankName,
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      });
    } catch (templateError) {
      const errorMessage = `Failed to generate email template: ${templateError instanceof Error ? templateError.message : 'Unknown error'}`;
      console.error(errorMessage);
      
      // Update record with error if we have an ID
      if (emailRecordId) {
        await supabase
          .from('account_creation_emails')
          .update({
            error_message: errorMessage,
            email_provider_response: { error: errorMessage },
            updated_at: new Date().toISOString()
          })
          .eq('id', emailRecordId);
      }
      
      return { success: false, error: errorMessage, emailRecordId };
    }

    const subject = 'Your Bank Account Has Been Created - Planmoni';

    // Send email
    try {
      const emailResponse = await sendEmail(userEmail, subject, html);

      // Update email record with success
      if (emailRecordId) {
        await supabase
          .from('account_creation_emails')
          .update({
            email_sent: true,
            sent_at: new Date().toISOString(),
            email_provider_response: emailResponse,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailRecordId);
      }

      console.log('Account creation email sent successfully');
      return { success: true, emailRecordId };
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';

      // Update email record with error - ALWAYS update if we have an ID
      if (emailRecordId) {
        await supabase
          .from('account_creation_emails')
          .update({
            error_message: errorMessage,
            email_provider_response: { error: errorMessage },
            updated_at: new Date().toISOString()
          })
          .eq('id', emailRecordId);
      }

      console.error('Error sending account creation email:', emailError);
      return { success: false, error: errorMessage, emailRecordId };
    }
  } catch (error) {
    console.error('Error in sendAccountCreationEmail:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to update record if we can find it
    try {
      const { data: existingRecord } = await supabase
        .from('account_creation_emails')
        .select('id')
        .eq('user_id', userId)
        .eq('account_number', accountNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (existingRecord?.id) {
        await supabase
          .from('account_creation_emails')
          .update({
            error_message: errorMessage,
            email_provider_response: { error: errorMessage },
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);
      }
    } catch (updateError) {
      console.error('Failed to update email record with error:', updateError);
    }
    
    return { success: false, error: errorMessage };
  }
}

// Email template generators
export { 
  generateLoginNotificationHtml,
  generatePayoutNotificationHtml,
  generateExpiryReminderHtml,
  generateWalletSummaryHtml,
  generateAccountCreationEmailHtml
} from '@/lib/email-templates';