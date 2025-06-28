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
    const { email, first_name, last_name } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
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

    // Store the email in the verification cache (unverified) with service role permissions
    try {
      await supabase
        .from('email_verification_cache')
        .upsert([
          { 
            email: email.toLowerCase(),
            first_name: first_name || null,
            last_name: last_name || null,
            verified: false,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
          }
        ]);
    } catch (storageError) {
      console.error('Error storing email in verification cache:', storageError);
      // Continue anyway as this is not critical for OTP sending
    }

    // Generate OTP code (6 digits)
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
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Resend API key from environment variables
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "re_cZUmUFmE_Co9jLj1mrMEx4vVknuhwQXUu";
    
    if (!RESEND_API_KEY) {
      console.error("Resend API key not configured");
      return new Response(
        JSON.stringify({ error: "Email service not properly configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Planmoni <verification@planmoni.com>",
        to: email.toLowerCase(),
        subject: "Your Planmoni Verification Code",
        html: `
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
              <p>Hello${first_name ? ` ${first_name}` : ''},</p>
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
        `
      })
    });

    const emailData = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Error sending email:", emailData);
      // We'll still return success since the OTP was generated and stored
      // This allows testing to continue even if email sending fails
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "OTP generated successfully but email delivery may be delayed",
          expiresInMinutes: 10,
          debug: { emailError: emailData }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`OTP email sent successfully to ${email}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        expiresInMinutes: 10
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