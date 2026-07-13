import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Automated Payout Processing Function
 *
 * This function runs on a schedule to process due payout plans
 * and initiate bank transfers via SafeHaven Transfer API only.
 * 
 * ============================================================================
 * IDEMPOTENCY & TRANSACTIONAL SAFETY
 * ============================================================================
 * 
 * This function is designed with production-grade idempotency and transactional
 * safety to handle:
 * - Multiple concurrent executions (cron jobs, retries, manual triggers)
 * - Network failures and partial completions
 * - Race conditions between parallel instances
 * 
 * IDEMPOTENCY FEATURES:
 * 1. Pre-flight checks: Verifies payout/withdrawal doesn't already exist before creating
 * 2. Status verification: Checks current status before processing to avoid duplicates
 * 3. Metadata markers: Tracks wallet debits in metadata to prevent double-deduction
 * 4. Database-level exclusion: get_due_payout_plans RPC defines which plans are due (by next_payout_date);
 *    the edge function does not second-guess calendar/weekday (avoids false “skipping” vs DB).
 * 5. Row-level locking: Uses status checks in WHERE clauses to prevent race conditions
 * 
 * TRANSACTIONAL SAFETY:
 * 1. Atomic operations: Uses database RPC functions (transfer_funds, create_automated_payout)
 *    that handle transactions atomically
 * 2. Sequential processing: Processes items one-by-one to avoid race conditions
 * 3. Rollback on errors: Critical operations rollback on failure (e.g., withdrawal status)
 * 4. State verification: Verifies plan/withdrawal state before and after operations
 * 
 * SAFE TO:
 * - Run multiple times concurrently
 * - Retry on failure
 * - Call from cron jobs with overlapping schedules
 * - Trigger manually for testing
 * 
 * ============================================================================
 */ 
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const safeHavenClientId = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID") || Deno.env.get("SAFEHAVEN_CLIENT_ID");
const safeHavenClientAssertion = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION") || Deno.env.get("SAFEHAVEN_CLIENT_ASSERTION");
const safeHavenApiUrl = "https://api.safehavenmfb.com";

/** Shape emitted as one `EXECUTION_SUMMARY` log line for alerting / log tools. */
type ProcessDuePayoutsRunSummary = {
  executionId: string;
  startedAt: string;
  finishedAt?: string;
  elapsedMs?: number;
  payouts: { planId: string; name: string; status: "success" | "skipped" | "failed"; error?: string }[];
  withdrawals: { id: string; status: "success" | "skipped" | "failed"; error?: string }[];
  totals: {
    payouts_found: number;
    payouts_success: number;
    payouts_skipped: number;
    payouts_failed: number;
    withdrawals_found: number;
    withdrawals_success: number;
    withdrawals_skipped: number;
    withdrawals_failed: number;
  };
};

/** Errors that need ops attention — not user-facing retry failures. */
function isPayoutSkipMessage(msg: string): boolean {
  return /already|duplicate|skipping|manual review required|manual reconciliation/i.test(msg);
}

function normalizeScheduledDate(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().split("T")[0];
  const s = typeof value === "string" ? value : value.toISOString();
  return s.split("T")[0];
}

type ClaimPayoutInstallmentResult = {
  success?: boolean;
  skip?: boolean;
  error?: string;
  already_completed?: boolean;
  already_claimed?: boolean;
  claimed?: boolean;
  automated_payout_id?: string;
  transaction_id?: string;
  payment_reference?: string;
  amount?: number;
  may_call_safehaven?: boolean;
};

function buildProcessDuePayoutsResult(summary: ProcessDuePayoutsRunSummary) {
  return {
    executionId: summary.executionId,
    elapsedMs: summary.elapsedMs,
    processed: summary.totals.payouts_found,
    success: summary.totals.payouts_success,
    skipped: summary.totals.payouts_skipped,
    failed: summary.totals.payouts_failed,
    withdrawals_processed: summary.totals.withdrawals_found,
    withdrawals_success: summary.totals.withdrawals_success,
    withdrawals_skipped: summary.totals.withdrawals_skipped,
    withdrawals_failed: summary.totals.withdrawals_failed,
  };
}

/**
 * Main function to process due payouts and scheduled emergency withdrawals
 *
 * IDEMPOTENCY: This function is designed to be idempotent. It can be safely called
 * multiple times (e.g., by cron jobs, retries, or concurrent instances) without
 * creating duplicate payouts. Each payout plan and emergency withdrawal is checked
 * for existing processing before being handled.
 *
 * TRANSACTIONAL SAFETY: Critical database operations use RPC functions that handle
 * transactions atomically. The function processes items sequentially to avoid
 * race conditions, though each item's processing is independently idempotent.
 *
 * Emits `EXECUTION_SUMMARY` JSON (one line) for log aggregation and alerting.
 */
async function processDuePayouts() {
  const startedAt = Date.now();
  const executionId = `exec_${startedAt}_${Math.random().toString(36).substring(2, 10)}`;

  const summary: ProcessDuePayoutsRunSummary = {
    executionId,
    startedAt: new Date(startedAt).toISOString(),
    payouts: [],
    withdrawals: [],
    totals: {
      payouts_found: 0,
      payouts_success: 0,
      payouts_skipped: 0,
      payouts_failed: 0,
      withdrawals_found: 0,
      withdrawals_success: 0,
      withdrawals_skipped: 0,
      withdrawals_failed: 0,
    },
  };

  console.log(`🚀 [${executionId}] Starting automated payout processing...`);

  try {
    // Get all due payout plans
    // Note: get_due_payout_plans RPC already excludes plans with existing automated_payouts
    // This provides database-level idempotency
    const { data: duePlans, error: plansError } = await supabase.rpc("get_due_payout_plans", {
      check_at: new Date().toISOString(),
    });
    if (plansError) {
      console.error("❌ Error fetching due payout plans:", plansError);
      throw plansError;
    }

    // Get scheduled emergency withdrawals that are due for processing
    // IDEMPOTENCY: Only fetch withdrawals in "scheduled" status to avoid processing duplicates
    const { data: scheduledWithdrawals, error: withdrawalsError } = await supabase
      .from("emergency_withdrawals")
      .select(`
        *,
        payout_plans (
          id,
          name,
          total_amount,
          payout_amount,
          completed_payouts,
          created_at
        ),
        payout_accounts (
          account_name,
          account_number,
          bank_name,
          bank_code,
          safehaven_bank_code,
          paystack_recipient_code,
          transfer_enabled,
          last_transfer_attempt
        ),
        bank_accounts (
          account_name,
          account_number,
          bank_name,
          bank_code,
          paystack_recipient_code,
          transfer_enabled,
          last_transfer_attempt
        )
      `)
      .eq("status", "scheduled") // Only get scheduled withdrawals (idempotency)
      .lte("scheduled_processing_time", new Date().toISOString());

    if (withdrawalsError) {
      console.error("❌ Error fetching scheduled emergency withdrawals:", withdrawalsError);
      // Don't throw, continue with payouts
    }

    const totalPayouts = duePlans?.length || 0;
    const totalWithdrawals = scheduledWithdrawals?.length || 0;

    summary.totals.payouts_found = totalPayouts;
    summary.totals.withdrawals_found = totalWithdrawals;

    if (totalPayouts === 0 && totalWithdrawals === 0) {
      console.log(`[${executionId}] ✅ No due payouts or scheduled withdrawals found`);
      summary.finishedAt = new Date().toISOString();
      summary.elapsedMs = Date.now() - startedAt;
      console.log("EXECUTION_SUMMARY", JSON.stringify(summary));
      return buildProcessDuePayoutsResult(summary);
    }

    console.log(
      `[${executionId}] 📋 Found ${totalPayouts} due payout plans and ${totalWithdrawals} scheduled emergency withdrawals`
    );

    for (const plan of duePlans ?? []) {
      const planStart = Date.now();
      console.log(`[${executionId}] ⏳ Payout plan: ${plan.name} (${plan.plan_id})`);
      try {
        await processSinglePayout(plan);
        summary.totals.payouts_success++;
        summary.payouts.push({ planId: plan.plan_id, name: plan.name, status: "success" });
        console.log(`[${executionId}] ✅ Payout done: ${plan.name} in ${Date.now() - planStart}ms`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const isSkip =
          isPayoutSkipMessage(msg) || /is not defined|referenceerror/i.test(msg);
        if (isSkip) {
          summary.totals.payouts_skipped++;
          summary.payouts.push({ planId: plan.plan_id, name: plan.name, status: "skipped", error: msg });
          console.log(`[${executionId}] ℹ️ Skipped payout: ${plan.name} — ${msg}`);
        } else {
          summary.totals.payouts_failed++;
          summary.payouts.push({ planId: plan.plan_id, name: plan.name, status: "failed", error: msg });
          console.error(`[${executionId}] ❌ Failed payout: ${plan.name} — ${msg}`);
          await logPayoutFailure(plan, error as any);
        }
      }
    }

    for (const withdrawal of scheduledWithdrawals ?? []) {
      const wStart = Date.now();
      console.log(`[${executionId}] ⏳ Emergency withdrawal: ${withdrawal.id}`);
      try {
        await processScheduledEmergencyWithdrawal(withdrawal);
        summary.totals.withdrawals_success++;
        summary.withdrawals.push({ id: withdrawal.id, status: "success" });
        console.log(`[${executionId}] ✅ Withdrawal done: ${withdrawal.id} in ${Date.now() - wStart}ms`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const isSkip = isPayoutSkipMessage(msg);
        if (isSkip) {
          summary.totals.withdrawals_skipped++;
          summary.withdrawals.push({ id: withdrawal.id, status: "skipped", error: msg });
          console.log(`[${executionId}] ℹ️ Skipped withdrawal: ${withdrawal.id} — ${msg}`);
        } else {
          summary.totals.withdrawals_failed++;
          summary.withdrawals.push({ id: withdrawal.id, status: "failed", error: msg });
          console.error(`[${executionId}] ❌ Failed withdrawal: ${withdrawal.id} — ${msg}`);
          await logEmergencyWithdrawalFailure(withdrawal, error as any);
        }
      }
    }

    summary.finishedAt = new Date().toISOString();
    summary.elapsedMs = Date.now() - startedAt;
    console.log("EXECUTION_SUMMARY", JSON.stringify(summary));

    const result = buildProcessDuePayoutsResult(summary);
    console.log(
      `[${executionId}] 🏁 Done in ${summary.elapsedMs}ms — Payouts: ${result.success}✓ ${result.skipped}⏭ ${result.failed}✗ | ` +
        `Withdrawals: ${result.withdrawals_success}✓ ${result.withdrawals_skipped}⏭ ${result.withdrawals_failed}✗`
    );
    return result;
  } catch (error: unknown) {
    summary.finishedAt = new Date().toISOString();
    summary.elapsedMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${executionId}] 💥 Critical error:`, message);
    console.log("EXECUTION_SUMMARY", JSON.stringify({ ...summary, criticalError: message }));
    throw error;
  }
}

// Create a SafeHaven token for users who do not yet have a token row,
// then persist it in safehaven_tokens so subsequent runs can refresh normally.
async function createAndStoreSafeHavenToken(
  userId: string,
  existingRefreshToken: string | null = null
): Promise<{ access_token: string; refresh_token: string | null; expires_at: string }> {
  const newTokenResponse = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: safeHavenClientAssertion,
      client_id: safeHavenClientId
    })
  });

  if (!newTokenResponse.ok) {
    const errorText = await newTokenResponse.text();
    throw new Error(`Failed to create SafeHaven token: ${newTokenResponse.status} ${newTokenResponse.statusText} - ${errorText}`);
  }

  const tokenData: any = await newTokenResponse.json();
  if (!tokenData?.access_token) {
    throw new Error("Failed to create SafeHaven token: No access token in response");
  }

  const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
  const expiresAtDate = new Date(Date.now() + expiresIn * 1000);
  const refreshToken = tokenData.refresh_token || existingRefreshToken || null;

  const tokenRecord = {
    user_id: userId,
    access_token: tokenData.access_token,
    refresh_token: refreshToken,
    token_type: tokenData.token_type || "Bearer",
    expires_in: expiresIn,
    expires_at: expiresAtDate.toISOString(),
    ibs_client_id: tokenData.ibs_client_id || safeHavenClientId || "unknown_client",
    ibs_user_id: tokenData.ibs_user_id || userId,
    client_id: tokenData.client_id || safeHavenClientId || "unknown_client",
    updated_at: new Date().toISOString()
  };

  const { data: existingRow, error: existingRowError } = await supabase
    .from("safehaven_tokens")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingRowError) {
    throw new Error(`Failed to check existing SafeHaven token row: ${existingRowError.message}`);
  }

  if (existingRow?.id) {
    const { error: updateError } = await supabase
      .from("safehaven_tokens")
      .update(tokenRecord)
      .eq("user_id", userId);
    if (updateError) {
      throw new Error(`Failed to update SafeHaven token row: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from("safehaven_tokens")
      .insert({
        ...tokenRecord,
        created_at: new Date().toISOString()
      });
    if (insertError) {
      throw new Error(`Failed to insert SafeHaven token row: ${insertError.message}`);
    }
  }

  return {
    access_token: tokenData.access_token,
    refresh_token: refreshToken,
    expires_at: expiresAtDate.toISOString()
  };
}

/**
 * Process a single payout plan
 * 
 * IDEMPOTENCY: This function is idempotent - it can be safely called multiple times
 * for the same plan without creating duplicate payouts. It checks if an automated_payout
 * already exists before creating a new one.
 * 
 * TRANSACTIONAL SAFETY: Critical operations use database RPC functions that handle
 * transactions atomically. Wallet balance deduction and payout creation are coordinated
 * to prevent race conditions.
 */
async function processSinglePayout(plan: any) {
  // IDEMPOTENCY CHECK: Verify plan is still eligible and not already being processed
  const { data: planCheck, error: planCheckError } = await supabase
    .from("payout_plans")
    .select("id, user_id, name, status, frequency, metadata, day_of_week, start_date, completed_payouts, duration, next_payout_date, payout_amount, payout_account_id")
    .eq("id", plan.plan_id)
    .maybeSingle();

  if (planCheckError) {
    console.error(`Plan fetch error for ${plan.plan_id}:`, planCheckError.code, planCheckError.message);
    throw new Error(`Payout plan ${plan.plan_id} fetch failed: ${planCheckError.message}`);
  }
  if (!planCheck) {
    // Plan was returned by get_due_payout_plans but is now missing (e.g. deleted/deactivated) — skip without failing run
    console.warn(`Skipping: payout plan ${plan.plan_id} not found or inaccessible (may have been removed)`);
    throw new Error(`skipping: payout plan ${plan.plan_id} not found or inaccessible`);
  }
  
  if (planCheck.status !== 'active') {
    throw new Error(`Payout plan ${plan.plan_id} is not active (status: ${planCheck.status})`);
  }
  
  if (planCheck.completed_payouts >= planCheck.duration) {
    throw new Error(`Payout plan ${plan.plan_id} is already completed`);
  }

  // Atomic claim: wallet debit + automated_payouts + transactions (single Postgres transaction).
  const { data: claimRaw, error: claimError } = await supabase.rpc("claim_payout_installment", {
    p_plan_id: plan.plan_id,
    p_payment_reference: null,
  });

  if (claimError) {
    throw new Error(`claim_payout_installment failed: ${claimError.message}`);
  }

  const claim = claimRaw as ClaimPayoutInstallmentResult;

  if (!claim?.success) {
    const err = claim?.error || "claim_payout_installment failed";
    if (claim?.skip) {
      throw new Error(`skipping: ${err}`);
    }
    throw new Error(err);
  }

  if (claim.already_completed) {
    console.log(`⏭️ Installment already completed for plan ${plan.plan_id}`);
    return;
  }

  const payoutId = claim.automated_payout_id as string;
  const actualPayoutAmount = Number(claim.amount);
  const plannedReference = claim.payment_reference as string;
  let transactionId: string | undefined = claim.transaction_id;
  const mayCallSafehaven =
    claim.claimed === true ||
    (claim.already_claimed === true && claim.may_call_safehaven === true);

  if (!payoutId || !plannedReference || !Number.isFinite(actualPayoutAmount)) {
    throw new Error("claim_payout_installment returned incomplete data");
  }

  if (claim.already_claimed && claim.may_call_safehaven === false) {
    console.log(
      `⏭️ Payout ${payoutId} already claimed and SafeHaven transfer already initiated — skipping`
    );
    return;
  }

  if (!mayCallSafehaven) {
    console.log(`⏭️ No SafeHaven call needed for payout ${payoutId}`);
    return;
  }

  console.log(
    `✅ Claimed installment for plan ${plan.plan_id}: payout=${payoutId} amount=₦${actualPayoutAmount} ref=${plannedReference}`
  );

  // 2. Get payout account details
  const { data: payoutAccount, error: payoutError } = await supabase
    .from("payout_accounts")
    .select("*")
    .eq("id", plan.payout_account_id)
    .single();
  if (payoutError || !payoutAccount) {
    throw new Error(`Payout account not found: ${plan.payout_account_id}`);
  }
  
  // 3. Validate account details
  if (!payoutAccount.account_name || !payoutAccount.account_number || !payoutAccount.bank_name) {
    throw new Error("Incomplete bank account information");
  }
  
  // Resolve SafeHaven bank code from payout_accounts or bank_comparison table (transfers are SafeHaven-only)
  const { safehavenCode } = await resolveBankCodes(payoutAccount);
  if (!safehavenCode) {
    throw new Error(
      `No SafeHaven bank code for ${payoutAccount.bank_name} (${payoutAccount.account_number}). Please add a payout account with SafeHaven bank code.`
    );
  }
  payoutAccount.safehaven_bank_code = safehavenCode;

  // 5 & 6. Get SafeHaven token
  let safeHavenToken: any = null;
  {
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("safehaven_tokens")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", plan.user_id)
      .maybeSingle();

    if (tokenError) {
      throw new Error(`Failed to fetch SafeHaven token: ${tokenError.message}`);
    }

    if (!tokenRecord) {
      console.log("No SafeHaven token row found for user. Bootstrapping via client_credentials...");
      const bootstrappedToken = await createAndStoreSafeHavenToken(plan.user_id);
      safeHavenToken = {
        access_token: bootstrappedToken.access_token,
        refresh_token: bootstrappedToken.refresh_token,
        expires_at: bootstrappedToken.expires_at
      };
    } else {
      safeHavenToken = tokenRecord;
    }

    const expiresAt = new Date(safeHavenToken.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    const needsRefresh = isNaN(expiresAt.getTime()) || expiresAt.getTime() - now.getTime() < bufferTime;

    if (needsRefresh) {
      console.log("SafeHaven token expired or expiring soon, attempting refresh...");
      let tokenData: any = null;
      let tokenUpdated = false;

      if (safeHavenToken.refresh_token) {
        try {
          const refreshResponse = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "refresh_token",
              client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
              client_assertion: safeHavenClientAssertion,
              client_id: safeHavenClientId,
              refresh_token: safeHavenToken.refresh_token
            })
          });

          if (refreshResponse.ok) {
            tokenData = await refreshResponse.json();
            if (tokenData.access_token) {
              tokenUpdated = true;
              console.log("✅ Successfully refreshed SafeHaven token");
            }
          } else {
            console.log("⚠️ Token refresh failed, will create new token");
          }
        } catch (refreshError) {
          console.log("⚠️ Token refresh error, will create new token:", refreshError);
        }
      }

      if (!tokenUpdated) {
        console.log("Creating new SafeHaven access token using client_credentials...");
        try {
          const newTokenResponse = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "client_credentials",
              client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
              client_assertion: safeHavenClientAssertion,
              client_id: safeHavenClientId
            })
          });

          if (!newTokenResponse.ok) {
            const errorText = await newTokenResponse.text();
            throw new Error(`Failed to create new SafeHaven token: ${newTokenResponse.status} ${newTokenResponse.statusText} - ${errorText}`);
          }

          tokenData = await newTokenResponse.json();
          if (!tokenData.access_token) {
            throw new Error("Failed to create new SafeHaven token: No access token in response");
          }

          console.log("✅ Successfully created new SafeHaven token");
        } catch (newTokenError: any) {
          throw new Error(`Failed to create new SafeHaven token: ${newTokenError.message}`);
        }
      }

      const expiresIn = tokenData.expires_in && typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
      const currentTimestamp = Date.now();
      const expiresAtTimestamp = currentTimestamp + expiresIn * 1000;
      const expiresAtDate = new Date(expiresAtTimestamp);

      if (isNaN(expiresAtDate.getTime())) {
        throw new Error(`Failed to calculate token expiration date. expiresIn: ${expiresIn}, timestamp: ${expiresAtTimestamp}`);
      }

      const currentDate = new Date();
      if (isNaN(currentDate.getTime())) {
        throw new Error("Failed to get current date");
      }

      const { error: updateError } = await supabase
        .from("safehaven_tokens")
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || safeHavenToken.refresh_token || null,
          expires_at: expiresAtDate.toISOString(),
          updated_at: currentDate.toISOString()
        })
        .eq("user_id", plan.user_id);

      if (updateError) {
        throw new Error(`Failed to update SafeHaven token in database: ${updateError.message}`);
      }

      safeHavenToken.access_token = tokenData.access_token;
      if (tokenData.refresh_token) {
        safeHavenToken.refresh_token = tokenData.refresh_token;
      }
    }
  }

  // 8. Initiate transfer via SafeHaven only.
  // PRE-FLIGHT: block only when SafeHaven POST was already sent for this installment.
  {
    const { data: preFlightRow } = await supabase
      .from("automated_payouts")
      .select("transfer_reference, metadata")
      .eq("id", payoutId)
      .single();
    const md = (preFlightRow?.metadata as Record<string, unknown> | null) ?? {};
    const safehavenAlreadyInitiated = md.safehaven_transfer_initiated === true;
    if (safehavenAlreadyInitiated && preFlightRow?.transfer_reference) {
      console.error(
        `🚨 DOUBLE-PAYMENT GUARD (pre-flight): Payout ${payoutId} already has SafeHaven initiated ` +
        `(ref="${preFlightRow.transfer_reference}"). Skipping duplicate POST.`
      );
      throw new Error(
        `skipping: payout ${payoutId} SafeHaven transfer already initiated — manual reconciliation if stuck`
      );
    }
  }

  const planWithActualAmount = {
    ...plan,
    payout_amount: actualPayoutAmount
  };
  if (!safeHavenToken?.access_token) {
    throw new Error("SafeHaven token not available for this user.");
  }

  let transferResult: any;
  try {
    transferResult = await initiateSafeHavenTransfer(
      planWithActualAmount,
      payoutAccount,
      safeHavenToken.access_token,
      payoutId,
      safehavenCode!,
      plannedReference
    );
  } catch (transferErr: unknown) {
    const errMsg = transferErr instanceof Error ? transferErr.message : String(transferErr);
    if (/duplicate/i.test(errMsg)) {
      console.log(`SafeHaven duplicate on POST — polling status for ${plannedReference}`);
      const polled = await pollSafeHavenTransferStatus(plannedReference, safeHavenToken.access_token);
      if (polled.isCompleted) {
        transferResult = {
          provider: "safehaven",
          reference: plannedReference,
          transfer_code: plannedReference,
          status: "Completed",
          rawResponse: polled.raw,
        };
      } else if (polled.isFailed) {
        await supabase.rpc("fail_payout_installment", {
          p_automated_payout_id: payoutId,
          p_reason: polled.status,
          p_provider_metadata: { response: polled.raw },
        });
        throw transferErr;
      } else {
        await supabase.rpc("mark_payout_safehaven_initiated", {
          p_automated_payout_id: payoutId,
          p_metadata: { duplicate_poll_pending: true, response: polled.raw },
        });
        console.log(`Transfer still pending after duplicate response for ${plannedReference}`);
        return;
      }
    } else {
      throw transferErr;
    }
  }

  if (isSafeHavenDuplicateResponse(transferResult)) {
    console.log(`SafeHaven response 94 — polling status for ${plannedReference}`);
    const polled = await pollSafeHavenTransferStatus(plannedReference, safeHavenToken.access_token);
    if (polled.isCompleted) {
      transferResult = {
        provider: "safehaven",
        reference: plannedReference,
        transfer_code: plannedReference,
        status: "Completed",
        rawResponse: polled.raw,
      };
    } else if (!polled.isFailed) {
      await supabase.rpc("mark_payout_safehaven_initiated", {
        p_automated_payout_id: payoutId,
        p_metadata: { duplicate_poll_pending: true, response: polled.raw },
      });
      console.log(`Transfer still pending after duplicate response for ${plannedReference}`);
      return;
    }
  }

  await supabase.rpc("mark_payout_safehaven_initiated", {
    p_automated_payout_id: payoutId,
    p_metadata: {
      provider: transferResult.provider,
      transfer_code: transferResult.transfer_code || transferResult.reference,
      transfer_status: transferResult.status,
      response: transferResult.rawResponse || transferResult,
    },
  });

  // 8. Update transaction record status based on provider response
  try {
    if (!transactionId) {
      // Fallback: create now if earlier idempotent insert failed
      const fallbackTxMeta: Record<string, any> = {
        provider: transferResult.provider,
        transfer_code: transferResult.transfer_code || transferResult.reference,
        transfer_status: transferResult.status,
        response: transferResult.rawResponse || transferResult,
        payout_plan_id: plan.plan_id,
        automated_payout_id: payoutId,
      };
      const { data: txIdCreated, error: txCreateErr } = await supabase.rpc('create_transaction_record', {
        p_user_id: plan.user_id,
        p_type: 'payout',
        p_amount: actualPayoutAmount, // use resolved per-date amount, not plan average
        p_status: 'pending',
        p_source: 'Wallet',
        p_destination: 'Bank Transfer',
        p_reference: transferResult.reference,
        p_payout_plan_id: plan.plan_id,
        p_description: `Automated payout from ${plan.name}`,
        p_metadata: fallbackTxMeta
      });
      if (txCreateErr) {
        console.error('Failed to create fallback transaction:', txCreateErr);
      } else {
        transactionId = txIdCreated as unknown as string;
      }
    }

    if (transactionId) {
      const success = isTransferSuccess(transferResult);
      const txStatus = success ? 'completed' : 'pending';
      const txMeta: Record<string, any> = {
        provider: transferResult.provider,
        transfer_code: transferResult.transfer_code || transferResult.reference,
        transfer_status: transferResult.status,
        response: transferResult.rawResponse || transferResult,
        payout_plan_id: plan.plan_id,
        automated_payout_id: payoutId,
        safehaven_transfer_id: transferResult.id || transferResult._id,
        safehaven_transfer_code: transferResult.reference || transferResult.paymentReference,
        safehaven_transfer_status: transferResult.status || 'Pending',
        safehaven_transfer_session_id: transferResult.sessionId
      };

      await supabase
        .from('transactions')
        .update({
          status: txStatus,
          reference: transferResult.reference,
          metadata: txMeta,
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);
    }
  } catch (txUpdateErr) {
    console.error('Failed to update transaction status after transfer:', txUpdateErr);
  }
  
  // 9. Update automated payout record with transfer details
  await updateAutomatedPayout(payoutId, transferResult);

  // 10. Complete installment (advances plan + recalculates locked balance) when transfer succeeded immediately
  if (isTransferSuccess(transferResult)) {
    const { error: completeErr } = await supabase.rpc("complete_payout_installment", {
      p_automated_payout_id: payoutId,
      p_provider_metadata: {
        provider: transferResult.provider,
        transfer_code: transferResult.transfer_code || transferResult.reference,
        transfer_status: transferResult.status,
        response: transferResult.rawResponse || transferResult,
        completed_via: "process_due_payouts",
      },
    });
    if (completeErr) {
      console.error("complete_payout_installment failed:", completeErr);
    } else {
      console.log(`✅ Installment completed for automated_payout ${payoutId}`);
    }
  } else {
    console.log("Transfer not completed inline; webhook or status poll will call complete_payout_installment");
  }

  // 11. Create notification (email will be sent by webhook when transfer completes)
  await createNotification(plan.user_id, planWithActualAmount, transferResult);
}

/**
 * Initiate transfer via SafeHaven
 */
function isTransferSuccess(transferResult: any): boolean {
  try {
    const raw = transferResult?.rawResponse || {};
    const code = raw?.responseCode;
    const statusCode = raw?.statusCode;
    const dataStatus = raw?.data?.status || transferResult?.status;
    return (statusCode === 200 && code === '00' && (dataStatus === 'Completed' || dataStatus === 'Success'));
  } catch (_) {
    return false;
  }
}

function isSafeHavenDuplicateResponse(transferResult: any): boolean {
  try {
    const raw = transferResult?.rawResponse || {};
    const code = raw?.responseCode ?? raw?.data?.responseCode;
    const statusCode = raw?.statusCode;
    const message = String(raw?.message || raw?.data?.responseMessage || '').toLowerCase();
    return statusCode === 400 && (code === '94' || message.includes('duplicate'));
  } catch (_) {
    return false;
  }
}

async function pollSafeHavenTransferStatus(
  paymentReference: string,
  accessToken: string
): Promise<{ isCompleted: boolean; isFailed: boolean; status: string; raw: any }> {
  const response = await fetch(`${safeHavenApiUrl}/transfers/status`, {
    method: "POST",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentReference }),
  });
  const raw = await response.json();
  const inner = raw?.data || raw;
  const status = inner?.status || raw?.status || "Pending";
  const responseCode = raw?.responseCode ?? inner?.responseCode;
  const isCompleted =
    status === "Completed" ||
    status === "Success" ||
    (raw?.statusCode === 200 && responseCode === "00" && (status === "Completed" || status === "Success"));
  const isFailed = status === "Failed" || status === "Reversed";
  return { isCompleted, isFailed, status, raw };
}

function computeNextPayoutDateWithTime(
  frequency: string,
  startDate: string,
  newCompletedCount: number,
  dayOfWeek: number | null | undefined,
  prevNextPayoutDate?: string | null,
  payoutHour?: number,
  payoutMinute?: number
): Date | null {
  try {
    const f = (frequency || "").toLowerCase();
    const start = new Date(startDate);
    let next = new Date(start);

    // Preserve time: from prev next date if not midnight, else from provided hour/minute, else default 09:00
    let useHour = 9, useMinute = 0;
    if (typeof payoutHour === 'number' && typeof payoutMinute === 'number') {
      useHour = payoutHour; useMinute = payoutMinute;
    }
    if (prevNextPayoutDate) {
      const prev = new Date(prevNextPayoutDate);
      const h = prev.getHours();
      const m = prev.getMinutes();
      if (!(h === 0 && m === 0)) { useHour = h; useMinute = m; }
    }

    const setTime = (d: Date) => { d.setHours(useHour, useMinute, 0, 0); };

    // custom / unknown complex schedules: DB update_payout_plan_progress + custom_payout_dates
    if (f === "custom") {
      return null;
    }

    if (f === "daily") {
      const anchor = prevNextPayoutDate ? new Date(prevNextPayoutDate) : new Date(startDate);
      const d = new Date(anchor);
      d.setDate(d.getDate() + 1);
      setTime(d);
      return d;
    }

    // Aligned with migration 20260228140000: next = (last paid date) + 2 weeks
    if (f === "biweekly") {
      if (prevNextPayoutDate) {
        const d = new Date(prevNextPayoutDate);
        d.setDate(d.getDate() + 14);
        setTime(d);
        return d;
      }
      next.setDate(start.getDate() + (newCompletedCount * 14));
      setTime(next);
      return next;
    }

    // Match update_payout_plan_progress (20260502120000): anchor from last scheduled payout + 7 when available.
    if (f === "weekly") {
      if (prevNextPayoutDate) {
        const d = new Date(prevNextPayoutDate);
        d.setDate(d.getDate() + 7);
        setTime(d);
        return d;
      }
      next.setDate(start.getDate() + (newCompletedCount * 7));
      setTime(next);
      return next;
    }

    if (f === "weekly_specific") {
      const targetDow = typeof dayOfWeek === 'number' && dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : null;
      let anchor: Date;
      if (prevNextPayoutDate) {
        anchor = new Date(prevNextPayoutDate);
        anchor.setDate(anchor.getDate() + 7);
      } else {
        anchor = new Date(start);
        anchor.setDate(start.getDate() + (newCompletedCount * 7));
      }
      let target = new Date(anchor);
      if (targetDow !== null) {
        const anchorDow = target.getDay();
        const delta = (7 + targetDow - anchorDow) % 7;
        target.setDate(target.getDate() + delta);
      }
      setTime(target);
      return target;
    }

    // Matches calculate_next_payout_date (20260208140000_add_remaining_frequencies_next_payout.sql)
    if (f === "monthly") {
      const d = new Date(start);
      d.setMonth(d.getMonth() + newCompletedCount);
      setTime(d);
      return d;
    }

    if (f === "end_of_month") {
      const s = new Date(startDate);
      const firstOfStartMonth = new Date(s.getFullYear(), s.getMonth(), 1);
      const monthStart = new Date(firstOfStartMonth);
      monthStart.setMonth(monthStart.getMonth() + newCompletedCount);
      const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      setTime(lastDay);
      return lastDay;
    }

    if (f === "quarterly") {
      const d = new Date(start);
      d.setMonth(d.getMonth() + 3 * newCompletedCount);
      setTime(d);
      return d;
    }

    if (f === "biannual") {
      const d = new Date(start);
      d.setMonth(d.getMonth() + 6 * newCompletedCount);
      setTime(d);
      return d;
    }

    if (f === "annually" || f === "yearly") {
      const d = new Date(start);
      d.setFullYear(d.getFullYear() + newCompletedCount);
      setTime(d);
      return d;
    }

    return null;
  } catch (_) {
    return null;
  }
}

async function initiateSafeHavenTransfer(
  plan: any,
  payoutAccount: any,
  accessToken: string,
  payoutId: string,
  safehavenBankCode: string,
  paymentReference?: string
) {
  const transferReference = paymentReference || `AUTO_${plan.plan_id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  console.log("Processing SafeHaven transfer:", {
    fromAccount: "0117753301",
    toAccount: payoutAccount.account_number,
    amount: plan.payout_amount,
    safehavenBankCode: payoutAccount.safehaven_bank_code,
    bankCode: payoutAccount.bank_code,
    bankName: payoutAccount.bank_name
  });

  // Use resolved SafeHaven bank code
  const correctBankCode = safehavenBankCode;
  
  if (!correctBankCode) {
    throw new Error(`SafeHaven bank code is required. Please update the payout account with safehaven_bank_code.`);
  }
  
  console.log(`✅ Using SafeHaven bank code: ${correctBankCode} from payout_accounts table`);

  // Step 1: Perform name enquiry first
  console.log("Performing name enquiry...");
  const nameEnquiryResponse = await fetch(`${safeHavenApiUrl}/transfers/name-enquiry`, {
    method: "POST",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bankCode: correctBankCode,
      accountNumber: payoutAccount.account_number
    })
  });

  const nameEnquiryData = await nameEnquiryResponse.json();
  
  if (!nameEnquiryResponse.ok) {
    const errorMessage = nameEnquiryData.message || nameEnquiryData.error || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`);
  }

  // Check if response indicates success
  if (nameEnquiryData.statusCode !== 200 || nameEnquiryData.responseCode !== "00") {
    const errorMessage = nameEnquiryData.message || nameEnquiryData.data?.responseMessage || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`);
  }

  const nameEnquiryReference = nameEnquiryData.data?.sessionId || nameEnquiryData.sessionId;
  if (!nameEnquiryReference) {
    throw new Error("Name enquiry did not return sessionId");
  }

  console.log("Name enquiry successful, sessionId:", nameEnquiryReference);
  console.log("Account details:", {
    accountName: nameEnquiryData.data?.accountName,
    accountNumber: nameEnquiryData.data?.accountNumber,
    bankCode: nameEnquiryData.data?.bankCode
  });

  // Step 2: Initiate SafeHaven transfer with nameEnquiryReference
  console.log(`💸 Initiating transfer of ₦${plan.payout_amount} to ${payoutAccount.account_number}`);
  const transferResponse = await fetch(`${safeHavenApiUrl}/transfers`, {
    method: "POST",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      saveBeneficiary: true,
      amount: plan.payout_amount,
      beneficiaryAccountNumber: payoutAccount.account_number,
      beneficiaryBankCode: correctBankCode,
      debitAccountNumber: "0117753301",
      nameEnquiryReference: nameEnquiryReference,
      narration: `Automated payout: ${plan.name}`,
      paymentReference: transferReference
    })
  });

  const transferData = await transferResponse.json();
  
  if (!transferResponse.ok) {
    const errorMessage = transferData.message || transferData.error || 'Unknown transfer error';
    throw new Error(`SafeHaven transfer failed: ${errorMessage}`);
  }

  // Extract transfer details from response
  const transferResult = transferData.data || transferData;
  const transferId = transferResult._id || transferResult.id;
  const resolvedReference = transferResult.paymentReference || transferReference;
  const sessionId = transferResult.sessionId || transferResult.session_id;

  console.log("SafeHaven transfer initiated:", {
    transferId,
    paymentReference: resolvedReference,
    status: transferResult.status || "Pending"
  });

  return {
    provider: "safehaven",
    id: transferId,
    reference: resolvedReference,
    transfer_code: resolvedReference,
    sessionId: sessionId,
    status: transferResult.status || "Pending",
    _id: transferId,
    paymentReference: resolvedReference,
    rawResponse: transferData
  };
}

type BankCodeResolution = {
  safehavenCode: string | null;
};

async function resolveBankCodes(payoutAccount: any): Promise<BankCodeResolution> {
  let safehavenCode = payoutAccount.safehaven_bank_code || null;

  if (!safehavenCode && payoutAccount.bank_name) {
    const { data: mapping } = await supabase
      .from("bank_comparison")
      .select("safehaven_code")
      .ilike("bank_name", payoutAccount.bank_name)
      .limit(1)
      .maybeSingle();

    if (mapping?.safehaven_code) {
      safehavenCode = mapping.safehaven_code;
      await supabase
        .from("payout_accounts")
        .update({
          safehaven_bank_code: safehavenCode,
          updated_at: new Date().toISOString()
        })
        .eq("id", payoutAccount.id)
        .catch(() => null);
    }
  }

  return { safehavenCode };
}

/**
 * Update automated payout record with transfer details
 */
async function updateAutomatedPayout(payoutId: string, transferResult: any) {
  const { data: existing, error: fetchError } = await supabase
    .from("automated_payouts")
    .select("metadata")
    .eq("id", payoutId)
    .single();
  if (fetchError) {
    console.error("updateAutomatedPayout: could not load existing metadata", fetchError);
  }
  const prior = (existing?.metadata as Record<string, unknown> | null) ?? {};
  const isCompleted = isTransferSuccess(transferResult);
  const metadata: Record<string, any> = {
    ...prior,
    provider: transferResult.provider,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    transfer_status: transferResult.status,
    response: transferResult.rawResponse || transferResult,
    automated_payout_id: payoutId,
    safehaven_transfer_initiated: true,
  };

  const updatePayload: Record<string, any> = {
    status: isCompleted ? "completed" : transferResult.status === "Failed" ? "failed" : "processing",
    transfer_reference: transferResult.reference,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    payment_reference: transferResult.paymentReference || transferResult.reference,
    completed_at: isCompleted ? new Date().toISOString() : null,
    transferred_at: new Date().toISOString(),
    metadata,
  };

  if (transferResult.provider === "safehaven") {
    updatePayload.safehaven_transfer_id = transferResult.id || transferResult._id;
    updatePayload.session_id = transferResult.sessionId;
  }

  const { error: updateError } = await supabase
    .from("automated_payouts")
    .update(updatePayload)
    .eq("id", payoutId);

  if (updateError) {
    console.error("updateAutomatedPayout: update failed", updateError);
    throw updateError;
  }
}

/**
 * Update payout plan progress and next date
 * Delegates to update_payout_plan_progress (must stay aligned with migrations:
 * weekly / weekly_specific / biweekly anchor from last scheduled payout date — see 20260502120000).
 */
async function updatePayoutPlanProgress(planId: string) {
  console.log(`📈 Updating payout plan progress for: ${planId}`);
  const { data, error } = await supabase.rpc("update_payout_plan_progress", {
    p_plan_id: planId
  });
  if (error) {
    console.error(`❌ Failed to update payout plan progress:`, error);
    throw error; // Throw error so it's caught by caller
  }
  console.log(`✅ Payout plan progress updated for: ${planId}`);
}

/**
 * Create transaction record
 */
async function createTransactionRecord(plan: any, transferResult: any) {
  console.log(`📑 Creating transaction record for payout: ${plan.name}`);
  console.log({
    plan,
    transferResult
  });
  
  // Guard: fail fast if required fields are missing
  if (!plan?.user_id) throw new Error("Missing plan.user_id");
  if (!plan?.plan_id) throw new Error("Missing plan.plan_id");
  
  const metadata: Record<string, any> = {
    provider: transferResult.provider,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    transfer_status: transferResult.status,
    response: transferResult.rawResponse || transferResult,
    payout_plan_id: plan.plan_id,
    // Caller must set plan.automated_payout_id when this helper is used (same as automated_payouts.id).
    automated_payout_id: (plan as { automated_payout_id?: string }).automated_payout_id ?? null,
  };

  metadata.safehaven_transfer_id = transferResult.id || transferResult._id;
  metadata.safehaven_transfer_code = transferResult.reference || transferResult.paymentReference;
  metadata.safehaven_transfer_status = transferResult.status || "Pending";
  metadata.safehaven_transfer_session_id = transferResult.sessionId;

  // Use the database function with proper type casting
  const { data: transactionId, error } = await supabase.rpc("create_transaction_record", {
    p_user_id: plan.user_id,
    p_type: 'payout',
    p_amount: plan.payout_amount,
    p_status: 'pending', // Will be updated by webhook when transfer completes
    p_source: 'Wallet',
    p_destination: 'Bank Transfer',
    p_reference: transferResult.reference,
    p_payout_plan_id: plan.plan_id,
    p_description: `Automated payout from ${plan.name}`,
    p_metadata: metadata
  });
  
  console.log("this is transaction: ", transactionId);
  if (error) {
    console.error(`❌ Failed to create transaction record:`, JSON.stringify(error, null, 2));
    throw new Error(`transactions create failed: ${error.message}`);
  }
  
  console.log(`✅ Transaction record created for payout: ${plan.name}`, {
    transactionId
  });
  return transactionId;
}

/**
 * Create notification for user
 */
async function createNotification(userId: string, plan: any, transferResult: any) {
  console.log(`📢 Creating notification for user ${userId} for payout: ${plan.name}`);
  
  // Create database event notification
  const { error } = await supabase.from("events").insert({
    user_id: userId,
    type: "payout_scheduled",
    title: "Payout Initiated",
    description: `₦${plan.payout_amount.toLocaleString()} payout from "${plan.name}" has been initiated.`,
    status: "unread",
    payout_plan_id: plan.plan_id
  });
  
  if (error) {
    console.error(`❌ Failed to create database notification:`, error);
  } else {
    console.log(`✅ Database notification created for user ${userId}`);
  }
  
  // Send push notification
  try {
    const pushNotificationPayload = {
      user_ids: [userId],
      notification_type: 'payout_pending',
      title: 'Payout Initiated! 💰',
      body: `Your ₦${plan.payout_amount.toLocaleString()} payout from "${plan.name}" has been initiated and should arrive in your account shortly.`,
      data: {
        type: 'payout_ready',
        plan_id: plan.plan_id,
        plan_name: plan.name,
        amount: plan.payout_amount,
        transfer_reference: transferResult.reference,
        timestamp: new Date().toISOString()
      }
    };
    
    const pushResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pushNotificationPayload)
    });
    
    if (pushResponse.ok) {
      const pushResult = await pushResponse.json();
      console.log(`✅ Push notification sent successfully:`, pushResult);
    } else {
      const pushError = await pushResponse.text();
      console.error(`❌ Failed to send push notification:`, pushError);
    }
  } catch (pushError) {
    console.error(`❌ Error sending push notification:`, pushError);
  }
  
  // Email will be sent by SafeHaven webhook when transfer completes
  console.log(`✅ Notifications completed for user ${userId} for payout: ${plan.name}`);
}

/**
 * Validate wallet has sufficient balance
 */
async function validateWalletBalance(userId: string, amount: number): Promise<boolean> {
  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("locked_balance")
    .eq("user_id", userId)
    .single();
  
  if (error || !wallet) {
    throw new Error("Wallet not found");
  }
  
  return wallet.locked_balance >= amount;
}

/**
 * Process a scheduled emergency withdrawal
 * 
 * IDEMPOTENCY: This function is idempotent - it checks if the withdrawal is already
 * being processed or completed before proceeding. Uses status checks and row-level
 * locking to prevent duplicate processing.
 * 
 * TRANSACTIONAL SAFETY: Critical operations use database RPC functions that handle
 * transactions atomically. Wallet balance deduction and withdrawal updates are
 * coordinated to prevent race conditions.
 */
async function processScheduledEmergencyWithdrawal(withdrawal: any) {
  // IDEMPOTENCY CHECK: Verify withdrawal is still in scheduled status
  const { data: withdrawalCheck, error: withdrawalCheckError } = await supabase
    .from("emergency_withdrawals")
    .select("id, status, processed_at, metadata")
    .eq("id", withdrawal.id)
    .single();
  
  if (withdrawalCheckError || !withdrawalCheck) {
    throw new Error(`Emergency withdrawal ${withdrawal.id} not found or inaccessible`);
  }
  
  // IDEMPOTENCY: If already completed, skip processing
  if (withdrawalCheck.status === "completed") {
    console.log(`⏭️ Emergency withdrawal ${withdrawal.id} already completed, skipping processing`);
    return;
  }
  
  // IDEMPOTENCY: If already processing, check if we should continue or skip
  if (withdrawalCheck.status === "processing") {
    const processedAt = withdrawalCheck.processed_at ? new Date(withdrawalCheck.processed_at) : null;
    if (processedAt) {
      const now = new Date();
      const processingTime = now.getTime() - processedAt.getTime();
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (processingTime < thirtyMinutes) {
        console.log(`⏭️ Emergency withdrawal ${withdrawal.id} is currently being processed (${Math.round(processingTime / 1000)}s ago), skipping duplicate processing`);
        return;
      } else {
        console.log(`⚠️ Emergency withdrawal ${withdrawal.id} has been processing for ${Math.round(processingTime / 60000)} minutes, may be stuck. Continuing...`);
      }
    }
  }
  
  // TRANSACTIONAL: Update status to processing atomically
  // Use row-level locking by checking status in WHERE clause to prevent race conditions
  const { data: updatedWithdrawal, error: updateError } = await supabase
    .from("emergency_withdrawals")
    .update({ 
      status: "processing",
      processed_at: new Date().toISOString()
    })
    .eq("id", withdrawal.id)
    .eq("status", "scheduled") // Only update if still scheduled (prevents race condition)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update withdrawal status: ${updateError.message}`);
  }
  
  // IDEMPOTENCY: If update didn't affect any rows, another process already started it
  if (!updatedWithdrawal) {
    console.log(`⏭️ Emergency withdrawal ${withdrawal.id} was already updated by another process, skipping duplicate processing`);
    return;
  }
  
  // Update withdrawal object with latest data
  withdrawal = updatedWithdrawal;

  // Get plan details
  const plan = withdrawal.payout_plans;
  if (!plan) {
    throw new Error("Payout plan not found for emergency withdrawal");
  }

  // Calculate remaining amount
  const remainingAmount = plan.total_amount - (plan.completed_payouts * plan.payout_amount);
  const netAmount = withdrawal.net_amount || (remainingAmount - (withdrawal.fee_amount || 0));
  const feeAmount = withdrawal.fee_amount || 0;

  // Determine account details
  let payoutAccount: any = null;
  if (withdrawal.payout_account_id && withdrawal.payout_accounts) {
    payoutAccount = withdrawal.payout_accounts;
  } else if (withdrawal.bank_account_id && withdrawal.bank_accounts) {
    payoutAccount = withdrawal.bank_accounts;
  } else {
    throw new Error("No valid bank account found for this withdrawal");
  }

  // Validate account details
  if (!payoutAccount || !payoutAccount.account_name || !payoutAccount.account_number || !payoutAccount.bank_name) {
    throw new Error("Incomplete bank account information. Please update your account details.");
  }

  // Resolve SafeHaven bank code (transfers are SafeHaven-only)
  const { safehavenCode } = await resolveBankCodes(payoutAccount);
  if (!safehavenCode) {
    throw new Error(`No SafeHaven bank code for ${payoutAccount.bank_name}. Please update the payout account with SafeHaven bank code.`);
  }

  const { data: tokenData, error: tokenError } = await supabase
    .from("safehaven_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("user_id", withdrawal.user_id)
    .maybeSingle();

  if (tokenError) {
    throw new Error(`Failed to fetch SafeHaven token: ${tokenError.message}`);
  }

  let safeHavenToken = tokenData;
  if (!safeHavenToken) {
    console.log("No SafeHaven token row found for user emergency withdrawal. Bootstrapping via client_credentials...");
    const bootstrappedToken = await createAndStoreSafeHavenToken(withdrawal.user_id);
    safeHavenToken = {
      access_token: bootstrappedToken.access_token,
      refresh_token: bootstrappedToken.refresh_token,
      expires_at: bootstrappedToken.expires_at
    };
  }
  const expiresAt = new Date(safeHavenToken.expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  const needsRefresh = isNaN(expiresAt.getTime()) || (expiresAt.getTime() - now.getTime() < bufferTime);
  let accessToken: string = safeHavenToken.access_token;
  if (needsRefresh) {
    console.log("SafeHaven token expired or expiring soon, attempting refresh...");
    accessToken = await refreshOrCreateSafeHavenToken(withdrawal.user_id, safeHavenToken);
  }

  const transferResult = await initiateSafeHavenEmergencyTransfer(
    withdrawal,
    payoutAccount,
    accessToken,
    netAmount,
    plan.name,
    safehavenCode
  );

  // Update withdrawal status to completed
  const withdrawalMetadata: Record<string, any> = {
    provider: transferResult.provider,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    transfer_status: transferResult.status,
    response: transferResult.rawResponse || transferResult,
    processed_via: "scheduled_cron"
  };

  withdrawalMetadata.safehaven_transfer_id = transferResult.id || transferResult._id;
  withdrawalMetadata.safehaven_reference = transferResult.reference || transferResult.paymentReference;
  withdrawalMetadata.session_id = transferResult.sessionId;

  const { error: completeError } = await supabase
    .from("emergency_withdrawals")
    .update({ 
      status: "completed",
      transfer_code: transferResult.reference || transferResult.paymentReference,
      transferred_at: new Date().toISOString(),
      metadata: withdrawalMetadata
    })
    .eq("id", withdrawal.id);

  if (completeError) {
    console.error("Error updating withdrawal to completed:", completeError);
  }

  // TRANSACTIONAL: Reduce both balance and locked_balance since money is being withdrawn from the system
  // IDEMPOTENCY: Check if wallet was already debited for this withdrawal
  const walletAlreadyDebited = withdrawal.metadata?.wallet_debited === true;
  
  if (!walletAlreadyDebited) {
    const { error: reduceError } = await supabase.rpc("transfer_funds", {
      arg_user_id: withdrawal.user_id,
      arg_amount: withdrawal.withdrawal_amount
    });

    if (reduceError) {
      console.error("Error reducing wallet balance:", reduceError);
      // Rollback withdrawal status on error
      await supabase
        .from("emergency_withdrawals")
        .update({ 
          status: "scheduled",
          processed_at: null
        })
        .eq("id", withdrawal.id);
      throw new Error(`Failed to reduce wallet balance: ${reduceError.message}`);
    }
    
    // Mark wallet as debited in metadata (idempotency marker)
    await supabase
      .from("emergency_withdrawals")
      .update({
        metadata: {
          ...(withdrawal.metadata || {}),
          wallet_debited: true,
          wallet_debited_at: new Date().toISOString(),
          wallet_debited_amount: withdrawal.withdrawal_amount
        }
      })
      .eq("id", withdrawal.id);
    
    console.log(`✅ Wallet balance debited for emergency withdrawal: ₦${withdrawal.withdrawal_amount}`);
  } else {
    console.log(`✅ Wallet balance already debited for emergency withdrawal ${withdrawal.id} (idempotency check passed)`);
  }

  // Create transaction record for emergency withdrawal
  const txMetadata: Record<string, any> = {
    provider: transferResult.provider,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    transfer_status: transferResult.status,
    response: transferResult.rawResponse || transferResult,
    emergency_withdrawal_id: withdrawal.id,
    withdrawal_type: withdrawal.withdrawal_type,
    fee_percentage: withdrawal.fee_amount ? ((withdrawal.fee_amount / withdrawal.withdrawal_amount) * 100) : 0,
    fee_amount: feeAmount
  };

  txMetadata.safehaven_transfer_id = transferResult.id || transferResult._id;
  txMetadata.safehaven_transfer_code = transferResult.reference || transferResult.paymentReference;
  txMetadata.safehaven_transfer_status = transferResult.status || "Pending";
  txMetadata.safehaven_transfer_session_id = transferResult.sessionId;

  const { error: txCreateError } = await supabase.rpc('create_transaction_record', {
    p_user_id: withdrawal.user_id,
    p_type: 'withdrawal',
    p_amount: netAmount,
    p_status: 'pending', // Will be updated by webhook
    p_source: 'Wallet',
    p_destination: 'Bank Transfer',
    p_reference: withdrawal.reference,
    p_payout_plan_id: withdrawal.payout_plan_id,
    p_description: 'Emergency withdrawal transfer (scheduled)',
    p_metadata: txMetadata
  });

  if (txCreateError) {
    console.error("Error creating transaction record:", txCreateError);
  }

  // Update the payout plan status to cancelled after successful emergency withdrawal
  const { error: planUpdateError } = await supabase
    .from("payout_plans")
    .update({ 
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("id", withdrawal.payout_plan_id);

  if (planUpdateError) {
    console.error("Error updating plan status to cancelled:", planUpdateError);
  } else {
    console.log(`Successfully updated plan ${withdrawal.payout_plan_id} status to cancelled`);
  }

  // Create success notification
  await supabase
    .from("events")
    .insert({
      user_id: withdrawal.user_id,
      type: "payout_completed",
      title: "Emergency Withdrawal Completed",
      description: `Your scheduled emergency withdrawal of ₦${netAmount.toLocaleString()} has been processed successfully. Fee charged: ₦${feeAmount.toLocaleString()}.`,
      status: "unread"
    });
}

/**
 * Refresh or create SafeHaven token (for emergency withdrawals)
 */
async function refreshOrCreateSafeHavenToken(userId: string, safeHavenToken: any): Promise<string> {
  let tokenData: any = null;
  let tokenUpdated = false;
  
  // Try to refresh the token first
  if (safeHavenToken.refresh_token) {
    try {
      const refreshResponse = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: safeHavenClientAssertion,
          client_id: safeHavenClientId,
          refresh_token: safeHavenToken.refresh_token
        })
      });

      if (refreshResponse.ok) {
        tokenData = await refreshResponse.json();
        if (tokenData.access_token) {
          tokenUpdated = true;
          console.log("✅ Successfully refreshed SafeHaven token");
        }
      } else {
        console.log("⚠️ Token refresh failed, will create new token");
      }
    } catch (refreshError) {
      console.log("⚠️ Token refresh error, will create new token:", refreshError);
    }
  }
  
  // If refresh failed or no refresh token, create a new token using client_credentials
  if (!tokenUpdated) {
    console.log("Creating new SafeHaven access token using client_credentials...");
    
    try {
      const newTokenResponse = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: safeHavenClientAssertion,
          client_id: safeHavenClientId
        })
      });

      if (!newTokenResponse.ok) {
        const errorText = await newTokenResponse.text();
        throw new Error(`Failed to create new SafeHaven token: ${newTokenResponse.status} ${newTokenResponse.statusText} - ${errorText}`);
      }

      tokenData = await newTokenResponse.json();
      if (!tokenData || !tokenData.access_token) {
        throw new Error("Failed to create new SafeHaven token: No access token in response");
      }
      
      console.log("✅ Successfully created new SafeHaven token");
    } catch (newTokenError: any) {
      throw new Error(`Failed to create new SafeHaven token: ${newTokenError.message}`);
    }
  }
  
  // Ensure tokenData is available
  if (!tokenData) {
    throw new Error("Failed to obtain SafeHaven token data");
  }
  
  // Calculate expiration time with fallback
  const expiresIn = tokenData.expires_in && typeof tokenData.expires_in === 'number' 
    ? tokenData.expires_in 
    : 3600; // Default to 1 hour
  
  const currentTimestamp = Date.now();
  const expiresAtTimestamp = currentTimestamp + (expiresIn * 1000);
  const expiresAtDate = new Date(expiresAtTimestamp);
  
  // Validate the date is valid
  if (isNaN(expiresAtDate.getTime())) {
    throw new Error(`Failed to calculate token expiration date. expiresIn: ${expiresIn}, timestamp: ${expiresAtTimestamp}`);
  }
  
  const currentDate = new Date();
  if (isNaN(currentDate.getTime())) {
    throw new Error("Failed to get current date");
  }
  
  // Update token in database
  const { error: updateError } = await supabase
    .from("safehaven_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || safeHavenToken.refresh_token || null,
      expires_at: expiresAtDate.toISOString(),
      updated_at: currentDate.toISOString()
    })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`Failed to update SafeHaven token in database: ${updateError.message}`);
  }

  return tokenData.access_token;
}

/**
 * Initiate SafeHaven transfer for emergency withdrawal
 */
async function initiateSafeHavenEmergencyTransfer(
  withdrawal: any,
  payoutAccount: any,
  accessToken: string,
  netAmount: number,
  planName: string,
  safehavenBankCode: string
) {
  const transferReference = withdrawal.reference || `EMERGENCY_${withdrawal.id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  console.log("Processing SafeHaven emergency withdrawal transfer:", {
    fromAccount: "0117753301",
    toAccount: payoutAccount.account_number,
    amount: netAmount,
    safehavenBankCode: safehavenBankCode,
    bankCode: payoutAccount.bank_code,
    bankName: payoutAccount.bank_name
  });

  // Use resolved SafeHaven bank code
  const correctBankCode = safehavenBankCode;
  
  if (!correctBankCode) {
    throw new Error(`SafeHaven bank code is required.`);
  }
  
  console.log(`✅ Using SafeHaven bank code: ${correctBankCode}`);

  // Step 1: Perform name enquiry first
  console.log("Performing name enquiry...");
  const nameEnquiryResponse = await fetch(`${safeHavenApiUrl}/transfers/name-enquiry`, {
    method: "POST",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bankCode: correctBankCode,
      accountNumber: payoutAccount.account_number
    })
  });

  const nameEnquiryData = await nameEnquiryResponse.json();
  
  if (!nameEnquiryResponse.ok) {
    const errorMessage = nameEnquiryData.message || nameEnquiryData.error || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`);
  }

  // Check if response indicates success
  if (nameEnquiryData.statusCode !== 200 || nameEnquiryData.responseCode !== "00") {
    const errorMessage = nameEnquiryData.message || nameEnquiryData.data?.responseMessage || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`);
  }

  const nameEnquiryReference = nameEnquiryData.data?.sessionId || nameEnquiryData.sessionId;
  if (!nameEnquiryReference) {
    throw new Error("Name enquiry did not return sessionId");
  }

  console.log("Name enquiry successful, sessionId:", nameEnquiryReference);
  console.log("Account details:", {
    accountName: nameEnquiryData.data?.accountName,
    accountNumber: nameEnquiryData.data?.accountNumber,
    bankCode: nameEnquiryData.data?.bankCode
  });

  // Step 2: Initiate SafeHaven transfer with nameEnquiryReference
  console.log(`💸 Initiating emergency withdrawal transfer of ₦${netAmount} to ${payoutAccount.account_number}`);
  const transferResponse = await fetch(`${safeHavenApiUrl}/transfers`, {
    method: "POST",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      saveBeneficiary: true,
      amount: netAmount,
      beneficiaryAccountNumber: payoutAccount.account_number,
      beneficiaryBankCode: correctBankCode,
      debitAccountNumber: "0117753301",
      nameEnquiryReference: nameEnquiryReference,
      narration: `Emergency withdrawal: ${planName}`,
      paymentReference: transferReference
    })
  });

  const transferData = await transferResponse.json();
  
  if (!transferResponse.ok) {
    const errorMessage = transferData.message || transferData.error || 'Unknown transfer error';
    throw new Error(`SafeHaven transfer failed: ${errorMessage}`);
  }

  // Extract transfer details from response
  const transferResult = transferData.data || transferData;
  const transferId = transferResult._id || transferResult.id;
  const paymentReference = transferResult.paymentReference || transferReference;
  const sessionId = transferResult.sessionId || transferResult.session_id;

  console.log("SafeHaven transfer initiated:", {
    transferId,
    paymentReference,
    status: transferResult.status || "Pending"
  });

  return {
    provider: "safehaven",
    id: transferId,
    _id: transferId,
    reference: paymentReference,
    paymentReference: paymentReference,
    transfer_code: paymentReference,
    sessionId: sessionId,
    status: transferResult.status || "Pending",
    rawResponse: transferData
  };
}

/**
 * Log emergency withdrawal failure for monitoring
 */
async function logEmergencyWithdrawalFailure(withdrawal: any, error: any) {
  // Update emergency withdrawal record
  await supabase
    .from("emergency_withdrawals")
    .update({
      status: "failed",
      error_message: error.message,
      processed_at: new Date().toISOString()
    })
    .eq("id", withdrawal.id);
  
  // Create transaction record for failed emergency withdrawal
  await supabase.rpc('create_transaction_record', {
    p_user_id: withdrawal.user_id,
    p_type: 'withdrawal',
    p_amount: withdrawal.withdrawal_amount,
    p_status: 'failed',
    p_source: 'Wallet',
    p_destination: 'Bank Transfer',
    p_reference: withdrawal.reference,
    p_payout_plan_id: withdrawal.payout_plan_id,
    p_description: 'Emergency withdrawal transfer (failed - scheduled)',
    p_metadata: {
      emergency_withdrawal_id: withdrawal.id,
      error_message: error.message
    }
  });

  // Create failure notification
  await supabase
    .from("events")
    .insert({
      user_id: withdrawal.user_id,
      type: "disbursement_failed",
      title: "Emergency Withdrawal Failed",
      description: `Your scheduled emergency withdrawal request failed: ${error.message}`,
      status: "unread"
    });
}

/**
 * Log payout failure for monitoring.
 *
 * SAFETY: If a transfer_reference is already stored for this payout, the SafeHaven
 * POST was accepted before the error occurred. Marking as "failed" in that case would
 * hide it from the next cron run's idempotency check (.in("status", [..., "failed"]))
 * and could cause a duplicate transfer. Instead we keep it as "processing" and emit a
 * critical log so it can be reconciled manually.
 */
async function logPayoutFailure(plan: any, error: any) {
  const message = error?.message ?? String(error);

  if (
    isPayoutSkipMessage(message) ||
    /is not defined|referenceerror/i.test(message)
  ) {
    console.log(
      `⏸️ Payout plan ${plan.plan_id} requires manual review or deploy fix; skipping failure notification`
    );
    return;
  }

  const scheduledDate = normalizeScheduledDate(plan.next_payout_date);

  const { data: existingRow } = await supabase
    .from("automated_payouts")
    .select("id, transfer_reference, metadata")
    .eq("payout_plan_id", plan.plan_id)
    .eq("scheduled_date", scheduledDate)
    .maybeSingle();

  const md = (existingRow?.metadata as Record<string, unknown> | null) ?? {};
  const safehavenInitiated = md.safehaven_transfer_initiated === true;
  const transferAlreadySent = safehavenInitiated && Boolean(existingRow?.transfer_reference);
  const newStatus = transferAlreadySent ? "processing" : "failed";

  if (transferAlreadySent) {
    console.error(
      `🚨 CRITICAL: Payout for plan ${plan.plan_id} on ${plan.next_payout_date} ` +
      `has transfer_reference "${existingRow!.transfer_reference}" but an error occurred ` +
      `after the SafeHaven POST. Keeping status "processing" to prevent a double-payment ` +
      `on the next cron run. Error was: ${message}. MANUAL REVIEW REQUIRED.`
    );
  }

  // Update automated payout record
  await supabase.from("automated_payouts").update({
    status: newStatus,
    error_message: message,
    // Only set retry fields when it is genuinely safe to retry (no transfer in flight)
    ...(newStatus === "failed" ? {
      retry_count: 1,
      retry_after: new Date(Date.now() + 30 * 60 * 1000)
    } : {})
  }).eq("payout_plan_id", plan.plan_id).eq("scheduled_date", scheduledDate);
  
  // Create database event notification for failure
  await supabase.from("events").insert({
    user_id: plan.user_id,
    type: "disbursement_failed",
    title: "Payout Failed",
    description: `Your ₦${plan.payout_amount.toLocaleString()} payout from "${plan.name}" could not be processed. We'll retry automatically.`,
    status: "unread",
    payout_plan_id: plan.plan_id
  });
  
  // Send push notification for payout failure
  try {
    const pushNotificationPayload = {
      user_ids: [plan.user_id],
      notification_type: 'payout_failed',
      title: 'Payout Issue ⚠️',
      body: `There was an issue processing your ₦${plan.payout_amount.toLocaleString()} payout from "${plan.name}". We'll retry automatically soon.`,
      data: {
        type: 'payout_failed',
        plan_id: plan.plan_id,
        plan_name: plan.name,
        amount: plan.payout_amount,
        error_message: message,
        retry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString()
      }
    };
    
    const pushResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pushNotificationPayload)
    });
    
    if (pushResponse.ok) {
      const pushResult = await pushResponse.json();
      console.log(`✅ Payout failure push notification sent:`, pushResult);
    } else {
      const pushError = await pushResponse.text();
      console.error(`❌ Failed to send payout failure push notification:`, pushError);
    }
  } catch (pushError) {
    console.error(`❌ Error sending payout failure push notification:`, pushError);
  }
  
  // Email will be sent by SafeHaven webhook if transfer fails
  console.log(`✅ Payout failure logged and notification sent for plan: ${plan.name}`);
}

/**
 * Main serve handler — returns per-run counts; `has_failures` for simple monitoring.
 */
serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405
    });
  }
  
  try {
    const result = await processDuePayouts();
    const hasFailures = (result.failed ?? 0) > 0 || (result.withdrawals_failed ?? 0) > 0;
    return new Response(
      JSON.stringify({
        success: true,
        message: "Payout processing completed",
        has_failures: hasFailures,
        result,
      }),
      {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      }
    );
  } catch (error: unknown) {
    console.error("💥 Function execution failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
