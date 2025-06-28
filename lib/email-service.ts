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
        from: 'Planmoni <notifications@planmoni.app>',
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
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ 
        to: data.email || data.recipientEmail,
        subject: getSubjectForNotificationType(type),
        html: getHtmlForNotificationType(type, data)
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
 * Get the subject line for a notification type
 */
function getSubjectForNotificationType(type: string): string {
  switch (type) {
    case 'new_login':
      return 'New Login Detected - Planmoni';
    case 'payout_completed':
      return 'Payout Successful - Planmoni';
    case 'plan_expiry':
      return 'Payout Plan Expiring Soon - Planmoni';
    case 'wallet_summary':
      return 'Wallet Summary - Planmoni';
    default:
      return 'Notification from Planmoni';
  }
}

/**
 * Get the HTML content for a notification type
 */
function getHtmlForNotificationType(type: string, data: any): string {
  switch (type) {
    case 'new_login':
      return generateLoginNotificationHtml(data);
    case 'payout_completed':
      return generatePayoutNotificationHtml(data);
    case 'plan_expiry':
      return generateExpiryReminderHtml(data);
    case 'wallet_summary':
      return generateWalletSummaryHtml(data);
    default:
      return `<p>Notification from Planmoni</p>`;
  }
}

/**
 * Generate HTML for login notification
 */
function generateLoginNotificationHtml(data: {
  firstName: string;
  device: string;
  location: string;
  time: string;
  ip: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .alert { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>New Login Detected</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>We detected a new login to your Planmoni account.</p>
        
        <div class="alert">
          <p><strong>If this was you, no action is needed.</strong></p>
          <p>If you didn't log in recently, please secure your account immediately by changing your password.</p>
        </div>
        
        <table>
          <tr>
            <th>Device</th>
            <td>${data.device}</td>
          </tr>
          <tr>
            <th>Location</th>
            <td>${data.location}</td>
          </tr>
          <tr>
            <th>Time</th>
            <td>${data.time}</td>
          </tr>
          <tr>
            <th>IP Address</th>
            <td>${data.ip}</td>
          </tr>
        </table>
        
        <a href="https://planmoni.app/change-password" class="button">Secure Your Account</a>
        
        <p>If you have any questions, please contact our support team.</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for payout notification
 */
function generatePayoutNotificationHtml(data: {
  firstName: string;
  amount: string;
  planName: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  date: string;
  nextPayoutDate?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #22C55E; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .amount { font-size: 24px; font-weight: bold; color: #22C55E; text-align: center; margin: 20px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; width: 40%; }
        .next-payout { background-color: #EFF6FF; border-left: 4px solid #1E3A8A; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Payout Successful</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>Great news! Your scheduled payout has been successfully processed.</p>
        
        <div class="amount">${data.amount}</div>
        
        <table>
          <tr>
            <th>Plan Name</th>
            <td>${data.planName}</td>
          </tr>
          <tr>
            <th>Account Name</th>
            <td>${data.accountName}</td>
          </tr>
          <tr>
            <th>Bank</th>
            <td>${data.bankName}</td>
          </tr>
          <tr>
            <th>Account Number</th>
            <td>${data.accountNumber}</td>
          </tr>
          <tr>
            <th>Date</th>
            <td>${data.date}</td>
          </tr>
        </table>
        
        ${data.nextPayoutDate ? `
        <div class="next-payout">
          <p><strong>Next Payout:</strong> ${data.nextPayoutDate}</p>
          <p>Your next scheduled payout is on track. You can view your payout schedule in your Planmoni dashboard.</p>
        </div>
        ` : ''}
        
        <a href="https://planmoni.app/transactions" class="button">View Transaction Details</a>
        
        <p>Thank you for using Planmoni to manage your finances!</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for plan expiry reminder
 */
function generateExpiryReminderHtml(data: {
  firstName: string;
  planName: string;
  expiryDate: string;
  daysRemaining: number;
  amount: string;
  totalPaid: string;
  remainingPayouts: number;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .alert { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; width: 40%; }
        .countdown { font-size: 24px; font-weight: bold; color: #F59E0B; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Payout Plan Expiring Soon</h2>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>Your payout plan "${data.planName}" is expiring soon.</p>
        
        <div class="countdown">${data.daysRemaining} days remaining</div>
        
        <div class="alert">
          <p><strong>Plan Expiry Date:</strong> ${data.expiryDate}</p>
          <p>You have ${data.remainingPayouts} payouts remaining before this plan expires.</p>
        </div>
        
        <table>
          <tr>
            <th>Plan Name</th>
            <td>${data.planName}</td>
          </tr>
          <tr>
            <th>Payout Amount</th>
            <td>${data.amount}</td>
          </tr>
          <tr>
            <th>Total Paid So Far</th>
            <td>${data.totalPaid}</td>
          </tr>
          <tr>
            <th>Remaining Payouts</th>
            <td>${data.remainingPayouts}</td>
          </tr>
          <tr>
            <th>Expiry Date</th>
            <td>${data.expiryDate}</td>
          </tr>
        </table>
        
        <p>Would you like to set up a new payout plan to continue receiving regular payouts?</p>
        
        <a href="https://planmoni.app/create-payout" class="button">Create New Payout Plan</a>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for wallet summary
 */
function generateWalletSummaryHtml(data: {
  firstName: string;
  period: 'daily' | 'weekly' | 'monthly';
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  deposits: { amount: string; date: string }[];
  payouts: { amount: string; date: string; plan: string }[];
  totalDeposits: string;
  totalPayouts: string;
  date: string;
}): string {
  const periodTitle = data.period === 'daily' ? 'Daily' : data.period === 'weekly' ? 'Weekly' : 'Monthly';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .summary-box { background-color: #EFF6FF; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .balance { font-size: 24px; font-weight: bold; color: #1E3A8A; margin: 10px 0; }
        .button { display: inline-block; background-color: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table, th, td { border: 1px solid #ddd; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; }
        .section-title { font-size: 18px; font-weight: bold; margin-top: 30px; color: #1E3A8A; }
        .positive { color: #22C55E; }
        .negative { color: #EF4444; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${periodTitle} Wallet Summary</h2>
        <p>${data.date}</p>
      </div>
      <div class="content">
        <p>Hello ${data.firstName},</p>
        <p>Here's a summary of your Planmoni wallet activity for the ${data.period}:</p>
        
        <div class="summary-box">
          <h3>Current Balance</h3>
          <div class="balance">${data.balance}</div>
          <p><strong>Locked Balance:</strong> ${data.lockedBalance}</p>
          <p><strong>Available Balance:</strong> ${data.availableBalance}</p>
        </div>
        
        <div class="section-title">Transaction Summary</div>
        <table>
          <tr>
            <th>Total Deposits</th>
            <td class="positive">${data.totalDeposits}</td>
          </tr>
          <tr>
            <th>Total Payouts</th>
            <td class="negative">${data.totalPayouts}</td>
          </tr>
        </table>
        
        ${data.deposits.length > 0 ? `
        <div class="section-title">Recent Deposits</div>
        <table>
          <tr>
            <th>Date</th>
            <th>Amount</th>
          </tr>
          ${data.deposits.map(deposit => `
          <tr>
            <td>${deposit.date}</td>
            <td class="positive">${deposit.amount}</td>
          </tr>
          `).join('')}
        </table>
        ` : ''}
        
        ${data.payouts.length > 0 ? `
        <div class="section-title">Recent Payouts</div>
        <table>
          <tr>
            <th>Date</th>
            <th>Plan</th>
            <th>Amount</th>
          </tr>
          ${data.payouts.map(payout => `
          <tr>
            <td>${payout.date}</td>
            <td>${payout.plan}</td>
            <td class="negative">${payout.amount}</td>
          </tr>
          `).join('')}
        </table>
        ` : ''}
        
        <a href="https://planmoni.app/transactions" class="button">View All Transactions</a>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>You can manage your email preferences in your <a href="https://planmoni.app/settings">account settings</a>.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}