/**
 * Retry Pending SafeHaven Transfers
 *
 * SafeHaven does not always send webhooks for every transfer. This function is the fallback:
 * it polls SafeHaven POST /transfers/status for automated_payouts that are still
 * pending/processing and updates our DB so the plan advances even when the webhook never fires.
 *
 * When transfer is Completed (200/201 + status "Completed" or responseCode "00"):
 *   1. Update automated_payouts: status=completed, completed_at, transferred_at
 *   2. Update transactions: status=completed
 *   3. Call update_payout_plan_progress(plan_id) so next_payout_date and completed_payouts advance
 *   4. Insert events (in-app payout_completed notification)
 *
 * When transfer is Failed/Reversed or 400 "Unable to locate record":
 *   1. Update automated_payouts: status=failed, error_message, completed_at
 *   2. Update transactions: status=failed
 *   3. Call credit_back_payout_failure(user_id, amount)
 *   4. Insert events (disbursement_failed notification)
 *
 * Idempotent: only processes status IN ('pending','processing'); after update they are no longer picked.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SAFEHAVEN_API_URL =
  Deno.env.get("SAFEHAVEN_API_URL") || "https://api.safehavenmfb.com";
const SAFEHAVEN_CLIENT_ID =
  Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID") || Deno.env.get("SAFEHAVEN_CLIENT_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PendingPayout {
  id: string;
  user_id: string;
  payout_plan_id: string;
  amount: number;
  payment_reference: string | null;
  session_id: string | null;
  status: string;
}

async function getPendingSafeHavenPayouts(): Promise<PendingPayout[]> {
  const { data, error } = await supabase
    .from("automated_payouts")
    .select("id, user_id, payout_plan_id, amount, payment_reference, session_id, status")
    .in("status", ["pending", "processing"])
    .or("session_id.not.is.null,payment_reference.not.is.null");

  if (error) {
    console.error("Error fetching pending payouts:", error);
    return [];
  }

  return (data || []) as PendingPayout[];
}

async function getSafeHavenToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("safehaven_tokens")
    .select("access_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data?.access_token) return null;
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt && Date.now() >= expiresAt - 5 * 60 * 1000) return null;
  return data.access_token;
}

async function fetchTransferStatus(
  accessToken: string,
  sessionId: string | null,
  paymentReference: string | null
): Promise<{ statusCode: number; message?: string; data?: { status?: string; responseCode?: string } }> {
  const body: Record<string, string> = {};
  if (sessionId) body.sessionId = sessionId;
  else if (paymentReference) body.paymentReference = paymentReference;
  else return { statusCode: 400, message: "Missing sessionId and paymentReference" };

  const res = await fetch(`${SAFEHAVEN_API_URL}/transfers/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ClientID": SAFEHAVEN_CLIENT_ID || "",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  return {
    statusCode: res.status,
    message: json.message,
    data: json.data,
  };
}

async function applyCompleted(
  payout: PendingPayout,
  transferData: { status?: string; responseCode?: string; paymentReference?: string }
) {
  const paymentRef = transferData.paymentReference || payout.payment_reference || "";

  // 1. Mark automated_payout as completed (so webhook + retry never double-process)
  const { error: payoutUpdateError } = await supabase
    .from("automated_payouts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      transferred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id);

  if (payoutUpdateError) {
    console.error("Failed to update automated_payout:", payoutUpdateError);
    throw payoutUpdateError;
  }

  // 2. Mark transaction completed
  await supabase
    .from("transactions")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("reference", paymentRef)
    .eq("user_id", payout.user_id);

  // 3. Advance plan (next_payout_date, completed_payouts, status)
  const { data: plan } = await supabase
    .from("payout_plans")
    .select("id, name, payout_amount")
    .eq("id", payout.payout_plan_id)
    .single();

  if (plan) {
    await supabase.rpc("update_payout_plan_progress", { p_plan_id: payout.payout_plan_id });

    // 4. In-app notification
    await supabase.from("events").insert({
      user_id: payout.user_id,
      type: "payout_completed",
      title: "Payout Completed",
      description: `Your payout of ₦${Number(plan.payout_amount).toLocaleString()} from "${plan.name}" has been processed successfully.`,
      status: "unread",
      payout_plan_id: plan.id,
    });
  }

  console.log(`✅ Marked payout ${payout.id} and transaction as completed`);
}

async function applyFailedAndCreditBack(
  payout: PendingPayout,
  reason: string
) {
  const paymentRef = payout.payment_reference || "";

  await supabase
    .from("automated_payouts")
    .update({
      status: "failed",
      error_message: reason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id);

  await supabase
    .from("transactions")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("reference", paymentRef)
    .eq("user_id", payout.user_id);

  const { error: creditError } = await supabase.rpc("credit_back_payout_failure", {
    arg_user_id: payout.user_id,
    arg_amount: Number(payout.amount),
  });

  if (creditError) {
    console.error("credit_back_payout_failure error:", creditError);
  }

  const { data: plan } = await supabase
    .from("payout_plans")
    .select("id, name")
    .eq("id", payout.payout_plan_id)
    .single();

  if (plan) {
    await supabase.from("events").insert({
      user_id: payout.user_id,
      type: "disbursement_failed",
      title: "Payout Failed",
      description: `Your scheduled payout from "${plan.name}" failed: ${reason}. The amount has been returned to your wallet.`,
      status: "unread",
      payout_plan_id: plan.id,
    });
  }

  console.log(`✅ Marked payout ${payout.id} as failed and credited back ₦${payout.amount}`);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const payouts = await getPendingSafeHavenPayouts();
    if (payouts.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, completed: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let completed = 0;
    let failed = 0;

    for (const payout of payouts) {
      const token = await getSafeHavenToken(payout.user_id);
      if (!token) {
        console.warn(`No SafeHaven token for user ${payout.user_id}, skip payout ${payout.id}`);
        continue;
      }

      const result = await fetchTransferStatus(
        token,
        payout.session_id,
        payout.payment_reference
      );

      if (result.statusCode === 200 || result.statusCode === 201) {
        const status = (result.data?.status || "").trim();
        const code = (result.data?.responseCode || "").trim();
        if (status === "Completed" || code === "00") {
          await applyCompleted(payout, {
            status: result.data?.status,
            responseCode: result.data?.responseCode,
            paymentReference: payout.payment_reference || undefined,
          });
          completed++;
        } else if (status === "Failed" || status === "Reversed") {
          await applyFailedAndCreditBack(
            payout,
            result.message || status || "Transfer failed"
          );
          failed++;
        }
        continue;
      }

      if (result.statusCode === 400) {
        const msg = (result.message || "").toLowerCase();
        if (msg.includes("unable to locate record") || msg.includes("unable to locate")) {
          await applyFailedAndCreditBack(payout, result.message || "Unable to locate record");
          failed++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: payouts.length,
        completed,
        failed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("retry-pending-safehaven-transfers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
