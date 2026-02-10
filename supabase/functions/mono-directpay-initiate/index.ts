/**
 * Mono Direct Pay (Pay with Bank) - Initiate Edge Function
 *
 * Initiates a one-time Direct Pay payment. Calculates fee on top, charges
 * totalCharged to Mono, credits creditAmount to the user's wallet.
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

const MIN_AMOUNT_NAIRA = 100;
const MAX_AMOUNT_NAIRA = 5_000_000;

// ---------- Fee calculation (mirrors lib/mono-fee.ts) ----------
const FEE_RATE = 0.005;
const FEE_CAP = 500;
const STAMP_THRESHOLD = 1500;
const STAMP_DUTY = 60;
const VAT_RATE = 0.075;

function calculateFee(amountNaira: number) {
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    return { baseFee: 0, stamp: 0, subTotal: 0, vat: 0, fee: 0, totalCharged: 0 };
  }
  const baseFee = Math.min(amountNaira * FEE_RATE, FEE_CAP);
  const stamp = amountNaira >= STAMP_THRESHOLD ? STAMP_DUTY : 0;
  const subTotal = baseFee + stamp;
  const vat = subTotal * VAT_RATE;
  const fee = Math.round((subTotal + vat) * 100) / 100;
  const totalCharged = Math.round((amountNaira + fee) * 100) / 100;
  return { baseFee: Math.round(baseFee * 100) / 100, stamp, subTotal: Math.round(subTotal * 100) / 100, vat: Math.round(vat * 100) / 100, fee, totalCharged };
}
// ---------------------------------------------------------------

interface InitiateRequest {
  creditAmount: number; // Naira – the amount the user wants credited to their wallet
  redirect_url?: string;
}

function generateReference(userId: string): string {
  const short = userId.replace(/-/g, "").slice(0, 8);
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `DP_${short}_${ts}_${r}`;
}

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
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: InitiateRequest = await req.json();
    const creditAmount = Number(body.creditAmount);
    if (!Number.isFinite(creditAmount) || creditAmount < MIN_AMOUNT_NAIRA || creditAmount > MAX_AMOUNT_NAIRA) {
      return new Response(
        JSON.stringify({
          error: `Amount must be between ₦${MIN_AMOUNT_NAIRA.toLocaleString()} and ₦${MAX_AMOUNT_NAIRA.toLocaleString()}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side fee recalculation
    const { fee, totalCharged } = calculateFee(creditAmount);

    const reference = generateReference(user.id);
    const redirectUrl = typeof body.redirect_url === "string" && body.redirect_url.trim() ? body.redirect_url.trim() : undefined;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();

    const firstName = profile?.first_name || user.user_metadata?.first_name || "";
    const lastName = profile?.last_name || user.user_metadata?.last_name || "";
    const email = profile?.email || user.email || "";
    const customerName = `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Customer";

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // amount = what gets credited; fee & total_charged stored for verification
    const { error: insertError } = await supabase.from("mono_directpay_payments").insert({
      user_id: user.id,
      reference,
      amount: creditAmount,
      fee,
      total_charged: totalCharged,
      status: "pending",
      redirect_url: redirectUrl || null,
    });

    if (insertError) {
      console.error("mono_directpay_payments insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mono expects the total in kobo (amount + fee)
    const totalChargedKobo = Math.round(totalCharged * 100);
    const payload: Record<string, unknown> = {
      amount: totalChargedKobo,
      type: "onetime-debit",
      method: "account",
      description: `Wallet funding ₦${creditAmount.toLocaleString()}`,
      reference,
      customer: { name: customerName, email },
    };
    if (redirectUrl) payload.redirect_url = redirectUrl;

    const monoResponse = await fetch(`${MONO_API_BASE}/v2/payments/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mono-sec-key": MONO_SECRET_KEY!,
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const monoData = await monoResponse.json();

    if (!monoResponse.ok) {
      console.error("Mono initiate error:", monoData);
      await supabase
        .from("mono_directpay_payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("reference", reference);
      return new Response(
        JSON.stringify({
          error: monoData.message || monoData.error || "Failed to initiate payment",
          details: monoData,
        }),
        { status: monoResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const monoUrl = monoData.data?.mono_url;
    const monoPaymentId = monoData.data?.id;

    if (!monoUrl) {
      return new Response(JSON.stringify({ error: "Invalid response from Mono" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (monoPaymentId) {
      await supabase
        .from("mono_directpay_payments")
        .update({ mono_payment_id: monoPaymentId, updated_at: new Date().toISOString() })
        .eq("reference", reference);
    }

    return new Response(
      JSON.stringify({ success: true, mono_url: monoUrl, reference, fee, totalCharged }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("mono-directpay-initiate error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
