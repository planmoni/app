// Follow Deno's ES modules convention
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the request method
    const method = req.method;
    
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = userData.user.id;
    
    // GET: Fetch notification settings
    if (method === "GET") {
      const { data, error } = await supabase
        .from("profiles")
        .select("email_notifications")
        .eq("id", userId)
        .single();
      
      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve notification settings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          settings: data.email_notifications || {
            login_alerts: true,
            payout_alerts: true,
            expiry_reminders: true,
            wallet_summary: "weekly"
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // PUT: Update notification settings
    if (method === "PUT") {
      const { settings } = await req.json();
      
      if (!settings) {
        return new Response(
          JSON.stringify({ error: "Missing notification settings" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { error } = await supabase
        .from("profiles")
        .update({ email_notifications: settings })
        .eq("id", userId);
      
      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to update notification settings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email notification settings updated successfully"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // POST: Send notification email
    if (method === "POST") {
      const { type, data } = await req.json();
      
      if (!type || !data) {
        return new Response(
          JSON.stringify({ error: "Missing required notification details" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Get user profile to get first name and email preferences
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, email, email_notifications")
        .eq("id", userId)
        .single();
      
      if (profileError) {
        return new Response(
          JSON.stringify({ error: "Failed to retrieve user profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const email = profile.email || userData.user.email;
      const firstName = profile.first_name || "User";
      const emailNotifications = profile.email_notifications || {
        login_alerts: true,
        payout_alerts: true,
        expiry_reminders: true,
        wallet_summary: "weekly"
      };
      
      // Check if the user has enabled this type of notification
      let shouldSend = true;
      if (type === "new_login" && !emailNotifications.login_alerts) shouldSend = false;
      if (type === "payout_completed" && !emailNotifications.payout_alerts) shouldSend = false;
      if (type === "plan_expiry" && !emailNotifications.expiry_reminders) shouldSend = false;
      if (type === "wallet_summary" && emailNotifications.wallet_summary === "never") shouldSend = false;
      
      if (!shouldSend) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Notification skipped - user has disabled this notification type"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Get Resend API key from environment variables
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "re_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu";
      
      if (!RESEND_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Email service not properly configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Generate email content based on notification type
      let subject = "";
      let html = "";
      
      switch (type) {
        case "new_login":
          subject = "New Login Detected - Planmoni";
          html = generateLoginNotificationHtml({
            firstName,
            device: data.device || "Unknown Device",
            location: data.location || "Unknown Location",
            time: data.time || new Date().toLocaleString(),
            ip: data.ip || "Unknown IP"
          });
          break;
          
        case "payout_completed":
          subject = "Payout Successful - Planmoni";
          html = generatePayoutNotificationHtml({
            firstName,
            amount: data.amount || "₦0.00",
            planName: data.planName || "Payout Plan",
            accountName: data.accountName || "Your Account",
            bankName: data.bankName || "Your Bank",
            accountNumber: data.accountNumber || "****",
            date: data.date || new Date().toLocaleDateString(),
            nextPayoutDate: data.nextPayoutDate
          });
          break;
          
        case "plan_expiry":
          subject = "Payout Plan Expiring Soon - Planmoni";
          html = generateExpiryReminderHtml({
            firstName,
            planName: data.planName || "Payout Plan",
            expiryDate: data.expiryDate || "Unknown",
            daysRemaining: data.daysRemaining || 0,
            amount: data.amount || "₦0.00",
            totalPaid: data.totalPaid || "₦0.00",
            remainingPayouts: data.remainingPayouts || 0
          });
          break;
          
        case "wallet_summary":
          subject = `${data.period === "daily" ? "Daily" : data.period === "weekly" ? "Weekly" : "Monthly"} Wallet Summary - Planmoni`;
          html = generateWalletSummaryHtml({
            firstName,
            period: data.period || "daily",
            balance: data.balance || "₦0.00",
            lockedBalance: data.lockedBalance || "₦0.00",
            availableBalance: data.availableBalance || "₦0.00",
            deposits: data.deposits || [],
            payouts: data.payouts || [],
            totalDeposits: data.totalDeposits || "₦0.00",
            totalPayouts: data.totalPayouts || "₦0.00",
            date: data.date || new Date().toLocaleDateString()
          });
          break;
          
        default:
          return new Response(
            JSON.stringify({ error: "Invalid notification type" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }
      
      // Send email using Resend API
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Planmoni <notifications@planmoni.com>",
            to: email,
            subject: subject,
            html: html
          })
        });
        
        const emailData = await emailResponse.json();
        
        if (!emailResponse.ok) {
          console.error("Error sending email:", emailData);
          return new Response(
            JSON.stringify({ 
              error: "Failed to send email notification",
              details: emailData
            }),
            { status: emailResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            message: "Email notification sent successfully",
            data: emailData
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Error sending email:", error);
        return new Response(
          JSON.stringify({ 
            error: "Failed to send email notification",
            details: error.message || "Unknown error"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // If we get here, the method is not supported
    return new Response(
      JSON.stringify({ error: `Method ${method} not allowed` }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Email template generators
function generateLoginNotificationHtml(data: {
  firstName: string;
  device: string;
  location: string;
  time: string;
  ip: string;
}) {
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
        
        <a href="https://planmoni.com/change-password" class="button">Secure Your Account</a>
        
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

function generatePayoutNotificationHtml(data: {
  firstName: string;
  amount: string;
  planName: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  date: string;
  nextPayoutDate?: string;
}) {
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
        
        <a href="https://planmoni.com/transactions" class="button">View Transaction Details</a>
        
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

function generateExpiryReminderHtml(data: {
  firstName: string;
  planName: string;
  expiryDate: string;
  daysRemaining: number;
  amount: string;
  totalPaid: string;
  remainingPayouts: number;
}) {
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
        
        <a href="https://planmoni.com/create-payout" class="button">Create New Payout Plan</a>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

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
}) {
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
        
        <a href="https://planmoni.com/transactions" class="button">View All Transactions</a>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply directly to this email.</p>
        <p>You can manage your email preferences in your <a href="https://planmoni.com/settings">account settings</a>.</p>
        <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}