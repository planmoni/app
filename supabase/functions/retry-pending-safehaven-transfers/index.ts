/**
 * Retry Pending SafeHaven Transfers
 *
 * SafeHaven does not always send webhooks for every transfer. This function is the fallback:
 * it polls SafeHaven POST /transfers/status for transactions that are still pending
 * and updates only transaction status when the provider state is final.
 *
 * When transfer is Completed (200/201 + status "Completed" or responseCode "00"):
 *   1. Update transactions: status=completed
 *
 * When transfer is Failed/Reversed or 400 "Unable to locate record":
 *   1. Update transactions: status=failed
 *
 * NOTE: This handler intentionally does NOT modify automated_payouts, payout plans,
 * events, or wallet balances. It is transaction-status-only.
 *
 * Idempotent: only processes transactions with status='pending'; transition uses
 * a status predicate so duplicate runs do not double-apply updates.
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
const SAFEHAVEN_CLIENT_ASSERTION =
  Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION") || Deno.env.get("SAFEHAVEN_CLIENT_ASSERTION");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PendingTransaction {
  id: string;
  user_id: string;
  payout_plan_id: string | null;
  amount: number;
  reference: string | null;
  metadata: Record<string, any> | null;
  source: string | null;
  destination: string | null;
  type: string | null;
  status: string;
}

function getSessionIdFromMetadata(metadata: Record<string, any> | null): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = metadata.safehaven_transfer_session_id || metadata.session_id || metadata.sessionId;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function getPaymentReferenceFromTransaction(tx: PendingTransaction): string | null {
  const directRef = typeof tx.reference === "string" && tx.reference.trim().length > 0 ? tx.reference.trim() : null;
  if (directRef) return directRef;
  const md = tx.metadata;
  if (!md || typeof md !== "object") return null;
  const mdRef = md.safehaven_transfer_code || md.payment_reference || md.paymentReference || md.transfer_code;
  return typeof mdRef === "string" && mdRef.trim().length > 0 ? mdRef.trim() : null;
}

async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, user_id, payout_plan_id, amount, reference, metadata, source, destination, type, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending transactions:", error);
    return [];
  }

  return (data || []) as PendingTransaction[];
}

async function applyCompleted(tx: PendingTransaction): Promise<boolean> {
  const { data: transitionedRows, error } = await supabase
    .from("transactions")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", tx.id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("Failed to update transaction to completed:", error);
    throw error;
  }
  if (!transitionedRows || transitionedRows.length === 0) {
    console.log(`ℹ️ Transaction ${tx.id} already transitioned; skipping duplicate completion flow`);
    return false;
  }

  console.log(`✅ Marked transaction ${tx.id} as completed`);
  return true;
}

async function applyFailedStatusOnly(tx: PendingTransaction, reason: string): Promise<boolean> {
  const { data: transitionedRows, error } = await supabase
    .from("transactions")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
      metadata: {
        ...(tx.metadata || {}),
        retry_status_checked_at: new Date().toISOString(),
        retry_failure_reason: reason,
      },
    })
    .eq("id", tx.id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("Failed to update transaction to failed:", error);
    throw error;
  }
  if (!transitionedRows || transitionedRows.length === 0) {
    console.log(`ℹ️ Transaction ${tx.id} already transitioned; skipping duplicate failure flow`);
    return false;
  }

  console.log(`✅ Marked transaction ${tx.id} as failed`);
  return true;
}

async function createAndStoreSafeHavenToken(userId: string, existingRefreshToken: string | null = null): Promise<string | null> {
  if (!SAFEHAVEN_CLIENT_ID || !SAFEHAVEN_CLIENT_ASSERTION) {
    console.error("Missing SafeHaven client credentials in environment");
    return null;
  }

  const tokenRes = await fetch(`${SAFEHAVEN_API_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: SAFEHAVEN_CLIENT_ASSERTION,
      client_id: SAFEHAVEN_CLIENT_ID,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    console.error(`Failed to create SafeHaven token: ${tokenRes.status} ${tokenRes.statusText} ${errText}`);
    return null;
  }

  const tokenData: any = await tokenRes.json().catch(() => null);
  if (!tokenData?.access_token) {
    console.error("SafeHaven token response missing access_token");
    return null;
  }

  const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
  const expiresAtDate = new Date(Date.now() + expiresIn * 1000);
  const refreshToken = tokenData.refresh_token || existingRefreshToken || null;

  const tokenRecord: Record<string, any> = {
    user_id: userId,
    access_token: tokenData.access_token,
    refresh_token: refreshToken,
    token_type: tokenData.token_type || "Bearer",
    expires_in: expiresIn,
    expires_at: expiresAtDate.toISOString(),
    ibs_client_id: tokenData.ibs_client_id || SAFEHAVEN_CLIENT_ID || "unknown_client",
    ibs_user_id: tokenData.ibs_user_id || userId,
    client_id: tokenData.client_id || SAFEHAVEN_CLIENT_ID || "unknown_client",
    updated_at: new Date().toISOString(),
  };

  const { data: existingRow, error: existingRowError } = await supabase
    .from("safehaven_tokens")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingRowError) {
    console.error("Failed to check existing SafeHaven token row:", existingRowError);
    return null;
  }

  if (existingRow?.id) {
    const { error: updateError } = await supabase
      .from("safehaven_tokens")
      .update(tokenRecord)
      .eq("user_id", userId);
    if (updateError) {
      console.error("Failed to update SafeHaven token row:", updateError);
      return null;
    }
  } else {
    const { error: insertError } = await supabase
      .from("safehaven_tokens")
      .insert({
        ...tokenRecord,
        created_at: new Date().toISOString(),
      });
    if (insertError) {
      console.error("Failed to insert SafeHaven token row:", insertError);
      return null;
    }
  }

  return tokenData.access_token as string;
}

async function getSafeHavenToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("safehaven_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`Failed to fetch SafeHaven token for user ${userId}:`, error);
    return null;
  }

  if (!data?.access_token) {
    console.log(`No SafeHaven token row for user ${userId}; bootstrapping via client_credentials`);
    return await createAndStoreSafeHavenToken(userId, data?.refresh_token ?? null);
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const shouldRefresh = !expiresAt || Number.isNaN(expiresAt) || Date.now() >= expiresAt - 5 * 60 * 1000;
  if (shouldRefresh) {
    console.log(`SafeHaven token expired/expiring for user ${userId}; generating replacement`);
    return await createAndStoreSafeHavenToken(userId, data.refresh_token ?? null);
  }

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const txs = await getPendingTransactions();
    if (txs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, completed: 0, failed: 0, skipped: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (const tx of txs) {
      const paymentReference = getPaymentReferenceFromTransaction(tx);
      const sessionId = getSessionIdFromMetadata(tx.metadata);

      if (!paymentReference && !sessionId) {
        skipped++;
        console.log(`ℹ️ Skipping transaction ${tx.id}: no payment reference/session id`);
        continue;
      }

      const token = await getSafeHavenToken(tx.user_id);
      if (!token) {
        skipped++;
        console.warn(`No SafeHaven token for user ${tx.user_id}, skip transaction ${tx.id}`);
        continue;
      }

      const result = await fetchTransferStatus(token, sessionId, paymentReference);

      if (result.statusCode === 200 || result.statusCode === 201) {
        const status = (result.data?.status || "").trim();
        const code = (result.data?.responseCode || "").trim();
        if (status === "Completed" || code === "00") {
          const applied = await applyCompleted(tx);
          if (applied) completed++;
        } else if (status === "Failed" || status === "Reversed") {
          const applied = await applyFailedStatusOnly(tx, result.message || status || "Transfer failed");
          if (applied) failed++;
        } else {
          skipped++;
        }
        continue;
      }

      if (result.statusCode === 400) {
        const msg = (result.message || "").toLowerCase();
        if (msg.includes("unable to locate record") || msg.includes("unable to locate")) {
          const applied = await applyFailedStatusOnly(tx, result.message || "Unable to locate record");
          if (applied) failed++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: txs.length,
        completed,
        failed,
        skipped,
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
