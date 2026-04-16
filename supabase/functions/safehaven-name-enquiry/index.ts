/**
 * SafeHaven Name Enquiry Edge Function
 *
 * Resolves account name via SafeHaven name-enquiry API for payout account setup.
 * Uses the user's stored SafeHaven token when valid; refreshes when near expiry.
 * If refresh fails or the API still reports an expired/restricted token, falls back
 * to client_credentials and retries (name-enquiry is allowed with app-level token).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type TokenRow = {
  access_token: string;
  expires_at: string;
  refresh_token: string | null;
};

function looksLikeSafeHavenAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("expired token") ||
    m.includes("access restricted") ||
    m.includes("invalid token") ||
    m.includes("token expired") ||
    m.includes("jwt expired") ||
    m.includes("unauthorized") ||
    m.includes("not authorized")
  );
}

async function fetchSafeHavenClientCredentialsToken(): Promise<string | null> {
  if (!safeHavenClientId || !safeHavenClientAssertion) return null;
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
    console.error("SafeHaven client_credentials failed:", ccRes.status, errText);
    return null;
  }
  const ccData = (await ccRes.json()) as { access_token?: string };
  return ccData.access_token ?? null;
}

async function refreshSafeHavenUserToken(
  db: SupabaseClient,
  userId: string,
  refreshToken: string,
): Promise<string | null> {
  if (!safeHavenClientId || !safeHavenClientAssertion) return null;
  const refreshRes = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: safeHavenClientAssertion,
      client_id: safeHavenClientId,
      refresh_token: refreshToken,
    }),
  });
  if (!refreshRes.ok) {
    const errText = await refreshRes.text();
    console.warn("SafeHaven refresh_token failed:", refreshRes.status, errText);
    return null;
  }
  const refreshData = (await refreshRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!refreshData.access_token) return null;
  const expiresIn = refreshData.expires_in ?? 3600;
  await db
    .from("safehaven_tokens")
    .update({
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token ?? refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return refreshData.access_token;
}

async function callNameEnquiry(
  accessToken: string,
  accountNumber: string,
  bankCode: string,
): Promise<
  | { ok: true; accountName: string; accountNumber: string; bankCode: string }
  | { ok: false; message: string }
> {
  const nameEnquiryRes = await fetch(`${safeHavenApiUrl}/transfers/name-enquiry`, {
    method: "POST",
    headers: {
      ClientID: safeHavenClientId!,
      Authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bankCode: String(bankCode).trim(),
      accountNumber: String(accountNumber).trim(),
    }),
  });

  let nameEnquiryData: Record<string, unknown> = {};
  try {
    const text = await nameEnquiryRes.text();
    nameEnquiryData = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    console.error("SafeHaven name-enquiry: non-JSON response", nameEnquiryRes.status);
    return { ok: false, message: "Invalid response from bank" };
  }

  const dataMsg =
    (typeof nameEnquiryData.message === "string" && nameEnquiryData.message) ||
    (typeof nameEnquiryData.error === "string" && nameEnquiryData.error) ||
    "";

  if (!nameEnquiryRes.ok) {
    const msg = dataMsg || nameEnquiryRes.statusText || "Name enquiry failed";
    return { ok: false, message: msg };
  }

  const statusCode = nameEnquiryData.statusCode as number | undefined;
  const responseCode = nameEnquiryData.responseCode as string | undefined;
  if (statusCode !== 200 || responseCode !== "00") {
    const nested = nameEnquiryData.data as { responseMessage?: string } | undefined;
    const msg =
      dataMsg ||
      (nested && typeof nested.responseMessage === "string" ? nested.responseMessage : "") ||
      "Name enquiry failed";
    return { ok: false, message: msg };
  }

  const data = nameEnquiryData.data as { accountName?: string; accountNumber?: string; bankCode?: string } | undefined;
  const accountName = data?.accountName ?? null;
  if (!accountName) {
    return { ok: false, message: "No account name in response" };
  }

  return {
    ok: true,
    accountName,
    accountNumber: data?.accountNumber ?? String(accountNumber).trim(),
    bankCode: data?.bankCode ?? String(bankCode).trim(),
  };
}

async function resolveInitialSafeHavenAccessToken(
  db: SupabaseClient,
  userId: string,
  tokenRecord: TokenRow | null,
): Promise<string | null> {
  if (!tokenRecord) {
    console.log("No SafeHaven token row for user; using client_credentials.");
    return await fetchSafeHavenClientCredentialsToken();
  }

  let accessToken = tokenRecord.access_token;
  const expiresAt = new Date(tokenRecord.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  const needsRefresh = isNaN(expiresAt.getTime()) || expiresAt.getTime() - now.getTime() < bufferMs;

  if (needsRefresh && tokenRecord.refresh_token) {
    const refreshed = await refreshSafeHavenUserToken(db, userId, tokenRecord.refresh_token);
    if (refreshed) {
      accessToken = refreshed;
    } else {
      console.log("Refresh failed or returned no token; falling back to client_credentials.");
      const cc = await fetchSafeHavenClientCredentialsToken();
      if (cc) accessToken = cc;
    }
  } else if (needsRefresh && !tokenRecord.refresh_token) {
    const cc = await fetchSafeHavenClientCredentialsToken();
    if (cc) accessToken = cc;
  }

  return accessToken;
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    let body: { accountNumber?: string; bankCode?: string };
    try {
      body = (await req.json()) as { accountNumber?: string; bankCode?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return new Response(JSON.stringify({ error: "accountNumber and bankCode are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{10}$/.test(String(accountNumber).trim())) {
      return new Response(JSON.stringify({ error: "accountNumber must be 10 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!safeHavenClientId || !safeHavenClientAssertion) {
      return new Response(JSON.stringify({ error: "SafeHaven not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from("safehaven_tokens")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", userId)
      .single();

    const tokenRecord: TokenRow | null =
      tokenError || !tokenRow
        ? null
        : {
            access_token: tokenRow.access_token as string,
            expires_at: tokenRow.expires_at as string,
            refresh_token: (tokenRow.refresh_token as string | null) ?? null,
          };

    let accessToken = await resolveInitialSafeHavenAccessToken(supabase, userId, tokenRecord);
    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "Could not get SafeHaven access. Please try again or re-link your SafeHaven account.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const acct = String(accountNumber).trim();
    const bank = String(bankCode).trim();

    let enquiry = await callNameEnquiry(accessToken, acct, bank);

    if (!enquiry.ok && looksLikeSafeHavenAuthError(enquiry.message) && tokenRecord?.refresh_token) {
      console.log("Name enquiry auth error; forcing SafeHaven refresh and retry.");
      const forced = await refreshSafeHavenUserToken(supabase, userId, tokenRecord.refresh_token);
      if (forced) {
        enquiry = await callNameEnquiry(forced, acct, bank);
      }
    }

    if (!enquiry.ok && looksLikeSafeHavenAuthError(enquiry.message)) {
      console.log("Name enquiry still failing with auth error; using client_credentials and retry.");
      const cc = await fetchSafeHavenClientCredentialsToken();
      if (cc) {
        enquiry = await callNameEnquiry(cc, acct, bank);
      }
    }

    if (!enquiry.ok) {
      console.error("SafeHaven name-enquiry failed:", enquiry.message);
      return new Response(JSON.stringify({ error: enquiry.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        accountName: enquiry.accountName,
        accountNumber: enquiry.accountNumber,
        bankCode: enquiry.bankCode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("safehaven-name-enquiry error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
