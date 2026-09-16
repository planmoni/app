/**
 * confirm-paystack-deposit — MANUAL ops credit (service role only)
 *
 * Verifies the charge at Paystack, resolves user + credit amount, then calls
 * process_paystack_deposit once. Idempotent on reference (already_processed).
 *
 * NOT used by reconcile-deposits (that job emails only and never credits).
 *
 * POST body: { "reference": "PMN-..." }
 * Optional: { "dry_run": true } — verify + resolve only, no RPC credit
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_API = "https://api.paystack.co";

function calculatePaystackFee(amountToCredit: number): number {
  if (amountToCredit <= 0) return 0;
  const percentageFee = amountToCredit * 0.015;
  if (amountToCredit < 2500) {
    return Math.round(percentageFee * 100) / 100;
  }
  return Math.min(Math.round((percentageFee + 100) * 100) / 100, 2000);
}

function resolveCreditAmount(
  paidNaira: number,
  metadata: Record<string, unknown> | null | undefined
): { amountToCredit: number; fee: number; source: string } {
  const paid = Number(paidNaira) || 0;
  const meta = metadata && typeof metadata === "object" ? metadata : {};

  const parseNum = (v: unknown): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };

  let amountToCredit =
    parseNum(meta.amount_to_credit) ?? parseNum(meta.amountToCredit) ?? null;
  let fee = parseNum(meta.fee) ?? parseNum(meta.fees) ?? null;
  const paymentType = String(meta.payment_type || "");

  const customFields = (
    meta as { custom_fields?: Array<{ variable_name?: string; value?: unknown }> }
  ).custom_fields;
  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      if (field.variable_name === "amount_to_credit" && amountToCredit == null) {
        amountToCredit = parseNum(field.value);
      }
      if (field.variable_name === "fee" && fee == null) {
        fee = parseNum(field.value);
      }
    }
  }

  if (amountToCredit != null && amountToCredit > 0) {
    const credit = Math.min(amountToCredit, paid);
    const resolvedFee =
      fee != null ? fee : Math.max(0, Math.round((paid - credit) * 100) / 100);
    return { amountToCredit: credit, fee: resolvedFee, source: "metadata" };
  }

  // Fee-on-top checkout (PMN refs): paid = credit + fee (fee capped at 2000)
  if (paymentType === "paystack_checkout" || paid >= 2500) {
    let candidate = Math.round(((paid - 100) / 1.015) * 100) / 100;
    if (candidate > 0 && candidate < 2500) {
      candidate = Math.round((paid / 1.015) * 100) / 100;
    }
    const feeForCandidate = calculatePaystackFee(candidate);
    if (Math.abs(candidate + feeForCandidate - paid) <= 1.5) {
      return {
        amountToCredit: Math.min(candidate, paid),
        fee: feeForCandidate,
        source: "reverse_fee",
      };
    }
    // Dashboard fee often exactly 2000 on large charges
    if (paid > 2000) {
      const net = Math.round((paid - 2000) * 100) / 100;
      if (Math.abs(calculatePaystackFee(net) - 2000) < 0.01) {
        return { amountToCredit: net, fee: 2000, source: "reverse_fee_cap" };
      }
    }
  }

  return { amountToCredit: paid, fee: 0, source: "paid_in_full" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecret =
      Deno.env.get("PAYSTACK_LIVE_SECRET_KEY") ||
      Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!supabaseUrl || !serviceKey || !paystackSecret) {
      throw new Error("Missing env (SUPABASE_* or PAYSTACK_* secret)");
    }

    const auth = req.headers.get("Authorization") || "";
    if (!auth.includes(serviceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized — service role required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      reference?: string;
      dry_run?: boolean;
    };
    const reference = String(body.reference || "").trim();
    const dryRun = Boolean(body.dry_run);

    if (!reference) {
      return new Response(JSON.stringify({ error: "reference is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Already in our system?
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, user_id, amount, status, type")
      .eq("reference", reference)
      .eq("type", "deposit")
      .maybeSingle();

    if (existing?.status === "completed") {
      return new Response(
        JSON.stringify({
          success: true,
          already_processed: true,
          message: "Deposit already in transactions",
          transaction: existing,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyRes = await fetch(
      `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );
    const verifyJson = await verifyRes.json();
    const pdata = verifyJson?.data;

    if (!verifyRes.ok || !verifyJson?.status || !pdata) {
      return new Response(
        JSON.stringify({
          error: "Paystack verify failed",
          details: verifyJson,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (String(pdata.status) !== "success") {
      return new Response(
        JSON.stringify({
          error: `Paystack status is ${pdata.status}, not success`,
          paystack: {
            amount: pdata.amount,
            status: pdata.status,
            reference: pdata.reference,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paidNaira = (Number(pdata.amount) || 0) / 100;
    const metadata =
      pdata.metadata && typeof pdata.metadata === "object"
        ? (pdata.metadata as Record<string, unknown>)
        : {};
    const resolved = resolveCreditAmount(paidNaira, metadata);

    // Resolve user: metadata.user_id → email profile → paystack_accounts VA
    let userId: string | null =
      metadata.user_id != null ? String(metadata.user_id) : null;
    let resolvePath = userId ? "metadata.user_id" : null;

    if (!userId && pdata.customer?.email) {
      const email = String(pdata.customer.email).toLowerCase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();
      if (profile?.id) {
        userId = profile.id;
        resolvePath = "customer.email→profiles";
      }
    }

    if (!userId && pdata.authorization?.receiver_bank_account_number) {
      const acct = String(pdata.authorization.receiver_bank_account_number);
      const { data: pa } = await supabase
        .from("paystack_accounts")
        .select("user_id, account_number")
        .eq("account_number", acct)
        .maybeSingle();
      if (pa?.user_id) {
        userId = pa.user_id;
        resolvePath = "paystack_accounts";
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "Could not resolve user for this payment",
          paystack_paid: paidNaira,
          amount_to_credit: resolved.amountToCredit,
          fee: resolved.fee,
          credit_source: resolved.source,
          customer_email: pdata.customer?.email || null,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const plan = {
      reference,
      user_id: userId,
      resolve_path: resolvePath,
      paystack_paid: paidNaira,
      amount_to_credit: resolved.amountToCredit,
      fee: resolved.fee,
      credit_source: resolved.source,
      customer_email: pdata.customer?.email || null,
      channel: pdata.channel || null,
      dry_run: dryRun,
    };

    console.log("[confirm-paystack-deposit] plan", JSON.stringify(plan));

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, dry_run: true, plan }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: result, error } = await supabase.rpc("process_paystack_deposit", {
      arg_user_id: userId,
      arg_amount: resolved.amountToCredit,
      arg_reference: reference,
      arg_paystack_data: {
        paystack_transaction_id: pdata.id,
        paystack_reference: reference,
        processed_by: "confirm-paystack-deposit",
        processed_at: new Date().toISOString(),
        amount_paid: paidNaira,
        amount_to_credit: resolved.amountToCredit,
        fee: resolved.fee,
        credit_source: resolved.source,
        channel: pdata.channel,
        customer_email: pdata.customer?.email,
        paystack_data: pdata,
      },
    });

    if (error) {
      console.error("[confirm-paystack-deposit] RPC error", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message, plan }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!result?.success && !result?.already_processed) {
      return new Response(
        JSON.stringify({ success: false, result, plan }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        already_processed: Boolean(result?.already_processed),
        result,
        plan,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("confirm-paystack-deposit error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
