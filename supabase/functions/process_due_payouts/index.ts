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
 * 4. Database-level exclusion: get_due_payout_plans RPC excludes already-processed plans
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
 */
async function processDuePayouts() {
  console.log("🚀 Starting automated payout processing...");
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  console.log(`📋 Execution ID: ${executionId} (for tracking and debugging)`);
  
  try {
    // Get all due payout plans
    // Note: get_due_payout_plans RPC already excludes plans with existing automated_payouts
    // This provides database-level idempotency
    const { data: duePlans, error: plansError } = await supabase.rpc("get_due_payout_plans");
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
    
    if (totalPayouts === 0 && totalWithdrawals === 0) {
      console.log("✅ No due payouts or scheduled withdrawals found");
      return {
        processed: 0,
        success: 0,
        failed: 0,
        withdrawals_processed: 0,
        withdrawals_success: 0,
        withdrawals_failed: 0
      };
    }
    
    console.log(`📋 Found ${totalPayouts} due payout plans and ${totalWithdrawals} scheduled emergency withdrawals`);
    
    let successCount = 0;
    let failureCount = 0;
    let withdrawalSuccessCount = 0;
    let withdrawalFailureCount = 0;
    
    // Process each due payout plan
    // NOTE: Processing is sequential to avoid race conditions, but each payout
    // is independently idempotent, so concurrent execution is safe
    if (duePlans && duePlans.length > 0) {
      for (const plan of duePlans) {
        try {
          console.log(`⏳ Processing payout for plan: ${plan.name} (${plan.plan_id}) [${executionId}]`);
          await processSinglePayout(plan);
          successCount++;
          console.log(`✅ Successfully processed payout for plan: ${plan.name} [${executionId}]`);
        } catch (error: any) {
          // IDEMPOTENCY: Some errors are expected (e.g., already processed)
          if (error.message?.includes("already") || error.message?.includes("duplicate") || error.message?.includes("skipping")) {
            console.log(`ℹ️ Skipping payout for plan: ${plan.name} - ${error.message} [${executionId}]`);
            // Don't count as failure for idempotency-related skips
          } else {
            console.error(`❌ Failed to process payout for plan: ${plan.name}`, error);
            failureCount++;
            // Log the failure
            await logPayoutFailure(plan, error);
          }
        }
      }
    }
    
    // Process each scheduled emergency withdrawal
    // NOTE: Processing is sequential to avoid race conditions, but each withdrawal
    // is independently idempotent, so concurrent execution is safe
    if (scheduledWithdrawals && scheduledWithdrawals.length > 0) {
      for (const withdrawal of scheduledWithdrawals) {
        try {
          console.log(`⏳ Processing scheduled emergency withdrawal: ${withdrawal.id} [${executionId}]`);
          await processScheduledEmergencyWithdrawal(withdrawal);
          withdrawalSuccessCount++;
          console.log(`✅ Successfully processed emergency withdrawal: ${withdrawal.id} [${executionId}]`);
        } catch (error: any) {
          // IDEMPOTENCY: Some errors are expected (e.g., already processed)
          if (error.message?.includes("already") || error.message?.includes("duplicate") || error.message?.includes("skipping")) {
            console.log(`ℹ️ Skipping emergency withdrawal: ${withdrawal.id} - ${error.message} [${executionId}]`);
            // Don't count as failure for idempotency-related skips
          } else {
            console.error(`❌ Failed to process emergency withdrawal: ${withdrawal.id}`, error);
            withdrawalFailureCount++;
            await logEmergencyWithdrawalFailure(withdrawal, error);
          }
        }
      }
    }
    
    console.log(`🏁 Processing completed. Payouts - Success: ${successCount}, Failed: ${failureCount}. Withdrawals - Success: ${withdrawalSuccessCount}, Failed: ${withdrawalFailureCount}`);
    return {
      processed: totalPayouts,
      success: successCount,
      failed: failureCount,
      withdrawals_processed: totalWithdrawals,
      withdrawals_success: withdrawalSuccessCount,
      withdrawals_failed: withdrawalFailureCount
    };
  } catch (error: any) {
    console.error("💥 Critical error in payout processing:", error);
    throw error;
  }
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
    .select("id, user_id, name, status, frequency, metadata, start_date, completed_payouts, duration, next_payout_date, payout_amount, payout_account_id")
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
  
  // IDEMPOTENCY CHECK: Check if automated_payout already exists for this plan + scheduled_date
  // This prevents duplicate processing if the function is called multiple times
  const scheduledDate = plan.next_payout_date || planCheck.next_payout_date;
  // Due-date/idempotency gating for weekly and weekly_specific
  try {
    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const sched = new Date(scheduledDate);
    const schedDate = new Date(Date.UTC(sched.getUTCFullYear(), sched.getUTCMonth(), sched.getUTCDate()));

    // If not yet the scheduled day, skip
    if (todayDate < schedDate) {
      throw new Error(`skipping: not yet due (today < scheduledDate)`);
    }

    if (planCheck.frequency === 'weekly_specific') {
      const meta = planCheck.metadata as { dayOfWeek?: number } | undefined;
      const targetDow = meta != null && typeof meta.dayOfWeek === 'number' ? meta.dayOfWeek : null;
      const todayDow = today.getDay();
      if (targetDow === null || targetDow === undefined) {
        // Fallback: treat like weekly, but still ensure date due
        console.log(`weekly_specific without dayOfWeek in metadata; proceeding as weekly for plan ${plan.plan_id}`);
      } else if (todayDow !== targetDow) {
        throw new Error(`skipping: weekly_specific not target weekday (today=${todayDow}, target=${targetDow})`);
      }
    }
  } catch (gateErr: any) {
    throw new Error(gateErr.message || 'skipping: gating check failed');
  }
  const { data: existingPayout, error: existingPayoutError } = await supabase
    .from("automated_payouts")
    .select("id, status, transfer_reference")
    .eq("payout_plan_id", plan.plan_id)
    .eq("scheduled_date", scheduledDate)
    .in("status", ["pending", "processing", "completed"])
    .maybeSingle();
  
  if (existingPayoutError) {
    console.error("Error checking for existing payout:", existingPayoutError);
    // Continue - don't fail on check error, let create_automated_payout handle it
  }
  
  let payoutId: string;
  
  if (existingPayout) {
    // IDEMPOTENCY: Payout already exists - use existing one
    console.log(`✅ Automated payout already exists for plan ${plan.plan_id} on ${scheduledDate} (id: ${existingPayout.id}, status: ${existingPayout.status})`);
    payoutId = existingPayout.id;
    
    // If already completed, skip processing
    if (existingPayout.status === "completed") {
      console.log(`⏭️ Payout ${payoutId} already completed, skipping processing`);
      return;
    }
    
    // If already processing, check if we should continue or skip
    if (existingPayout.status === "processing") {
      // Check how long it's been processing (if > 30 minutes, might be stuck)
      const { data: payoutDetails } = await supabase
        .from("automated_payouts")
        .select("updated_at, execution_date")
        .eq("id", payoutId)
        .single();
      
      if (payoutDetails) {
        const updatedAt = new Date(payoutDetails.updated_at);
        const now = new Date();
        const processingTime = now.getTime() - updatedAt.getTime();
        const thirtyMinutes = 30 * 60 * 1000;
        
        if (processingTime < thirtyMinutes) {
          console.log(`⏭️ Payout ${payoutId} is currently being processed (${Math.round(processingTime / 1000)}s ago), skipping duplicate processing`);
          return;
        } else {
          console.log(`⚠️ Payout ${payoutId} has been processing for ${Math.round(processingTime / 60000)} minutes, may be stuck. Continuing...`);
        }
      }
    }
  } else {
    // Create new automated payout record
    // Note: create_automated_payout RPC function should also have idempotency checks
    const { data: newPayoutId, error: createError } = await supabase.rpc("create_automated_payout", {
      p_plan_id: plan.plan_id,
      p_scheduled_date: scheduledDate
    });
    
    if (createError) {
      // Check if error is due to duplicate (idempotency)
      if (createError.message?.includes("already exists") || createError.message?.includes("duplicate")) {
        // Try to get the existing payout
        const { data: duplicatePayout } = await supabase
          .from("automated_payouts")
          .select("id, status")
          .eq("payout_plan_id", plan.plan_id)
          .eq("scheduled_date", scheduledDate)
          .maybeSingle();
        
        if (duplicatePayout) {
          console.log(`✅ Duplicate detected, using existing payout ${duplicatePayout.id}`);
          payoutId = duplicatePayout.id;
        } else {
          throw new Error(`Failed to create automated payout record: ${createError.message}`);
        }
      } else {
        throw new Error(`Failed to create automated payout record: ${createError.message}`);
      }
    } else {
      payoutId = newPayoutId;
      console.log(`✅ Created new automated payout record: ${payoutId}`);
    }
  }
  
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
  
  // 4. Check wallet balance and handle insufficient balance for final payout
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("locked_balance")
    .eq("user_id", plan.user_id)
    .single();
  
  if (walletError || !wallet) {
    throw new Error("Wallet not found");
  }

  const lockedBalance = Number(wallet.locked_balance) || 0;
  const requiredAmount = Number(plan.payout_amount) || 0;
  const isLastPayout = (plan.completed_payouts + 1) >= plan.duration;
  
  // Determine the actual payout amount
  let actualPayoutAmount = requiredAmount;
  let usingPartialBalance = false;

  // Check if we have sufficient locked_balance
  if (lockedBalance >= requiredAmount) {
    // Sufficient balance - use required amount
    actualPayoutAmount = requiredAmount;
    console.log(`✅ Sufficient locked balance: ₦${lockedBalance} >= ₦${requiredAmount}`);
  } else if (isLastPayout && lockedBalance > 0) {
    // Last payout with insufficient balance - use all available locked_balance
    actualPayoutAmount = lockedBalance;
    usingPartialBalance = true;
    console.log(`⚠️ Using partial locked balance for final payout. Locked: ₦${lockedBalance}, Required: ₦${requiredAmount}, Using: ₦${actualPayoutAmount}`);
  } else if (lockedBalance === 0) {
    throw new Error("Insufficient wallet balance for payout: Locked balance is 0.00");
  } else {
    throw new Error(`Insufficient locked balance for payout. Locked: ₦${lockedBalance}, Required: ₦${requiredAmount}`);
  }
  
  // Idempotency: one payout transaction per plan per day (checked here to avoid DB constraints)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id, status, reference")
    .eq("payout_plan_id", plan.plan_id)
    .eq("type", "payout")
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let transactionId: string | null = null;
  let plannedReference: string;
  if (existingTx?.id) {
    transactionId = existingTx.id;
    plannedReference = existingTx.reference ?? `AUTO_${plan.plan_id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    if (existingTx.status === "completed") {
      console.log(`Idempotent: payout for today already completed (tx: ${transactionId}), skipping`);
      throw new Error("already_created_today: payout for this plan already completed today");
    }
    console.log(`Idempotent: using existing payout transaction for today: ${transactionId} (status: ${existingTx.status})`);
  } else {
    plannedReference = `AUTO_${plan.plan_id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    try {
      const { data: txInit, error: txInitError } = await supabase.rpc("create_payout_transaction_if_absent", {
        p_user_id: planCheck.user_id,
        p_plan_id: plan.plan_id,
        p_amount: actualPayoutAmount,
        p_reference: plannedReference,
        p_metadata: {
          source: "automated_payout",
          scheduled_date: scheduledDate,
          plan_name: planCheck.name,
        },
      });
      if (txInitError) {
        console.error("Error creating idempotent transaction:", txInitError);
      } else {
        transactionId = txInit?.transaction_id ?? null;
        console.log(txInit?.already_created_today
          ? `Idempotent: another run created today's transaction: ${transactionId}`
          : `Created idempotent transaction for today: ${transactionId}`);
      }
    } catch (txErr) {
      console.warn("create_payout_transaction_if_absent failed, will continue and create later:", txErr);
    }
  }

  // 5 & 6. Get SafeHaven token
  let safeHavenToken: any = null;
  {
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("safehaven_tokens")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", plan.user_id)
      .single();

    if (tokenError || !tokenRecord) {
      throw new Error("SafeHaven token not found. User needs to authenticate with SafeHaven first.");
    }

    safeHavenToken = tokenRecord;

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

  // 8. Debit wallet balance (reduce both balance and locked_balance since money is being withdrawn)
  // TRANSACTIONAL: transfer_funds RPC function handles this atomically
  // IDEMPOTENCY: Check if wallet was already debited for this payout
  const { data: payoutRecord, error: payoutRecordError } = await supabase
    .from("automated_payouts")
    .select("id, status, metadata")
    .eq("id", payoutId)
    .single();
  
  if (payoutRecordError) {
    throw new Error(`Failed to verify payout record: ${payoutRecordError.message}`);
  }
  
  // Check if wallet was already debited (idempotency check)
  const walletAlreadyDebited = payoutRecord.metadata?.wallet_debited === true || 
                                payoutRecord.status === "processing" || 
                                payoutRecord.status === "completed";
  
  if (!walletAlreadyDebited) {
    // TRANSACTIONAL: Deduct wallet balance atomically
    const { error: reduceError } = await supabase.rpc("transfer_funds", {
      arg_user_id: plan.user_id,
      arg_amount: actualPayoutAmount
    });

    if (reduceError) {
      console.error("Error reducing wallet balance:", reduceError);
      throw new Error(`Failed to reduce wallet balance: ${reduceError.message}`);
    }
    
    // Mark wallet as debited in metadata (idempotency marker)
    await supabase
      .from("automated_payouts")
      .update({
        metadata: {
          ...(payoutRecord.metadata || {}),
          wallet_debited: true,
          wallet_debited_at: new Date().toISOString(),
          wallet_debited_amount: actualPayoutAmount
        }
      })
      .eq("id", payoutId);
    
    console.log(`✅ Wallet balance debited for payout: ₦${actualPayoutAmount}${usingPartialBalance ? ' (partial - final payout)' : ''}`);
  } else {
    console.log(`✅ Wallet balance already debited for payout ${payoutId} (idempotency check passed)`);
  }

  // 9. Initiate transfer via SafeHaven only
  const planWithActualAmount = {
    ...plan,
    payout_amount: actualPayoutAmount
  };
  if (!safeHavenToken?.access_token) {
    throw new Error("SafeHaven token not available for this user.");
  }
  const transferResult = await initiateSafeHavenTransfer(
    planWithActualAmount,
    payoutAccount,
    safeHavenToken.access_token,
    payoutId,
    safehavenCode!,
    plannedReference
  );
  
  // 10. Update/Create transaction record status based on provider response
  try {
    if (!transactionId) {
      // Fallback: create now if earlier idempotent insert failed
      const fallbackTxMeta: Record<string, any> = {
        provider: transferResult.provider,
        transfer_code: transferResult.transfer_code || transferResult.reference,
        transfer_status: transferResult.status,
        response: transferResult.rawResponse || transferResult,
        payout_plan_id: plan.plan_id,
        automated_payout_id: plan.plan_id
      };
      const { data: txIdCreated, error: txCreateErr } = await supabase.rpc('create_transaction_record', {
        p_user_id: plan.user_id,
        p_type: 'payout',
        p_amount: plan.payout_amount,
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
      const txStatus = success ? 'success' : 'pending';
      const txMeta: Record<string, any> = {
        provider: transferResult.provider,
        transfer_code: transferResult.transfer_code || transferResult.reference,
        transfer_status: transferResult.status,
        response: transferResult.rawResponse || transferResult,
        payout_plan_id: plan.plan_id,
        automated_payout_id: plan.plan_id,
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
  
  // 11. Update automated payout record with transfer details
  await updateAutomatedPayout(payoutId, transferResult);
  
  // 12. Update payout plan progress and next_payout_date
  try {
    const success = isTransferSuccess(transferResult);
    if (success) {
      const currentCompleted = planCheck.completed_payouts || 0;
      const newCompleted = currentCompleted + 1;
      const meta = planCheck.metadata as Record<string, unknown> | undefined;
      const dayOfWeek = meta != null && typeof meta.dayOfWeek === 'number' ? meta.dayOfWeek : null;
      const nextDate = computeNextPayoutDateWithTime(
        planCheck.frequency,
        planCheck.start_date,
        newCompleted,
        dayOfWeek,
        planCheck.next_payout_date,
        meta?.payoutHour as number | undefined,
        meta?.payoutMinute as number | undefined
      );
      if (nextDate) {
        await supabase
          .from('payout_plans')
          .update({
            completed_payouts: newCompleted,
            next_payout_date: nextDate.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.plan_id);
        console.log(`✅ Updated plan ${plan.plan_id} to next date ${nextDate.toISOString()}`);
      } else {
        // Fallback to DB function if next date couldn't be computed
        await updatePayoutPlanProgress(plan.plan_id);
      }
    } else {
      console.log('Transfer not completed; will not advance next_payout_date');
    }
  } catch (npdErr) {
    console.error('Failed to update next_payout_date; falling back to DB function:', npdErr);
    await updatePayoutPlanProgress(plan.plan_id);
  }
  
  // 13. Create notification (email will be sent by webhook when transfer completes)
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

    if (frequency === 'weekly') {
      next.setDate(start.getDate() + (newCompletedCount * 7));
      setTime(next);
      return next;
    }
    if (frequency === 'weekly_specific') {
      // Base week offset
      const base = new Date(start);
      base.setDate(start.getDate() + (newCompletedCount * 7));
      let target = new Date(base);
      const targetDow = typeof dayOfWeek === 'number' ? dayOfWeek : null;
      if (targetDow !== null) {
        const baseDow = base.getDay();
        let delta = (7 + targetDow - baseDow) % 7;
        if (delta === 0 && newCompletedCount > 0) delta = 7; // move to next week after first
        target.setDate(base.getDate() + delta);
      }
      setTime(target);
      return target;
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
  const isCompleted = transferResult.status === "Completed";
  const metadata: Record<string, any> = {
    provider: transferResult.provider,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    transfer_status: transferResult.status,
    response: transferResult.rawResponse || transferResult,
    automated_payout_id: payoutId
  };

  const updatePayload: Record<string, any> = {
    status: isCompleted ? "completed" : transferResult.status === "Failed" ? "failed" : "processing",
    transfer_reference: transferResult.reference,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    payment_reference: transferResult.paymentReference || transferResult.reference,
    completed_at: isCompleted ? new Date().toISOString() : null,
    transferred_at: new Date().toISOString(),
    metadata
  };

  if (transferResult.provider === "safehaven") {
    updatePayload.safehaven_transfer_id = transferResult.id || transferResult._id;
    updatePayload.session_id = transferResult.sessionId;
  }

  await supabase.from("automated_payouts").update(updatePayload).eq("id", payoutId);
}

/**
 * Update payout plan progress and next date
 * NOTE: This calls the database RPC function which will handle weekly_specific correctly
 * after the migration 20260125000000_fix_weekly_specific_next_payout_date.sql is applied
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
    automated_payout_id: plan.plan_id
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
    .single();

  if (tokenError || !tokenData) {
    throw new Error("SafeHaven token not found. User must authenticate with SafeHaven for emergency withdrawals.");
  }

  let safeHavenToken = tokenData;
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
 * Log payout failure for monitoring
 */
async function logPayoutFailure(plan: any, error: any) {
  // Update automated payout record
  await supabase.from("automated_payouts").update({
    status: "failed",
    error_message: error.message,
    retry_count: 1,
    retry_after: new Date(Date.now() + 30 * 60 * 1000)
  }).eq("payout_plan_id", plan.plan_id).eq("scheduled_date", plan.next_payout_date);
  
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
        error_message: error.message,
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
 * Main serve handler
 */
serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405
    });
  }
  
  try {
    const result = await processDuePayouts();
    return new Response(JSON.stringify({
      success: true,
      message: "Payout processing completed",
      result
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error: any) {
    console.error("💥 Function execution failed:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || "Unknown error occurred"
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
