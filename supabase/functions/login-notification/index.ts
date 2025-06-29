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
    // Get request data
    const { userId, loginInfo } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get user profile information
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

    // Check if login notifications are enabled
    const emailNotifications = profile.email_notifications || {
      login_alerts: true,
      payout_alerts: true,
      expiry_reminders: true,
      wallet_summary: "weekly"
    };

    if (!emailNotifications.login_alerts) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Login notification skipped - user has disabled login alerts"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve user data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = profile.email || userData.user.email;
    const firstName = profile.first_name || "User";

    // Default login info if not provided
    const device = loginInfo?.device || "Unknown device";
    const location = loginInfo?.location || "Unknown location";
    const time = loginInfo?.time || new Date().toLocaleString();
    const ip = loginInfo?.ip || "Unknown IP";

    // Get Resend API key from environment variables
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "re_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu";
    
    if (!RESEND_API_KEY) {
      console.error("Resend API key not configured");
      return new Response(
        JSON.stringify({ error: "Email service not properly configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Planmoni <security@planmoni.com>",
        to: email,
        subject: "New Login Detected - Planmoni",
        html: generateLoginNotificationHtml({
          firstName,
          device,
          location,
          time,
          ip
        })
      })
    });

    const emailData = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Error sending email:", emailData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send login notification email",
          details: emailData
        }),
        { status: emailResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create a notification record in the events table
    const { error: eventError } = await supabase
      .from("events")
      .insert({
        user_id: userId,
        type: "security_alert",
        title: "New Login Detected",
        description: `New login from ${device} at ${time}`,
        status: "unread"
      });
    
    if (eventError) {
      console.error("Error creating notification event:", eventError);
      // Continue anyway since the email was sent successfully
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Login notification email sent successfully",
        data: emailData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Email template for login notification
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