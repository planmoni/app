/**
 * Retry Pending Mono DirectPay Payments
 *
 * Mono does not always send webhooks for every payment. This function is the fallback:
 * it polls Mono GET /v2/payments/verify/{reference} for mono_directpay_payments that are
 * still pending and updates our DB + credits the wallet when the payment is successful.
 *
 * When Mono returns status "successful":
 *   1. Call process_mono_deposit (idempotent) to credit wallet, create transaction, event
 *   2. Update mono_directpay_payments: status = 'successful'
 *
 * When Mono returns status "failed" or 404 "Invalid reference, payment not found":
 *   Update mono_directpay_payments: status = 'failed'
 *
 * When Mono returns abandoned/cancelled:
 *   Update mono_directpay_payments: status = 'abandoned' | 'cancelled'
 *
 * Idempotent: only processes status = 'pending'; after update they are no longer picked.
 * Optional: limit to payments created in the last 7 days and max 50 per run for speed and rate limits.
 *
 * @see https://docs.mono.co/api/directpay/verify
 * @see https://api.withmono.com/v2/payments/verify/{reference}
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MONO_API_BASE = "https://api.withmono.com";
const MONO_SECRET_KEY = Deno.env.get("MONO_SECRET_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Max pending payments to process per run (avoid rate limits and timeouts) */
const MAX_PER_RUN = 50;

/** Only consider payments created at least this many minutes ago (avoid racing with redirect) */
const MIN_AGE_MINUTES = 2;

interface PendingPayment {
  id: string;
  user_id: string;
  reference: string;
  amount: number;
  fee?: number | null;
  total_charged?: number | null;
  status: string;
}

async function getPendingMonoDirectPayPayments(): Promise<PendingPayment[]> {
  const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000).toISOString();
  console.log("[retry-mono-directpay] Fetching pending payments created before", cutoff, "limit", MAX_PER_RUN);
  const { data, error } = await supabase
    .from("mono_directpay_payments")
    .select("id, user_id, reference, amount, fee, total_charged, status")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[retry-mono-directpay] Error fetching pending payments:", error.message, error);
    return [];
  }
  const list = (data || []) as PendingPayment[];
  console.log("[retry-mono-directpay] Found", list.length, "pending payment(s):", list.map((p) => p.reference));
  return list;
}

/** Verify payment with Mono API. Returns parsed status and amount; success: false on HTTP error or not found. */
async function verifyPaymentWithMono(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  monoPaymentId?: string;
  error?: string;
  notFound?: boolean;
}> {
  if (!MONO_SECRET_KEY) {
    console.warn("[retry-mono-directpay] MONO_SECRET_KEY not set");
    return { success: false, error: "MONO_SECRET_KEY not configured" };
  }
  try {
    const url = `${MONO_API_BASE}/v2/payments/verify/${reference}`;
    console.log("[retry-mono-directpay] Verifying with Mono:", url);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "mono-sec-key": MONO_SECRET_KEY,
        accept: "application/json",
        "content-type": "application/json",
      },
    });

    const raw = await res.json().catch(() => ({}));
    const message = (raw as { message?: string }).message;
    const data = (raw as { data?: { id?: string; status?: string; amount?: number } }).data;

    if (!res.ok) {
      const notFound =
        res.status === 404 ||
        (typeof message === "string" && message.toLowerCase().includes("invalid reference"));
      console.log("[retry-mono-directpay] Mono verify failed for", reference, "status", res.status, "message", message, "notFound", notFound);
      return {
        success: false,
        error: message || `Verify failed (${res.status})`,
        notFound,
      };
    }

    if (!data) {
      console.warn("[retry-mono-directpay] Mono response has no data for", reference, "raw", JSON.stringify(raw));
      return { success: false, error: "No data in response" };
    }

    const status = (data.status || "").toLowerCase();
    console.log("[retry-mono-directpay] Mono verify OK for", reference, "status", data.status, "amount", data.amount);
    return {
      success: true,
      status: data.status,
      amount: data.amount,
      monoPaymentId: (data as { id?: string }).id,
    };
  } catch (e) {
    console.error("[retry-mono-directpay] verifyPaymentWithMono error for", reference, e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Verify error",
    };
  }
}

/** Generate deposit email HTML (same shape as check-new-transactions). */
function generateDepositEmailHtml(data: {
  firstName: string;
  amount: string;
  accountNumber: string;
  date: string;
  reference: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Funds Received - Planmoni</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .amount { font-size: 32px; font-weight: bold; color: #059669; text-align: center; margin: 20px 0; }
    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { color: #111827; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Funds Received!</h1>
      <p>Hello ${data.firstName}, money has been added to your Planmoni wallet</p>
    </div>
    <div class="content">
      <div class="amount">${data.amount}</div>
      <div class="details">
        <div class="detail-row"><span class="label">Source:</span><span class="value">Mono DirectPay</span></div>
        <div class="detail-row"><span class="label">Date & Time:</span><span class="value">${data.date}</span></div>
        <div class="detail-row"><span class="label">Reference:</span><span class="value">${data.reference}</span></div>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Your funds are now available in your wallet.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from Planmoni</p>
    </div>
  </div>
</body>
</html>`;
}

async function applySuccessful(payment: PendingPayment, monoPaymentId?: string) {
  const amountNaira = Number(payment.amount);
  const paymentRef = payment.reference;

  console.log("[retry-mono-directpay] Calling process_mono_deposit for", paymentRef, "user_id", payment.user_id, "amount", amountNaira);
  const { data: result, error: rpcError } = await supabase.rpc("process_mono_deposit", {
    arg_user_id: payment.user_id,
    arg_amount: amountNaira,
    arg_reference: payment.reference,
    arg_mono_data: {
      source: "mono_directpay",
      mono_payment_id: monoPaymentId || payment.reference,
      mono_reference: payment.reference,
      processed_by: "retry_pending_mono_directpay",
      processed_at: new Date().toISOString(),
    },
  });

  console.log("[retry-mono-directpay] process_mono_deposit result for", paymentRef, "result=", JSON.stringify(result), "rpcError=", rpcError?.message ?? null);

  if (rpcError) {
    console.error("[retry-mono-directpay] process_mono_deposit RPC error:", rpcError.message, rpcError);
    throw rpcError;
  }

  const credited = result && (result.success === true || result.already_processed === true);
  if (!credited) {
    console.warn("[retry-mono-directpay] process_mono_deposit did not return success/already_processed for", paymentRef, "result=", result);
    return;
  }

  const { error: updateErr } = await supabase
    .from("mono_directpay_payments")
    .update({ status: "successful", updated_at: new Date().toISOString() })
    .eq("reference", payment.reference);

  if (updateErr) {
    console.error("[retry-mono-directpay] Failed to update mono_directpay_payments:", updateErr.message);
    throw updateErr;
  }
  console.log("[retry-mono-directpay] ✅ Credited and marked successful:", paymentRef, "₦" + amountNaira);

  const walletAmount = amountNaira;

  // Send push notification for successful deposit
  try {
    await supabase.rpc("send_push_notification", {
      p_user_id: payment.user_id,
      p_title: "Funds Received",
      p_body: `₦${walletAmount.toLocaleString()} has been added to your wallet`,
      p_data: {
        type: "deposit_successful",
        transaction_reference: paymentRef,
        amount: walletAmount,
        source: "Mono DirectPay",
      },
    });
    console.log("[retry-mono-directpay] Push notification sent for", paymentRef);
  } catch (pushError) {
    console.warn("[retry-mono-directpay] Error sending push notification:", pushError);
  }

  // Send email notification via send-email Edge Function
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("id", payment.user_id)
      .single();

    if (profile?.email) {
      const emailHtml = generateDepositEmailHtml({
        firstName: profile.first_name || "User",
        amount: `₦${walletAmount.toLocaleString()}`,
        accountNumber: "Mono DirectPay",
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        reference: paymentRef,
      });
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: profile.email,
          subject: "Funds Received - Planmoni",
          html: emailHtml,
        }),
      });
      if (emailRes.ok) {
        console.log("[retry-mono-directpay] Email sent to", profile.email, "for", paymentRef);
      } else {
        const errText = await emailRes.text();
        console.warn("[retry-mono-directpay] send-email failed:", emailRes.status, errText);
      }
    } else {
      console.log("[retry-mono-directpay] No email for user", payment.user_id);
    }
  } catch (emailErr) {
    console.warn("[retry-mono-directpay] Error sending email:", emailErr);
  }
}

async function applyTerminalStatus(payment: PendingPayment, status: "failed" | "abandoned" | "cancelled") {
  const { error } = await supabase
    .from("mono_directpay_payments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("reference", payment.reference)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to update mono_directpay_payments to", status, error);
    return;
  }
  console.log(`✅ Mono DirectPay marked ${status}: ${payment.reference}`);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log("[retry-mono-directpay] Run started at", new Date().toISOString());

  try {
    if (!MONO_SECRET_KEY) {
      console.error("[retry-mono-directpay] MONO_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "MONO_SECRET_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payments = await getPendingMonoDirectPayPayments();
    if (payments.length === 0) {
      console.log("[retry-mono-directpay] No pending payments to process");
      return new Response(
        JSON.stringify({ ok: true, processed: 0, completed: 0, failed: 0, abandoned: 0, cancelled: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let completed = 0;
    let failed = 0;
    let abandoned = 0;
    let cancelled = 0;

    for (const payment of payments) {
      console.log("[retry-mono-directpay] Processing", payment.reference, "user_id=", payment.user_id, "amount=", payment.amount);
      const verification = await verifyPaymentWithMono(payment.reference);

      if (!verification.success) {
        if (verification.notFound) {
          await applyTerminalStatus(payment, "failed");
          failed++;
        } else {
          console.log("[retry-mono-directpay] Skip (verify failed, not notFound):", payment.reference, verification.error);
        }
        continue;
      }

      const status = (verification.status || "").toLowerCase();
      if (status === "successful" || status === "success") {
        const totalCharged = payment.total_charged != null ? Number(payment.total_charged) : null;
        if (verification.amount != null && totalCharged != null) {
          const monoKobo =
            verification.amount >= 10000
              ? Math.round(verification.amount)
              : Math.round(verification.amount * 100);
          const expectedKobo = Math.round(totalCharged * 100);
          if (monoKobo !== expectedKobo) {
            console.warn(
              "[retry-mono-directpay] Mono amount mismatch (crediting anyway):",
              payment.reference,
              "expectedKobo=",
              expectedKobo,
              "monoKobo=",
              monoKobo
            );
          }
        }
        try {
          await applySuccessful(payment, verification.monoPaymentId);
          completed++;
        } catch (applyErr) {
          console.error("[retry-mono-directpay] applySuccessful failed for", payment.reference, applyErr);
          // Don't increment completed; payment stays pending for next run
        }
      } else if (status === "failed") {
        await applyTerminalStatus(payment, "failed");
        failed++;
      } else if (status === "abandoned") {
        await applyTerminalStatus(payment, "abandoned");
        abandoned++;
      } else if (status === "cancelled") {
        await applyTerminalStatus(payment, "cancelled");
        cancelled++;
      } else {
        console.log("[retry-mono-directpay] Unknown Mono status for", payment.reference, "status=", status);
      }
    }

    const summary = { ok: true, processed: payments.length, completed, failed, abandoned, cancelled };
    console.log("[retry-mono-directpay] Run finished:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[retry-mono-directpay] Fatal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
