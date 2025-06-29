import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email-service';
import { 
  generateLoginNotificationHtml, 
  generatePayoutNotificationHtml, 
  generateExpiryReminderHtml, 
  generateWalletSummaryHtml 
} from '@/lib/email-templates';

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

// POST endpoint to send email notifications
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get notification data from request body
    const { type, data } = await request.json();
    
    if (!type || !data) {
      return createJsonResponse({ error: 'Missing required notification details' }, 400);
    }

    // Get user profile to get first name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, email, email_notifications')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      return createJsonResponse({ error: 'Failed to retrieve user profile' }, 500);
    }

    const email = profile.email || user.email;
    const firstName = profile.first_name || 'User';
    const emailNotifications = profile.email_notifications || {
      login_alerts: true,
      payout_alerts: true,
      expiry_reminders: true,
      wallet_summary: 'weekly'
    };

    // Check if the user has enabled this type of notification
    let shouldSend = true;
    if (type === 'new_login' && !emailNotifications.login_alerts) shouldSend = false;
    if (type === 'payout_completed' && !emailNotifications.payout_alerts) shouldSend = false;
    if (type === 'plan_expiry' && !emailNotifications.expiry_reminders) shouldSend = false;
    if (type === 'wallet_summary' && emailNotifications.wallet_summary === 'never') shouldSend = false;

    if (!shouldSend) {
      return createJsonResponse({
        success: true,
        message: 'Notification skipped - user has disabled this notification type'
      });
    }

    // Generate email content based on notification type
    let subject = '';
    let html = '';

    switch (type) {
      case 'new_login':
        subject = 'New Login Detected - Planmoni';
        html = generateLoginNotificationHtml({
          firstName,
          device: data.device || 'Unknown Device',
          location: data.location || 'Unknown Location',
          time: data.time || new Date().toLocaleString(),
          ip: data.ip || 'Unknown IP'
        });
        break;
        
      case 'payout_completed':
        subject = 'Payout Successful - Planmoni';
        html = generatePayoutNotificationHtml({
          firstName,
          amount: data.amount || '₦0.00',
          planName: data.planName || 'Payout Plan',
          accountName: data.accountName || 'Your Account',
          bankName: data.bankName || 'Your Bank',
          accountNumber: data.accountNumber || '****',
          date: data.date || new Date().toLocaleDateString(),
          nextPayoutDate: data.nextPayoutDate
        });
        break;
        
      case 'plan_expiry':
        subject = 'Payout Plan Expiring Soon - Planmoni';
        html = generateExpiryReminderHtml({
          firstName,
          planName: data.planName || 'Payout Plan',
          expiryDate: data.expiryDate || 'Unknown',
          daysRemaining: data.daysRemaining || 0,
          amount: data.amount || '₦0.00',
          totalPaid: data.totalPaid || '₦0.00',
          remainingPayouts: data.remainingPayouts || 0
        });
        break;
        
      case 'wallet_summary':
        subject = `${data.period === 'daily' ? 'Daily' : data.period === 'weekly' ? 'Weekly' : 'Monthly'} Wallet Summary - Planmoni`;
        html = generateWalletSummaryHtml({
          firstName,
          period: data.period || 'daily',
          balance: data.balance || '₦0.00',
          lockedBalance: data.lockedBalance || '₦0.00',
          availableBalance: data.availableBalance || '₦0.00',
          deposits: data.deposits || [],
          payouts: data.payouts || [],
          totalDeposits: data.totalDeposits || '₦0.00',
          totalPayouts: data.totalPayouts || '₦0.00',
          date: data.date || new Date().toLocaleDateString()
        });
        break;
        
      default:
        return createJsonResponse({ error: 'Invalid notification type' }, 400);
    }

    // Send email using Resend API
    try {
      const result = await sendEmail(email, subject, html);
      
      return createJsonResponse({
        success: true,
        message: 'Email notification sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Error sending email via Resend:', error);
      return createJsonResponse({ 
        error: 'Failed to send email notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  } catch (error) {
    console.error('Error sending email notification:', error);
    return createJsonResponse({ 
      error: 'Failed to send email notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// GET endpoint to check email notification settings
export async function GET(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get user's email notification settings
    const { data, error } = await supabase
      .from('profiles')
      .select('email_notifications')
      .eq('id', user.id)
      .single();
    
    if (error) {
      return createJsonResponse({ error: 'Failed to retrieve notification settings' }, 500);
    }

    // Return notification settings
    return createJsonResponse({
      success: true,
      settings: data.email_notifications || {
        login_alerts: true,
        payout_alerts: true,
        expiry_reminders: true,
        wallet_summary: 'weekly'
      }
    });
  } catch (error) {
    console.error('Error fetching email notification settings:', error);
    return createJsonResponse({ 
      error: 'Failed to fetch email notification settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

// PUT endpoint to update email notification settings
export async function PUT(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get updated settings from request body
    const { settings } = await request.json();
    
    if (!settings) {
      return createJsonResponse({ error: 'Missing notification settings' }, 400);
    }

    // Update user's email notification settings
    const { error } = await supabase
      .from('profiles')
      .update({ email_notifications: settings })
      .eq('id', user.id);
    
    if (error) {
      return createJsonResponse({ error: 'Failed to update notification settings' }, 500);
    }

    // Return success
    return createJsonResponse({
      success: true,
      message: 'Email notification settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating email notification settings:', error);
    return createJsonResponse({ 
      error: 'Failed to update email notification settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}