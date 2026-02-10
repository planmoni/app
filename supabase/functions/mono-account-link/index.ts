/**
 * Mono Account Link Edge Function
 *
 * Securely links a bank account using the Mono auth code (from Connect widget).
 * 1. Exchanges code for account ID (server-side, no client secret).
 * 2. Fetches account details from Mono.
 * 3. Saves to bank_accounts.
 * 4. Creates a Direct Debit mandate (pending) and returns mono_url so the user
 *    can authorize in one flow: link → authorize mandate → done.
 *
 * SECURITY: MONO_SECRET_KEY used server-side only; user must be authenticated.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MONO_API_BASE = "https://api.withmono.com";
const MONO_SECRET_KEY = Deno.env.get("MONO_SECRET_KEY");
const MAX_ACCOUNTS = 2;
const MANDATE_AMOUNT_NAIRA = 1_000_000; // Max total debit authorization

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!MONO_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return new Response(JSON.stringify({ error: "code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Exchange code for account ID
    const authRes = await fetch(`${MONO_API_BASE}/v2/accounts/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mono-sec-key": MONO_SECRET_KEY,
        accept: "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!authRes.ok) {
      const errData = await authRes.json().catch(() => ({}));
      const msg = (errData as any).message || "Failed to link account";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authData = await authRes.json();
    const monoAccountId = authData.data?.id;
    if (!monoAccountId) {
      return new Response(JSON.stringify({ error: "Invalid response from Mono" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch account details
    const accountRes = await fetch(`${MONO_API_BASE}/v2/accounts/${monoAccountId}`, {
      method: "GET",
      headers: {
        "mono-sec-key": MONO_SECRET_KEY,
        accept: "application/json",
      },
    });

    if (!accountRes.ok) {
      const errData = await accountRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: (errData as any).message || "Failed to fetch account details" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accountData = await accountRes.json();
    const monoAccount = accountData.data?.account;
    if (!monoAccount) {
      return new Response(JSON.stringify({ error: "Invalid account data from Mono" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bankName = monoAccount.institution?.name || "Unknown Bank";
    const bankCode = monoAccount.institution?.bank_code || "";
    const accountNumber = monoAccount.account_number || "";
    const accountName = monoAccount.name || "";

    // 3. Enforce max accounts
    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("user_id", user.id);
    const count = existing?.length ?? 0;
    if (count >= MAX_ACCOUNTS) {
      return new Response(
        JSON.stringify({ error: `You can link at most ${MAX_ACCOUNTS} bank accounts.` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isFirst = count === 0;

    // 4. Insert bank_account
    const { data: bankAccount, error: insertError } = await supabase
      .from("bank_accounts")
      .insert({
        user_id: user.id,
        bank_name: bankName,
        bank_code: bankCode || null,
        account_number: accountNumber,
        account_name: accountName,
        mono_account_id: monoAccountId,
        is_default: isFirst,
      })
      .select()
      .single();

    if (insertError) {
      console.error("bank_accounts insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Create mandate (pending) and get authorization URL
    let mandateId: string | null = null;
    let monoUrl: string | null = null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();

    const email = profile?.email || user.email || "";
    const firstName = profile?.first_name || user.user_metadata?.first_name || "";
    const lastName = profile?.last_name || user.user_metadata?.last_name || "";
    const customerName = `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Customer";

    if (!email) {
      return new Response(
        JSON.stringify({ success: true, bankAccount, mandate: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: mandate, error: mandateInsertError } = await supabase
      .from("mono_mandates")
      .insert({
        user_id: user.id,
        bank_account_id: bankAccount.id,
        mono_account_id: monoAccountId,
        account_name: accountName,
        account_number: accountNumber,
        bank_name: bankName,
        bank_code: bankCode || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (mandateInsertError) {
      console.error("mono_mandates insert error:", mandateInsertError);
      return new Response(
        JSON.stringify({ success: true, bankAccount, mandate: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    mandateId = mandate.id;
    const monoReference = `mandate_${user.id.slice(0, 8)}_${mandate.id.slice(0, 8)}_${Date.now()}`;
    const amountInKobo = Math.round(MANDATE_AMOUNT_NAIRA * 100);

    const mandatePayload = {
      type: "recurring-debit",
      method: "mandate",
      mandate_type: "emandate",
      debit_type: "variable",
      amount: amountInKobo,
      description: "Wallet funding – we only debit when you add funds",
      account: monoAccountId,
      reference: monoReference,
      customer: { name: customerName, email },
      metadata: {
        user_id: user.id,
        mandate_id: mandate.id,
        bank_account_id: bankAccount.id,
      },
    };

    const monoPayRes = await fetch(`${MONO_API_BASE}/v2/payments/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mono-sec-key": MONO_SECRET_KEY,
        accept: "application/json",
      },
      body: JSON.stringify(mandatePayload),
    });

    const monoPayData = await monoPayRes.json();

    if (monoPayRes.ok && monoPayData.data?.id) {
      monoUrl = monoPayData.data?.mono_url || null;
      await supabase
        .from("mono_mandates")
        .update({
          mono_mandate_id: monoPayData.data.id,
          mono_reference: monoReference,
          mono_webhook_data: monoPayData.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mandate.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        bankAccount: {
          id: bankAccount.id,
          bank_name: bankAccount.bank_name,
          account_number: bankAccount.account_number,
          account_name: bankAccount.account_name,
          mono_account_id: bankAccount.mono_account_id,
        },
        mandate: mandateId
          ? { id: mandateId, mono_url: monoUrl }
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("mono-account-link:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
