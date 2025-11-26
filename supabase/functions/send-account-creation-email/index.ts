// Edge function to send account creation email
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { user_id, account_number, account_name, bank_name } = await req.json();

    if (!user_id || !account_number || !account_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, account_number, account_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = profile.email;
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = profile.first_name || "User";
    const bankName = bank_name || "SafeHaven Microfinance Bank";

    // Create email record
    const { data: emailRecord, error: insertError } = await supabase
      .from("account_creation_emails")
      .insert({
        user_id,
        account_number,
        account_name,
        bank_name: bankName,
        email_sent: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating email record:", insertError);
    }

    // Generate email HTML
    const emailHtml = generateAccountCreationEmailHtml({
      firstName,
      accountNumber: account_number,
      accountName: account_name,
      bankName,
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

    const subject = "Your Bank Account Has Been Created - Planmoni";

    // Get Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Planmoni <notifications@planmoni.com>",
        to: userEmail,
        subject,
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      // Update email record with error
      if (emailRecord?.id) {
        await supabase
          .from("account_creation_emails")
          .update({
            error_message: emailData.message || "Failed to send email",
            email_provider_response: emailData,
          })
          .eq("id", emailRecord.id);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send email",
          details: emailData,
        }),
        { status: emailResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update email record with success
    if (emailRecord?.id) {
      await supabase
        .from("account_creation_emails")
        .update({
          email_sent: true,
          sent_at: new Date().toISOString(),
          email_provider_response: emailData,
        })
        .eq("id", emailRecord.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account creation email sent successfully",
        email_record_id: emailRecord?.id,
        data: emailData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending account creation email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send account creation email",
        details: error.message || "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Email template function (inline version)
function generateAccountCreationEmailHtml(data: {
  firstName: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  date: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 32px;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          font-size: 18px;
          opacity: 0.95;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 22px;
          color: #1E3A8A;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          line-height: 1.8;
          color: #4B5563;
          margin-bottom: 30px;
        }
        .account-details {
          background-color: #F0FDF4;
          border: 2px solid #22C55E;
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
        }
        .account-details h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          color: #16A34A;
          font-weight: 600;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #D1FAE5;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #4B5563;
          font-size: 14px;
        }
        .detail-value {
          color: #1E3A8A;
          font-weight: 600;
          font-size: 14px;
          text-align: right;
        }
        .account-number {
          font-size: 24px;
          font-weight: 700;
          color: #16A34A;
          letter-spacing: 2px;
          font-family: 'Courier New', monospace;
        }
        .info-box {
          background-color: #EFF6FF;
          border-left: 4px solid #1E3A8A;
          padding: 20px;
          margin: 30px 0;
          border-radius: 5px;
        }
        .info-box p {
          margin: 0;
          font-size: 14px;
          color: #4B5563;
        }
        .cta-box {
          background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
          padding: 25px;
          border-radius: 8px;
          text-align: center;
          margin: 30px 0;
        }
        .cta-text {
          font-size: 16px;
          color: #1E3A8A;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
          color: white !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 50px;
          margin: 10px 5px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(30, 58, 138, 0.3);
        }
        .footer {
          background-color: #F9FAFB;
          padding: 30px;
          font-size: 13px;
          color: #6B7280;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        }
        .footer a {
          color: #1E3A8A;
          text-decoration: none;
        }
        .success-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">🎉</div>
          <h1>Your Bank Account Has Been Created!</h1>
          <p>Welcome to SafeHaven Microfinance Bank</p>
        </div>

        <div class="content">
          <div class="greeting">Hello ${data.firstName}! 👋</div>

          <div class="message">
            <p>Congratulations! Your SafeHaven Microfinance Bank account has been successfully created and is ready to use.</p>
            <p>You can now start depositing funds, creating payout plans, and managing your finances with Planmoni.</p>
          </div>

          <div class="account-details">
            <h3>Your Account Details</h3>
            <div class="detail-row">
              <span class="detail-label">Account Number:</span>
              <span class="detail-value account-number">${data.accountNumber}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Account Name:</span>
              <span class="detail-value">${data.accountName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Bank Name:</span>
              <span class="detail-value">${data.bankName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Account Created:</span>
              <span class="detail-value">${data.date}</span>
            </div>
          </div>

          <div class="info-box">
            <p><strong>💡 What's Next?</strong></p>
            <p style="margin-top: 10px;">Your account is now active! You can:</p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #4B5563;">
              <li>Deposit funds to your account</li>
              <li>Create automated payout plans</li>
              <li>Manage your finances with ease</li>
              <li>Access your account anytime through Planmoni</li>
            </ul>
          </div>

          <div class="cta-box">
            <div class="cta-text">Ready to get started? Add funds to your account now!</div>
            <a href="https://planmoni.com/add-funds" class="button">Add Funds</a>
            <a href="https://planmoni.com/dashboard" class="button" style="background: white; color: #1E3A8A !important; border: 2px solid #1E3A8A;">Go to Dashboard</a>
          </div>

          <div class="message">
            <p><strong>Security Reminder:</strong></p>
            <p>Please keep your account details secure. Never share your account number with unauthorized persons. If you notice any suspicious activity, contact our support team immediately.</p>
          </div>
        </div>

        <div class="footer">
          <p><strong>Planmoni</strong></p>
          <p>Your trusted partner for automated payouts and financial planning</p>
          <p style="margin-top: 20px;">
            <a href="https://planmoni.com">Visit Website</a> •
            <a href="https://planmoni.com/help">Help Center</a> •
            <a href="https://planmoni.com/contact">Contact Us</a>
          </p>
          <p style="margin-top: 20px; font-size: 11px; color: #999;">
            Planmoni Financial Services | Lagos, Nigeria<br>
            &copy; ${new Date().getFullYear()} Planmoni. All rights reserved.
          </p>
          <p style="margin-top: 15px; font-size: 11px;">
            <a href="https://planmoni.com/privacy">Privacy Policy</a> •
            <a href="https://planmoni.com/terms">Terms of Service</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

