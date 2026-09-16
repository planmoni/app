/**
 * Deposit reconciliation (cron hourly) — EMAIL ONLY
 *
 * Does NOT credit wallets, call process_paystack_deposit, or update balances.
 * Alerts ops when:
 *  1) Paystack: recent success charges vs our deposit rows (missing / amount mismatch)
 *  2) SafeHaven: logged webhooks with wallet_credited = false
 *
 * Amount check (Paystack):
 *  - paystack_paid = Paystack amount/100 (what entered Paystack)
 *  - our_credited  = transactions.amount (what we recorded as deposit)
 *  - expected_credit from metadata.amount_to_credit when present
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
const LOOKBACK_HOURS = 48;
const PAYSTACK_LIST_PER_PAGE = 50;
const PAYSTACK_LIST_MAX_PAGES = 3;
const VERIFY_OUR_DEPOSITS_LIMIT = 40;

const PAYSTACK_API = "https://api.paystack.co";

type Finding = {
  finding_key: string;
  rail: "paystack" | "safehaven";
  signal: string;
  severity: "warning" | "critical";
  reference: string;
  user_id: string | null;
  email: string | null;
  paystack_paid: number | null;
  our_credited: number | null;
  expected_credit: number | null;
  summary: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNaira(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(n);
}

function sortedFindingKey(keys: string[]): string {
  return [...keys].sort().join("|");
}

function parseMetaAmount(meta: Record<string, unknown> | null | undefined): number | null {
  if (!meta || typeof meta !== "object") return null;
  const raw =
    meta.amount_to_credit ??
    meta.amountToCredit ??
    (meta as { custom_fields?: Array<{ variable_name?: string; value?: unknown }> }).custom_fields
      ?.find((f) => f.variable_name === "amount_to_credit")?.value;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

async function sendSupportEmail(
  supabaseUrl: string,
  serviceKey: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; status?: number; errText?: string }> {
  const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      to: SUPPORT_TO,
      subject,
      html,
    }),
  });

  if (emailRes.ok) return { ok: true };
  return { ok: false, status: emailRes.status, errText: await emailRes.text() };
}

function buildEmailHtml(findings: Finding[]): string {
  const critical = findings.filter((f) => f.severity === "critical");
  const warning = findings.filter((f) => f.severity === "warning");
  const rows = findings
    .map(
      (f) => `<tr>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(f.severity)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(f.rail)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(f.signal)}</td>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-size:12px;">${escapeHtml(f.reference)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(f.email || f.user_id || "—")}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(formatNaira(f.paystack_paid))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(formatNaira(f.our_credited))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(formatNaira(f.expected_credit))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(f.summary)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#111;">
  <h2>[Planmoni] Deposit reconciliation (alert only — no auto-fix)</h2>
  <p>${critical.length} critical, ${warning.length} warning. Investigate manually; do not double-credit.</p>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Severity</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Rail</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Signal</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Reference</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">User</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Paystack paid</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Our credited</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Expected credit</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Summary</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:16px;color:#555;font-size:12px;">
    Auto-generated by <code>reconcile-deposits</code>. Same finding set is not re-emailed within ${EMAIL_DEDUP_HOURS} hours.
    This job never credits wallets.
  </p>
</body>
</html>`;
}

async function paystackGet(
  secret: string,
  path: string
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${PAYSTACK_API}${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
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

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!paystackSecret) {
      throw new Error("Missing PAYSTACK_LIVE_SECRET_KEY / PAYSTACK_SECRET_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const sinceIso = new Date(
      Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000
    ).toISOString();
    const sinceDate = sinceIso.slice(0, 10); // YYYY-MM-DD for Paystack list

    const findings: Finding[] = [];
    const seenKeys = new Set<string>();
    const addFinding = (f: Finding) => {
      if (seenKeys.has(f.finding_key)) return;
      seenKeys.add(f.finding_key);
      findings.push(f);
    };

    let paystackChecked = 0;
    let safehavenChecked = 0;

    // -------------------------------------------------------------------------
    // 1) Paystack → list recent successes; flag missing in our DB
    // -------------------------------------------------------------------------
    const paystackRefsSeen = new Set<string>();

    for (let page = 1; page <= PAYSTACK_LIST_MAX_PAGES; page++) {
      const listed = await paystackGet(
        paystackSecret,
        `/transaction?status=success&from=${sinceDate}&perPage=${PAYSTACK_LIST_PER_PAGE}&page=${page}`
      );
      const data = Array.isArray(listed.json?.data)
        ? (listed.json!.data as Array<Record<string, unknown>>)
        : [];
      if (!listed.ok || data.length === 0) break;

      for (const tx of data) {
        const reference = String(tx.reference || "").trim();
        if (!reference || paystackRefsSeen.has(reference)) continue;
        paystackRefsSeen.add(reference);
        paystackChecked += 1;

        const paidKobo = Number(tx.amount) || 0;
        const paystackPaid = paidKobo / 100;
        const meta =
          tx.metadata && typeof tx.metadata === "object"
            ? (tx.metadata as Record<string, unknown>)
            : null;
        const expectedCredit = parseMetaAmount(meta);
        const metaUserId =
          meta?.user_id != null ? String(meta.user_id) : null;

        const { data: ourRow } = await supabase
          .from("transactions")
          .select("id, user_id, amount, status, type, source, metadata")
          .eq("reference", reference)
          .maybeSingle();

        if (!ourRow) {
          addFinding({
            finding_key: `paystack_missing:${reference}`,
            rail: "paystack",
            signal: "PAYSTACK_SUCCESS_MISSING_IN_APP",
            severity: "critical",
            reference,
            user_id: metaUserId,
            email: null,
            paystack_paid: paystackPaid,
            our_credited: null,
            expected_credit: expectedCredit,
            summary: `Paystack success ₦${paystackPaid} but no transactions row for this reference`,
          });
          continue;
        }

        const ourCredited = Number(ourRow.amount) || 0;
        const ourMeta =
          ourRow.metadata && typeof ourRow.metadata === "object"
            ? (ourRow.metadata as Record<string, unknown>)
            : null;
        const expected =
          expectedCredit ?? parseMetaAmount(ourMeta) ?? null;

        // Amount check: paid (Paystack) vs credited (us)
        if (ourRow.status === "completed" && ourRow.type === "deposit") {
          const diffPaidCredited = Math.abs(paystackPaid - ourCredited);
          // Checkout often credits net of fee — OK if expected_credit matches our row
          const matchesExpected =
            expected != null && Math.abs(expected - ourCredited) <= 1.01;
          const looksLikeFeeOnly =
            expected == null &&
            paystackPaid > ourCredited &&
            paystackPaid - ourCredited <= 2000 &&
            ourCredited / paystackPaid >= 0.95;

          if (diffPaidCredited > 1.01 && !matchesExpected && !looksLikeFeeOnly) {
            addFinding({
              finding_key: `paystack_amount:${reference}`,
              rail: "paystack",
              signal: "PAYSTACK_AMOUNT_MISMATCH",
              severity: "warning",
              reference,
              user_id: ourRow.user_id,
              email: null,
              paystack_paid: paystackPaid,
              our_credited: ourCredited,
              expected_credit: expected,
              summary: `Paystack paid ₦${paystackPaid} vs our deposit ₦${ourCredited}${
                expected != null ? ` (metadata expected ₦${expected})` : ""
              }`,
            });
          } else if (
            expected != null &&
            Math.abs(expected - ourCredited) > 1.01
          ) {
            addFinding({
              finding_key: `paystack_expected:${reference}`,
              rail: "paystack",
              signal: "CREDITED_NE_EXPECTED",
              severity: "warning",
              reference,
              user_id: ourRow.user_id,
              email: null,
              paystack_paid: paystackPaid,
              our_credited: ourCredited,
              expected_credit: expected,
              summary: `Metadata expected credit ₦${expected} but we recorded ₦${ourCredited} (Paystack paid ₦${paystackPaid})`,
            });
          }
        } else if (ourRow.status !== "completed") {
          addFinding({
            finding_key: `paystack_pending:${reference}`,
            rail: "paystack",
            signal: "PAYSTACK_SUCCESS_OUR_NOT_COMPLETED",
            severity: "critical",
            reference,
            user_id: ourRow.user_id,
            email: null,
            paystack_paid: paystackPaid,
            our_credited: ourCredited,
            expected_credit: expected,
            summary: `Paystack success but our txn status=${ourRow.status}`,
          });
        }
      }

      if (data.length < PAYSTACK_LIST_PER_PAGE) break;
    }

    // -------------------------------------------------------------------------
    // 2) Our recent Paystack deposits → verify at Paystack (catch orphan credits)
    // -------------------------------------------------------------------------
    const { data: ourDeposits, error: depErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, status, reference, source, metadata, created_at")
      .eq("type", "deposit")
      .ilike("source", "%Paystack%")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(VERIFY_OUR_DEPOSITS_LIMIT);

    if (depErr) {
      console.warn("our paystack deposits query failed:", depErr);
    }

    for (const row of ourDeposits || []) {
      const reference = String(row.reference || "").trim();
      if (!reference) continue;
      if (paystackRefsSeen.has(reference)) continue; // already checked via list
      paystackChecked += 1;

      const verified = await paystackGet(
        paystackSecret,
        `/transaction/verify/${encodeURIComponent(reference)}`
      );
      const vdata =
        verified.json?.data && typeof verified.json.data === "object"
          ? (verified.json.data as Record<string, unknown>)
          : null;

      if (!verified.ok || !vdata) {
        addFinding({
          finding_key: `paystack_verify_fail:${reference}`,
          rail: "paystack",
          signal: "PAYSTACK_VERIFY_FAILED",
          severity: "warning",
          reference,
          user_id: row.user_id,
          email: null,
          paystack_paid: null,
          our_credited: Number(row.amount) || 0,
          expected_credit: parseMetaAmount(
            row.metadata as Record<string, unknown> | null
          ),
          summary: `Our Paystack deposit exists but verify failed (HTTP ${verified.status})`,
        });
        continue;
      }

      const status = String(vdata.status || "");
      const paystackPaid = (Number(vdata.amount) || 0) / 100;
      const ourCredited = Number(row.amount) || 0;
      const meta =
        vdata.metadata && typeof vdata.metadata === "object"
          ? (vdata.metadata as Record<string, unknown>)
          : (row.metadata as Record<string, unknown> | null);
      const expected = parseMetaAmount(meta);

      if (status !== "success") {
        addFinding({
          finding_key: `paystack_ours_not_success:${reference}`,
          rail: "paystack",
          signal: "OUR_DEPOSIT_PAYSTACK_NOT_SUCCESS",
          severity: "critical",
          reference,
          user_id: row.user_id,
          email: null,
          paystack_paid: paystackPaid,
          our_credited: ourCredited,
          expected_credit: expected,
          summary: `We have a completed-looking deposit but Paystack status=${status}`,
        });
        continue;
      }

      if (Math.abs(paystackPaid - ourCredited) > 1.01) {
        const matchesExpected =
          expected != null && Math.abs(expected - ourCredited) <= 1.01;
        if (!matchesExpected) {
          addFinding({
            finding_key: `paystack_amount:${reference}`,
            rail: "paystack",
            signal: "PAYSTACK_AMOUNT_MISMATCH",
            severity: "warning",
            reference,
            user_id: row.user_id,
            email: null,
            paystack_paid: paystackPaid,
            our_credited: ourCredited,
            expected_credit: expected,
            summary: `Paystack paid ₦${paystackPaid} vs our deposit ₦${ourCredited}`,
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3) SafeHaven — logged deposits not credited (alert only)
    // -------------------------------------------------------------------------
    const { data: shRows, error: shErr } = await supabase
      .from("safehaven_deposit_webhooks")
      .select(
        "id, transaction_reference, amount, wallet_credited, status, received_at, user_account_id, narration"
      )
      .eq("wallet_credited", false)
      .gte("received_at", sinceIso)
      .order("received_at", { ascending: false })
      .limit(50);

    if (shErr) {
      console.warn("safehaven_deposit_webhooks query failed:", shErr);
    }

    for (const row of shRows || []) {
      safehavenChecked += 1;
      const reference = String(
        row.transaction_reference || row.id || ""
      ).trim();
      if (!reference) continue;

      // If a deposit txn already exists for this ref, note amount drift; else missing credit
      const { data: ourTxn } = await supabase
        .from("transactions")
        .select("id, user_id, amount, status")
        .eq("reference", reference)
        .eq("type", "deposit")
        .maybeSingle();

      const shAmount = Number(row.amount) || 0;

      if (!ourTxn) {
        addFinding({
          finding_key: `safehaven_uncredited:${reference}`,
          rail: "safehaven",
          signal: "SAFEHAVEN_WEBHOOK_NOT_CREDITED",
          severity: "critical",
          reference,
          user_id: null,
          email: null,
          paystack_paid: null,
          our_credited: null,
          expected_credit: shAmount,
          summary: `SafeHaven webhook logged ₦${shAmount} with wallet_credited=false (status=${row.status})`,
        });
      } else if (Math.abs((Number(ourTxn.amount) || 0) - shAmount) > 1.01) {
        addFinding({
          finding_key: `safehaven_amount:${reference}`,
          rail: "safehaven",
          signal: "SAFEHAVEN_AMOUNT_MISMATCH",
          severity: "warning",
          reference,
          user_id: ourTxn.user_id,
          email: null,
          paystack_paid: null,
          our_credited: Number(ourTxn.amount) || 0,
          expected_credit: shAmount,
          summary: `SafeHaven webhook ₦${shAmount} vs our deposit ₦${ourTxn.amount} (wallet_credited still false)`,
        });
      } else {
        // Credited in transactions but flag still false — ops hygiene
        addFinding({
          finding_key: `safehaven_flag:${reference}`,
          rail: "safehaven",
          signal: "SAFEHAVEN_FLAG_STALE",
          severity: "warning",
          reference,
          user_id: ourTxn.user_id,
          email: null,
          paystack_paid: null,
          our_credited: Number(ourTxn.amount) || 0,
          expected_credit: shAmount,
          summary: `Deposit txn exists but safehaven_deposit_webhooks.wallet_credited is still false`,
        });
      }
    }

    // Enrich emails where we have user_id
    const userIds = [
      ...new Set(
        findings.map((f) => f.user_id).filter((id): id is string => !!id)
      ),
    ];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      const emailById = new Map(
        (profiles || []).map((p) => [p.id as string, (p.email as string) || null])
      );
      for (const f of findings) {
        if (f.user_id && emailById.has(f.user_id)) {
          f.email = emailById.get(f.user_id) || null;
        }
      }
    }

    const alertFindings = findings.filter(
      (f) => f.severity === "critical" || f.severity === "warning"
    );
    const findingKeys = alertFindings.map((f) => f.finding_key);
    const compareKey = sortedFindingKey(findingKeys);

    const dedupSince = new Date(
      Date.now() - EMAIL_DEDUP_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: recentRuns } = await supabase
      .from("deposit_reconciliation_runs")
      .select("details, email_sent, ran_at")
      .eq("email_sent", true)
      .gte("ran_at", dedupSince)
      .order("ran_at", { ascending: false })
      .limit(20);

    const alreadyEmailed = (recentRuns || []).some((run) => {
      const details = run.details as Record<string, unknown> | null;
      const keys = details?.emailed_finding_keys;
      if (!Array.isArray(keys)) return false;
      return sortedFindingKey(keys as string[]) === compareKey;
    });

    let emailSent = false;
    let emailSkippedReason: string | null = null;

    if (alertFindings.length === 0) {
      emailSkippedReason = "no_findings";
    } else if (alreadyEmailed) {
      emailSkippedReason = `same_finding_set_emailed_within_${EMAIL_DEDUP_HOURS}h`;
    } else {
      const result = await sendSupportEmail(
        supabaseUrl,
        serviceKey,
        `[Planmoni] Deposit recon: ${alertFindings.length} finding(s)`,
        buildEmailHtml(alertFindings)
      );
      if (result.ok) {
        emailSent = true;
      } else {
        emailSkippedReason = `send_email_failed_${result.status}`;
        console.error("deposit recon email failed:", result.errText);
      }
    }

    const details = {
      lookback_hours: LOOKBACK_HOURS,
      emailed_finding_keys: emailSent ? findingKeys : [],
      email_skipped_reason: emailSkippedReason,
      findings: alertFindings,
      note: "email_only_no_auto_credit",
    };

    const { error: insertErr } = await supabase
      .from("deposit_reconciliation_runs")
      .insert({
        paystack_checked: paystackChecked,
        safehaven_checked: safehavenChecked,
        finding_count: alertFindings.length,
        details,
        email_sent: emailSent,
      });

    if (insertErr) {
      console.error("Failed to insert deposit_reconciliation_runs:", insertErr);
    }

    const summary = {
      success: true,
      paystack_checked: paystackChecked,
      safehaven_checked: safehavenChecked,
      finding_count: alertFindings.length,
      email_sent: emailSent,
      email_skipped_reason: emailSkippedReason,
    };
    console.log("reconcile-deposits summary:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("reconcile-deposits error:", error);
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
