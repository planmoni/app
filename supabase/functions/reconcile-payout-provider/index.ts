/**
 * Reconcile payout provider status (SafeHaven) — cron hourly
 *
 * 1) List AP rows with provider refs due for check
 * 2) POST SafeHaven /transfers/status per row (read-only — no wallet/AP mutation)
 * 3) Classify internal vs provider mismatch
 * 4) Persist to payout_provider_checks
 * 5) Email ops on critical mismatches (6h dedup)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_TO = ["support@planmoni.com", "sebastine@planmoni.com"];
const EMAIL_DEDUP_HOURS = 6;

const SAFEHAVEN_API_URL =
  Deno.env.get("SAFEHAVEN_API_URL") || "https://api.safehavenmfb.com";
const SAFEHAVEN_CLIENT_ID =
  Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID") ||
  Deno.env.get("SAFEHAVEN_CLIENT_ID");
const SAFEHAVEN_CLIENT_ASSERTION =
  Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION") ||
  Deno.env.get("SAFEHAVEN_CLIENT_ASSERTION");

type ApRow = {
  ap_id: string;
  user_id: string;
  plan_id: string | null;
  installment_index: number | null;
  amount: number | string;
  internal_status: string;
  transfer_reference: string | null;
  payment_reference: string | null;
  session_id: string | null;
  email: string | null;
  plan_name: string | null;
};

type ProviderCheck = {
  ap_id: string;
  user_id: string;
  plan_id: string | null;
  payment_reference: string | null;
  session_id: string | null;
  internal_status: string;
  provider_status: string | null;
  provider_response_code: string | null;
  classification: string;
  severity: string;
  summary: string;
  email?: string | null;
  provider_raw: Record<string, unknown>;
  checked_at: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolvePaymentReference(row: ApRow): string | null {
  return (
    row.payment_reference ||
    (row.transfer_reference && !row.transfer_reference.startsWith("auto_payout_")
      ? row.transfer_reference
      : null)
  );
}

function classifyMismatch(
  internalStatus: string,
  httpStatus: number,
  providerStatus: string,
  providerCode: string,
  message: string
): { classification: string; severity: string; summary: string } {
  const internal = (internalStatus || "").toLowerCase();
  const provider = (providerStatus || "").trim();
  const code = (providerCode || "").trim();
  const msg = (message || "").toLowerCase();

  const providerSuccess = provider === "Completed" || code === "00";
  const providerFailed = provider === "Failed" || provider === "Reversed";
  const providerNotFound =
    httpStatus === 400 &&
    (msg.includes("unable to locate record") || msg.includes("unable to locate"));
  const providerPending =
    !providerSuccess && !providerFailed && !providerNotFound && httpStatus < 500;

  if (internal === "completed" && providerSuccess) {
    return {
      classification: "PAID_ONCE_OK",
      severity: "info",
      summary: "Internal completed and SafeHaven shows success",
    };
  }
  if (internal === "failed" && providerSuccess) {
    return {
      classification: "PAID_EXTERNALLY_OURS_FAILED",
      severity: "critical",
      summary: "SafeHaven success but our AP is failed — verify before retry/refund",
    };
  }
  if (internal === "completed" && providerNotFound) {
    return {
      classification: "NOT_PAID_PROVIDER_NOT_FOUND",
      severity: "critical",
      summary: "We marked completed but SafeHaven has no record — investigate",
    };
  }
  if (internal === "completed" && providerFailed) {
    return {
      classification: "INTERNAL_COMPLETED_PROVIDER_FAILED",
      severity: "critical",
      summary: "We marked completed but SafeHaven shows failed/reversed",
    };
  }
  if (
    (internal === "processing" || internal === "pending") &&
    providerSuccess
  ) {
    return {
      classification: "PROVIDER_SUCCESS_INTERNAL_PENDING",
      severity: "warning",
      summary: "SafeHaven success but AP still processing — may need complete_payout_installment",
    };
  }
  if (internal === "failed" && (providerFailed || providerNotFound)) {
    return {
      classification: "FAILED_AGREED",
      severity: "info",
      summary: "Failed internally and provider confirms not successful",
    };
  }
  if (providerPending) {
    return {
      classification: "PROVIDER_PENDING",
      severity: "info",
      summary: "Provider transfer still pending",
    };
  }
  if (httpStatus >= 500) {
    return {
      classification: "PROVIDER_LOOKUP_ERROR",
      severity: "warning",
      summary: `SafeHaven lookup HTTP ${httpStatus}`,
    };
  }
  return {
    classification: "UNKNOWN",
    severity: "warning",
    summary: `Unclassified: internal=${internalStatus}, provider=${provider || "n/a"}`,
  };
}

function buildProviderEmailHtml(checks: ProviderCheck[]): string {
  const critical = checks.filter((c) => c.severity === "critical");
  const trs = critical
    .map((c) => {
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(c.classification)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(c.email || "—")}</td>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-size:12px;">${escapeHtml(c.ap_id)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(c.internal_status)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(c.provider_status || "—")}</td>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-size:12px;">${escapeHtml(c.payment_reference || c.session_id || "—")}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(c.summary)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#111;">
  <h2>[Planmoni] SafeHaven payout reconciliation mismatches</h2>
  <p>${critical.length} critical provider mismatch(es). Do not auto-retry until verified.</p>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Classification</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Email</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">AP ID</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Internal</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Provider</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Ref</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Summary</th>
      </tr>
    </thead>
    <tbody>${trs}</tbody>
  </table>
  <p style="margin-top:16px;color:#555;font-size:12px;">
    Auto-generated by <code>reconcile-payout-provider</code>. Same AP set not re-emailed within ${EMAIL_DEDUP_HOURS}h.
  </p>
</body>
</html>`;
}

async function createSafeHavenToken(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  if (!SAFEHAVEN_CLIENT_ID || !SAFEHAVEN_CLIENT_ASSERTION) {
    console.error("Missing SafeHaven client credentials");
    return null;
  }

  const { data: existing } = await supabase
    .from("safehaven_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  const expiresAt = existing?.expires_at
    ? new Date(existing.expires_at).getTime()
    : 0;
  if (
    existing?.access_token &&
    expiresAt &&
    Date.now() < expiresAt - 5 * 60 * 1000
  ) {
    return existing.access_token;
  }

  const tokenRes = await fetch(`${SAFEHAVEN_API_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: SAFEHAVEN_CLIENT_ASSERTION,
      client_id: SAFEHAVEN_CLIENT_ID,
    }),
  });

  if (!tokenRes.ok) {
    console.error("SafeHaven token error:", tokenRes.status, await tokenRes.text());
    return null;
  }

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return null;

  const expiresIn = tokenData.expires_in || 3600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  if (existing) {
    await supabase
      .from("safehaven_tokens")
      .update({
        access_token: tokenData.access_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await supabase.from("safehaven_tokens").insert({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: newExpiresAt,
      ibs_client_id: SAFEHAVEN_CLIENT_ID,
      client_id: SAFEHAVEN_CLIENT_ID,
    });
  }

  return tokenData.access_token;
}

async function fetchTransferStatus(
  accessToken: string,
  sessionId: string | null,
  paymentReference: string | null
): Promise<{
  statusCode: number;
  message?: string;
  data?: { status?: string; responseCode?: string };
}> {
  const body: Record<string, string> = {};
  if (sessionId) body.sessionId = sessionId;
  else if (paymentReference) body.paymentReference = paymentReference;
  else return { statusCode: 400, message: "Missing sessionId and paymentReference" };

  const res = await fetch(`${SAFEHAVEN_API_URL}/transfers/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ClientID: SAFEHAVEN_CLIENT_ID || "",
      Authorization: `Bearer ${accessToken}`,
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: apRows, error: listError } = await supabase.rpc(
      "list_ap_for_provider_reconciliation",
      {
        p_since: "2026-08-01T00:00:00+00:00",
        p_limit: 25,
        p_recheck_hours: 24,
      }
    );
    if (listError) throw listError;

    const rows = (apRows || []) as ApRow[];
    const checks: ProviderCheck[] = [];
    let skipped = 0;

    const apIds = rows.map((r) => r.ap_id);
    const { data: existingChecks } = apIds.length
      ? await supabase
          .from("payout_provider_checks")
          .select("ap_id, classification, severity")
          .in("ap_id", apIds)
      : { data: [] };

    const existingByAp = new Map(
      (existingChecks || []).map((e) => [
        e.ap_id as string,
        e as { classification: string; severity: string },
      ])
    );

    for (const row of rows) {
      const paymentReference = resolvePaymentReference(row);
      const sessionId = row.session_id;

      if (!paymentReference && !sessionId) {
        skipped++;
        continue;
      }

      const token = await createSafeHavenToken(supabase, row.user_id);
      if (!token) {
        skipped++;
        checks.push({
          ap_id: row.ap_id,
          user_id: row.user_id,
          plan_id: row.plan_id,
          payment_reference: paymentReference,
          session_id: sessionId,
          internal_status: row.internal_status,
          provider_status: null,
          provider_response_code: null,
          classification: "NO_SAFEHAVEN_TOKEN",
          severity: "warning",
          summary: "Could not obtain SafeHaven token for provider lookup",
          provider_raw: {},
          checked_at: new Date().toISOString(),
        });
        continue;
      }

      const result = await fetchTransferStatus(token, sessionId, paymentReference);
      const providerStatus = (result.data?.status || "").trim();
      const providerCode = (result.data?.responseCode || "").trim();
      const { classification, severity, summary } = classifyMismatch(
        row.internal_status,
        result.statusCode,
        providerStatus,
        providerCode,
        result.message || ""
      );

      checks.push({
        ap_id: row.ap_id,
        user_id: row.user_id,
        plan_id: row.plan_id,
        payment_reference: paymentReference,
        session_id: sessionId,
        internal_status: row.internal_status,
        provider_status: providerStatus || null,
        provider_response_code: providerCode || null,
        classification,
        severity,
        summary,
        email: row.email,
        provider_raw: {
          http_status: result.statusCode,
          message: result.message,
          data: result.data,
          email: row.email,
          plan_name: row.plan_name,
          installment_index: row.installment_index,
          amount: row.amount,
        },
        checked_at: new Date().toISOString(),
      });
    }

    if (checks.length > 0) {
      const { error: upsertErr } = await supabase.rpc(
        "upsert_payout_provider_checks",
        { p_checks: checks }
      );
      if (upsertErr) {
        console.error("upsert_payout_provider_checks error:", upsertErr);
      }
    }

    const criticalChecks = checks.filter((c) => c.severity === "critical");
    const newCriticalChecks = criticalChecks.filter((c) => {
      const prev = existingByAp.get(c.ap_id);
      if (!prev) return true;
      if (prev.severity !== "critical") return true;
      return prev.classification !== c.classification;
    });

    let emailSent = false;
    let emailSkippedReason: string | null = null;

    if (newCriticalChecks.length > 0) {
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: SUPPORT_TO,
          subject: `[Planmoni] ${newCriticalChecks.length} new SafeHaven payout mismatch(es)`,
          html: buildProviderEmailHtml(newCriticalChecks),
        }),
      });

      if (emailRes.ok) {
        emailSent = true;
      } else {
        emailSkippedReason = `send_email_failed_${emailRes.status}`;
      }
    } else if (criticalChecks.length > 0) {
      emailSkippedReason = "no_new_critical_mismatches";
    }

    const summary = {
      success: true,
      queued: rows.length,
      checked: checks.length,
      skipped,
      critical_count: criticalChecks.length,
      new_critical_count: newCriticalChecks.length,
      email_sent: emailSent,
      email_skipped_reason: emailSkippedReason,
      classifications: checks.reduce(
        (acc, c) => {
          acc[c.classification] = (acc[c.classification] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    console.log("reconcile-payout-provider summary:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("reconcile-payout-provider error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
