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

type SkipReason =
  | "no_payment_reference_or_session_id"
  | "no_safehaven_token"
  | "transfer_still_pending"
  | "safehaven_400_other"
  | "safehaven_http_error"
  | "already_transitioned_completed"
  | "already_transitioned_failed";

function logSkip(
  tx: PendingTransaction,
  reason: SkipReason,
  detail?: string
) {
  const parts = [
    `⏭️ SKIP transaction ${tx.id}`,
    `reason=${reason}`,
    `type=${tx.type ?? "unknown"}`,
    `amount=${tx.amount}`,
    `plan=${tx.payout_plan_id ?? "none"}`,
    `ref=${tx.reference ?? "none"}`,
  ];
  if (detail) parts.push(`detail=${detail}`);
  console.log(parts.join(" | "));
}

function logTxContext(tx: PendingTransaction, paymentReference: string | null, sessionId: string | null) {
  console.log(
    `🔍 Checking transaction ${tx.id} | type=${tx.type} | ref=${paymentReference ?? "none"} | sessionId=${sessionId ?? "none"} | plan=${tx.payout_plan_id ?? "none"}`
  );
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
    logSkip(tx, "already_transitioned_completed", "row no longer pending (webhook or prior retry run)");
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
    logSkip(tx, "already_transitioned_failed", "row no longer pending (webhook or prior retry run)");
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
    console.log(`🚀 retry-pending-safehaven-transfers: found ${txs.length} pending transaction(s)`);

    if (txs.length === 0) {
      console.log("✅ No pending transactions to check");
      return new Response(
        JSON.stringify({ ok: true, processed: 0, completed: 0, failed: 0, skipped: 0, skip_reasons: {} }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const skipReasons: Record<SkipReason, number> = {
      no_payment_reference_or_session_id: 0,
      no_safehaven_token: 0,
      transfer_still_pending: 0,
      safehaven_400_other: 0,
      safehaven_http_error: 0,
      already_transitioned_completed: 0,
      already_transitioned_failed: 0,
    };

    const bumpSkip = (reason: SkipReason) => {
      skipped++;
      skipReasons[reason]++;
    };

    for (const tx of txs) {
      const paymentReference = getPaymentReferenceFromTransaction(tx);
      const sessionId = getSessionIdFromMetadata(tx.metadata);
      logTxContext(tx, paymentReference, sessionId);

      if (!paymentReference && !sessionId) {
        bumpSkip("no_payment_reference_or_session_id");
        logSkip(
          tx,
          "no_payment_reference_or_session_id",
          "need transactions.reference or metadata.safehaven_transfer_session_id / session_id / sessionId / safehaven_transfer_code"
        );
        continue;
      }

      const token = await getSafeHavenToken(tx.user_id);
      if (!token) {
        bumpSkip("no_safehaven_token");
        logSkip(tx, "no_safehaven_token", `could not obtain token for user ${tx.user_id}`);
        continue;
      }

      const result = await fetchTransferStatus(token, sessionId, paymentReference);
      console.log(
        `📡 SafeHaven status for tx ${tx.id}: http=${result.statusCode} providerStatus=${result.data?.status ?? "n/a"} responseCode=${result.data?.responseCode ?? "n/a"} message=${result.message ?? "n/a"}`
      );

      if (result.statusCode === 200 || result.statusCode === 201) {
        const status = (result.data?.status || "").trim();
        const code = (result.data?.responseCode || "").trim();
        if (status === "Completed" || code === "00") {
          const applied = await applyCompleted(tx);
          if (applied) completed++;
          else bumpSkip("already_transitioned_completed");
        } else if (status === "Failed" || status === "Reversed") {
          const applied = await applyFailedStatusOnly(tx, result.message || status || "Transfer failed");
          if (applied) failed++;
          else bumpSkip("already_transitioned_failed");
        } else {
          bumpSkip("transfer_still_pending");
          logSkip(
            tx,
            "transfer_still_pending",
            `SafeHaven returned ${result.statusCode} but status="${status || "empty"}" responseCode="${code || "empty"}" — not final (will retry on next run)`
          );
        }
        continue;
      }

      if (result.statusCode === 400) {
        const msg = (result.message || "").toLowerCase();
        if (msg.includes("unable to locate record") || msg.includes("unable to locate")) {
          const applied = await applyFailedStatusOnly(tx, result.message || "Unable to locate record");
          if (applied) failed++;
          else bumpSkip("already_transitioned_failed");
        } else {
          bumpSkip("safehaven_400_other");
          logSkip(tx, "safehaven_400_other", result.message || "HTTP 400 without unable-to-locate message");
        }
      } else {
        bumpSkip("safehaven_http_error");
        logSkip(
          tx,
          "safehaven_http_error",
          `HTTP ${result.statusCode}: ${result.message ?? "no message"}`
        );
      }
    }

    const summary = {
      ok: true,
      processed: txs.length,
      completed,
      failed,
      skipped,
      skip_reasons: skipReasons,
    };
    console.log("EXECUTION_SUMMARY", JSON.stringify(summary));
    console.log(
      `🏁 Done — completed=${completed} failed=${failed} skipped=${skipped} | skip breakdown: ${JSON.stringify(skipReasons)}`
    );

    return new Response(
      JSON.stringify(summary),
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
