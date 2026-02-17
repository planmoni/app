/**
 * SafeHaven Name Enquiry Edge Function
 *
 * Resolves account name via SafeHaven name-enquiry API for payout account setup.
 * Uses the authenticated user's SafeHaven token; refreshes if expired.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const safeHavenApiUrl = "https://api.safehavenmfb.com";
const safeHavenClientId = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID") || Deno.env.get("SAFEHAVEN_CLIENT_ID");
const safeHavenClientAssertion = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION") || Deno.env.get("SAFEHAVEN_CLIENT_ASSERTION");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    let body: { accountNumber?: string; bankCode?: string };
    try {
      body = (await req.json()) as { accountNumber?: string; bankCode?: string };
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return new Response(
        JSON.stringify({ error: "accountNumber and bankCode are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^\d{10}$/.test(String(accountNumber).trim())) {
      return new Response(
        JSON.stringify({ error: "accountNumber must be 10 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!safeHavenClientId || !safeHavenClientAssertion) {
      return new Response(
        JSON.stringify({ error: "SafeHaven not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokenRecord, error: tokenError } = await supabase
      .from("safehaven_tokens")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", userId)
      .single();

    let accessToken: string;

    if (tokenError || !tokenRecord) {
      // No user token: generate one with client_credentials and use it for name-enquiry (and optionally store for next time)
      console.log("No SafeHaven token for user, generating with client_credentials...");
      const ccRes = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: safeHavenClientAssertion,
          client_id: safeHavenClientId,
        }),
      });

      if (!ccRes.ok) {
        const errText = await ccRes.text();
        console.error("client_credentials failed:", ccRes.status, errText);
        return new Response(
          JSON.stringify({ error: "Could not get SafeHaven access. Please try again or link your SafeHaven account." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ccData = (await ccRes.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; token_type?: string; ibs_client_id?: string; ibs_user_id?: string; client_id?: string };
      if (!ccData.access_token) {
        return new Response(
          JSON.stringify({ error: "SafeHaven did not return an access token." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = ccData.access_token;
      // Token is used only for this request; safehaven_tokens requires NOT NULL refresh_token/ibs_* so we don't persist client_credentials tokens
    } else {
      accessToken = tokenRecord.access_token;
      const expiresAt = new Date(tokenRecord.expires_at);
      const now = new Date();
      const bufferMs = 5 * 60 * 1000;
      const needsRefresh = isNaN(expiresAt.getTime()) || expiresAt.getTime() - now.getTime() < bufferMs;

      if (needsRefresh && tokenRecord.refresh_token) {
        const refreshRes = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "refresh_token",
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            client_assertion: safeHavenClientAssertion,
            client_id: safeHavenClientId,
            refresh_token: tokenRecord.refresh_token,
          }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;
            const expiresIn = refreshData.expires_in ?? 3600;
            await supabase
              .from("safehaven_tokens")
              .update({
                access_token: refreshData.access_token,
                refresh_token: refreshData.refresh_token ?? tokenRecord.refresh_token,
                expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .then(() => {});
          }
        }
      }
    }

    const nameEnquiryRes = await fetch(`${safeHavenApiUrl}/transfers/name-enquiry`, {
      method: "POST",
      headers: {
        ClientID: safeHavenClientId,
        Authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bankCode: String(bankCode).trim(),
        accountNumber: String(accountNumber).trim(),
      }),
    });

    let nameEnquiryData: any = {};
    try {
      const text = await nameEnquiryRes.text();
      nameEnquiryData = text ? JSON.parse(text) : {};
    } catch {
      console.error("SafeHaven name-enquiry: non-JSON response", nameEnquiryRes.status);
      return new Response(
        JSON.stringify({ error: "Invalid response from bank" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!nameEnquiryRes.ok) {
      const msg = nameEnquiryData.message || nameEnquiryData.error || nameEnquiryRes.statusText || "Name enquiry failed";
      console.error("SafeHaven name-enquiry HTTP error:", nameEnquiryRes.status, msg);
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (nameEnquiryData.statusCode !== 200 || nameEnquiryData.responseCode !== "00") {
      const msg = nameEnquiryData.message || nameEnquiryData.data?.responseMessage || "Name enquiry failed";
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountName = nameEnquiryData.data?.accountName ?? null;
    if (!accountName) {
      return new Response(
        JSON.stringify({ error: "No account name in response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        accountName,
        accountNumber: nameEnquiryData.data?.accountNumber ?? String(accountNumber).trim(),
        bankCode: nameEnquiryData.data?.bankCode ?? String(bankCode).trim(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("safehaven-name-enquiry error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
