import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WelcomeEmailRequest {
  userId: string;
  email: string;
  firstName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { userId, email, firstName }: WelcomeEmailRequest = await req.json();

    if (!userId || !email || !firstName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, email, or firstName" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const htmlContent = generateWelcomeEmailHtml({ firstName, email });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Martins Osodi - Planmoni CEO <hello@planmoni.com>",
        to: email,
        subject: "🎉 Welcome to Planmoni - Your Financial Freedom Starts Here!",
        html: htmlContent,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Error from Resend API:", responseData);
      return new Response(
        JSON.stringify({
          error: "Failed to send welcome email",
          details: responseData,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Welcome email sent successfully to ${email} (User ID: ${userId})`);

    return new Response(
      JSON.stringify({
        success: true,
        id: responseData.id,
        message: "Welcome email sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send welcome email" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateWelcomeEmailHtml(data: { firstName: string; email: string }): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.8;
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
          background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
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
          margin-bottom: 20px;
        }
        .signature-box {
          background-color: #F3F4F6;
          border-left: 4px solid #1E3A8A;
          padding: 20px;
          margin: 30px 0;
          border-radius: 5px;
        }
        .signature-name {
          font-size: 18px;
          font-weight: 600;
          color: #1E3A8A;
          margin-bottom: 5px;
        }
        .signature-title {
          font-size: 14px;
          color: #6B7280;
          font-style: italic;
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
        .features {
          margin: 30px 0;
        }
        .feature-item {
          display: flex;
          align-items: start;
          margin-bottom: 20px;
        }
        .feature-icon {
          background-color: #DBEAFE;
          color: #1E3A8A;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin-right: 15px;
          flex-shrink: 0;
        }
        .feature-content h3 {
          margin: 0 0 5px 0;
          font-size: 16px;
          color: #1E3A8A;
          font-weight: 600;
        }
        .feature-content p {
          margin: 0;
          font-size: 14px;
          color: #6B7280;
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
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #1E3A8A;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to Planmoni!</h1>
          <p>Your journey to financial freedom starts here</p>
        </div>

        <div class="content">
          <div class="greeting">Hello ${data.firstName}! 👋</div>

          <div class="message">
            <p>I'm <strong>Martins Osodi</strong>, Founder and CEO of Planmoni, and I'm thrilled to personally welcome you to our community!</p>

            <p>Thank you for trusting us with your financial journey. At Planmoni, we believe that everyone deserves the freedom to control when and how they receive their money. You're not just joining an app – you're joining a movement of people who are taking control of their financial future.</p>

            <p>Whether you're saving for something special, managing your cash flow, or simply want the flexibility to access your funds on your terms, we're here to make it effortless and secure.</p>
          </div>

          <div class="features">
            <div class="feature-item">
              <div class="feature-icon">💰</div>
              <div class="feature-content">
                <h3>Flexible Payouts</h3>
                <p>Set up automated payouts on your schedule - daily, weekly, monthly, or custom dates</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">🔒</div>
              <div class="feature-content">
                <h3>Bank-Level Security</h3>
                <p>Your funds are protected with industry-leading encryption and security measures</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">📊</div>
              <div class="feature-content">
                <h3>Smart Insights</h3>
                <p>Get AI-powered insights to help you make better financial decisions</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-icon">⚡</div>
              <div class="feature-content">
                <h3>Instant Access</h3>
                <p>Emergency withdrawal options for when you need your funds immediately</p>
              </div>
            </div>
          </div>

          <div class="cta-box">
            <div class="cta-text">Ready to get started? Set up your first payout plan!</div>
            <a href="https://planmoni.com" class="button">Create Your First Plan</a>
            <a href="https://planmoni.com/help" class="button" style="background: white; color: #1E3A8A !important; border: 2px solid #1E3A8A;">Browse Help Center</a>
          </div>

          <div class="message">
            <p>If you have any questions or need assistance, our support team is always here to help. You can reach us directly through the app or reply to this email.</p>

            <p>Here's to smarter, more flexible money management!</p>
          </div>

          <div class="signature-box">
            <div class="signature-name">Martins Osodi</div>
            <div class="signature-title">Founder & CEO, Planmoni</div>
          </div>
        </div>

        <div class="footer">
          <div class="social-links">
            <a href="https://twitter.com/planmoni">Twitter</a> •
            <a href="https://instagram.com/planmoni">Instagram</a> •
            <a href="https://linkedin.com/company/planmoni">LinkedIn</a>
          </div>
          <p>You're receiving this email because you created a Planmoni account with ${data.email}</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
          <p style="margin-top: 15px; font-size: 11px;">
            Planmoni Technologies | Lagos, Nigeria<br>
            <a href="https://planmoni.com/privacy">Privacy Policy</a> •
            <a href="https://planmoni.com/terms">Terms of Service</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
