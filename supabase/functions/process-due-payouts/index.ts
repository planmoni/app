import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Automated Payout Processing Function
 *
 * This function runs on a schedule to process due payout plans
 * and initiate bank transfers via SafeHaven Transfer API.
 */ 
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const safeHavenClientId = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID") || Deno.env.get("SAFEHAVEN_CLIENT_ID");
const safeHavenClientAssertion = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION") || Deno.env.get("SAFEHAVEN_CLIENT_ASSERTION");
const safeHavenApiUrl = "https://api.safehavenmfb.com";
const paystackSecretKey = Deno.env.get("PAYSTACK_LIVE_SECRET_KEY") || Deno.env.get("PAYSTACK_SECRET_KEY");
const paystackApiUrl = "https://api.paystack.co";
/**
 * Main function to process due payouts and scheduled emergency withdrawals
 */ async function processDuePayouts() {
  console.log("🚀 Starting automated payout processing...");
  try {
    // Get all due payout plans
    const { data: duePlans, error: plansError } = await supabase.rpc("get_due_payout_plans");
    if (plansError) {
      console.error("❌ Error fetching due payout plans:", plansError);
      throw plansError;
    }
    
    // Get scheduled emergency withdrawals that are due for processing
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
      .eq("status", "scheduled")
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
    if (duePlans && duePlans.length > 0) {
      for (const plan of duePlans){
        try {
          console.log(`⏳ Processing payout for plan: ${plan.name} (${plan.plan_id})`);
          await processSinglePayout(plan);
          successCount++;
          console.log(`✅ Successfully processed payout for plan: ${plan.name}`);
        } catch (error) {
          console.error(`❌ Failed to process payout for plan: ${plan.name}`, error);
          failureCount++;
          // Log the failure
          await logPayoutFailure(plan, error);
        }
      }
    }
    
    // Process each scheduled emergency withdrawal
    if (scheduledWithdrawals && scheduledWithdrawals.length > 0) {
      for (const withdrawal of scheduledWithdrawals) {
        try {
          console.log(`⏳ Processing scheduled emergency withdrawal: ${withdrawal.id}`);
          await processScheduledEmergencyWithdrawal(withdrawal);
          withdrawalSuccessCount++;
          console.log(`✅ Successfully processed emergency withdrawal: ${withdrawal.id}`);
        } catch (error) {
          console.error(`❌ Failed to process emergency withdrawal: ${withdrawal.id}`, error);
          withdrawalFailureCount++;
          await logEmergencyWithdrawalFailure(withdrawal, error);
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
  } catch (error) {
    console.error("💥 Critical error in payout processing:", error);
    throw error;
  }
}
/**
 * Process a single payout plan
 */ async function processSinglePayout(plan) {
  // 1. Create automated payout record
  const { data: payoutId, error: createError } = await supabase.rpc("create_automated_payout", {
    p_plan_id: plan.plan_id,
    p_scheduled_date: plan.next_payout_date
  });
  if (createError) {
    throw new Error(`Failed to create automated payout record: ${createError.message}`);
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
  const { safehavenCode, paystackCode } = await resolveBankCodes(payoutAccount);
  const canUseSafeHaven = !!safehavenCode;
  const paystackBankCode = payoutAccount.bank_code || paystackCode;
  const canUsePaystack = !!paystackSecretKey && (!!payoutAccount.paystack_recipient_code || !!paystackBankCode);

  if (!canUseSafeHaven && !canUsePaystack) {
    throw new Error(
      `No SafeHaven bank code or Paystack configuration available for ${payoutAccount.bank_name} (${payoutAccount.account_number}). Please update bank_comparison mappings.`
    );
  }

  if (canUseSafeHaven) {
    payoutAccount.safehaven_bank_code = safehavenCode;
  }
  
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
  
  // 5 & 6. Get SafeHaven token only if required
  let safeHavenToken: any = null;
  if (canUseSafeHaven) {
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
    const bufferTime = 5 * 60 * 1000;
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
        } catch (newTokenError) {
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

  // 7. Get user's SafeHaven default account (fromAccount)
//   const { data: safeHavenAccount, error: accountError } = await supabase
//     .from("safehaven_accounts")
//     .select("account_number, account_name, can_debit, account_balance")
//     .eq("user_id", plan.user_id)
//     .eq("is_deleted", false)
//     .order("is_default", { ascending: false })
//     .order("account_balance", { ascending: false })
//     .limit(1)
//     .single();

//   if (accountError || !safeHavenAccount) {
//     throw new Error("SafeHaven account not found. User needs to have a SafeHaven account.");
//   }

//   if (!safeHavenAccount.can_debit) {
//     throw new Error("SafeHaven account does not allow debits");
//   }

//   if (safeHavenAccount.account_balance < plan.payout_amount) {
//     throw new Error(`Insufficient balance. Available: ₦${safeHavenAccount.account_balance}, Required: ₦${plan.payout_amount}`);
//   }

  // 8. Debit wallet balance (reduce both balance and locked_balance since money is being withdrawn)
  const { error: reduceError } = await supabase.rpc("transfer_funds", {
    arg_user_id: plan.user_id,
    arg_amount: actualPayoutAmount
  });

  if (reduceError) {
    console.error("Error reducing wallet balance:", reduceError);
    throw new Error(`Failed to reduce wallet balance: ${reduceError.message}`);
  }

  console.log(`✅ Wallet balance debited for payout: ₦${actualPayoutAmount}${usingPartialBalance ? ' (partial - final payout)' : ''}`);

  // 9. Initiate transfer via SafeHaven or fallback to Paystack
  // Create a modified plan object with the actual payout amount
  const planWithActualAmount = {
    ...plan,
    payout_amount: actualPayoutAmount
  };
  
  let transferResult;
  if (canUseSafeHaven) {
    if (!safeHavenToken?.access_token) {
      throw new Error("SafeHaven token not available for this user.");
    }
    transferResult = await initiateSafeHavenTransfer(
      planWithActualAmount,
      payoutAccount,
      safeHavenToken.access_token,
      payoutId,
      safehavenCode!
    );
  } else {
    transferResult = await initiatePaystackTransfer(
      planWithActualAmount,
      payoutAccount,
      paystackBankCode!,
      payoutId
    );
  }
  
  // 10. Create transaction record with pending status
  await createTransactionRecord(planWithActualAmount, transferResult);
  
  // 11. Update automated payout record with transfer details
  await updateAutomatedPayout(payoutId, transferResult);
  
  // 12. Update payout plan progress
  await updatePayoutPlanProgress(plan.plan_id);
  
  // 13. Create notification (email will be sent by webhook when transfer completes)
  await createNotification(plan.user_id, planWithActualAmount, transferResult);
}
/**
 * Initiate transfer via SafeHaven
 */ async function initiateSafeHavenTransfer(
  plan,
  payoutAccount,
  accessToken,
  payoutId,
  safehavenBankCode: string
) {
  const transferReference = `AUTO_${plan.plan_id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
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
    reference: paymentReference,
    transfer_code: paymentReference,
    sessionId: sessionId,
    status: transferResult.status || "Pending",
    _id: transferId,
    paymentReference: paymentReference,
    rawResponse: transferData
  };
}

type BankCodeResolution = {
  safehavenCode: string | null;
  paystackCode: string | null;
};

async function resolveBankCodes(payoutAccount: any): Promise<BankCodeResolution> {
  let safehavenCode = payoutAccount.safehaven_bank_code || null;
  let paystackCode = payoutAccount.bank_code || null;

  if ((!safehavenCode || !paystackCode) && payoutAccount.bank_name) {
    const { data: mapping } = await supabase
      .from("bank_comparison")
      .select("safehaven_code, paystack_code")
      .ilike("bank_name", payoutAccount.bank_name)
      .limit(1)
      .maybeSingle();

    if (mapping) {
      const updates: Record<string, any> = {};

      if (!safehavenCode && mapping.safehaven_code) {
        safehavenCode = mapping.safehaven_code;
        updates.safehaven_bank_code = safehavenCode;
      }

      if (!paystackCode && mapping.paystack_code) {
        paystackCode = mapping.paystack_code;
        if (!updates.bank_code) {
          updates.bank_code = mapping.paystack_code;
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase
          .from("payout_accounts")
          .update(updates)
          .eq("id", payoutAccount.id)
          .catch(() => null);
      }
    }
  }

  return { safehavenCode, paystackCode };
}

async function ensurePaystackRecipient(payoutAccount: any, paystackBankCode: string): Promise<string> {
  if (!paystackSecretKey) {
    throw new Error("Paystack secret key not configured. Cannot create transfer recipient.");
  }

  if (payoutAccount.paystack_recipient_code) {
    return payoutAccount.paystack_recipient_code;
  }

  if (!paystackBankCode) {
    throw new Error(`Missing Paystack bank code for ${payoutAccount.bank_name}.`);
  }

  const recipientResponse = await fetch(`${paystackApiUrl}/transferrecipient`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      type: "nuban",
      name: payoutAccount.account_name,
      account_number: payoutAccount.account_number,
      bank_code: paystackBankCode,
      currency: "NGN"
    })
  });

  const recipientPayload = await recipientResponse.json();

  if (!recipientResponse.ok || !recipientPayload?.status) {
    throw new Error(`Failed to create Paystack transfer recipient: ${recipientPayload?.message || "Unknown error"}`);
  }

  const recipientCode = recipientPayload?.data?.recipient_code;
  if (!recipientCode) {
    throw new Error("Paystack did not return a recipient_code.");
  }

  await supabase
    .from("payout_accounts")
    .update({
      paystack_recipient_code: recipientCode,
      bank_code: payoutAccount.bank_code || paystackBankCode,
      updated_at: new Date().toISOString()
    })
    .eq("id", payoutAccount.id)
    .catch(() => null);

  payoutAccount.paystack_recipient_code = recipientCode;
  return recipientCode;
}

function normalizePaystackStatus(status?: string): string {
  const normalized = status?.toLowerCase();
  if (normalized === "success") return "Completed";
  if (normalized === "failed") return "Failed";
  return "processing";
}

async function initiatePaystackTransfer(
  plan,
  payoutAccount,
  paystackBankCode: string,
  payoutId: string
) {
  if (!paystackSecretKey) {
    throw new Error("Paystack secret key not configured. Cannot process payout.");
  }

  console.log(`Using Paystack transfer for plan ${plan.plan_id}.`);

  const recipientCode = await ensurePaystackRecipient(payoutAccount, paystackBankCode);
  const amountInKobo = Math.round(Number(plan.payout_amount) * 100);

  const transferResponse = await fetch(`${paystackApiUrl}/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      source: "balance",
      amount: amountInKobo,
      recipient: recipientCode,
      reason: `Automated payout: ${plan.name}`
    })
  });

  const transferPayload = await transferResponse.json();

  if (!transferResponse.ok || !transferPayload?.status) {
    throw new Error(`Paystack transfer failed: ${transferPayload?.message || "Unknown error"}`);
  }

  const transferData = transferPayload.data;

  return {
    provider: "paystack",
    id: transferData.id,
    reference: transferData.reference,
    transfer_code: transferData.transfer_code,
    sessionId: null,
    status: normalizePaystackStatus(transferData.status),
    paymentReference: transferData.reference,
    rawResponse: transferData
  };
}
/**
 * Update automated payout record with transfer details
 */ async function updateAutomatedPayout(payoutId, transferResult) {
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
 */ async function updatePayoutPlanProgress(planId) {
  console.log(`📈 Updating payout plan progress for: ${planId}`);
  const { data, error } = await supabase.rpc("update_payout_plan_progress", {
    p_plan_id: planId
  });
  if (error) {
    console.error(`❌ Failed to update payout plan progress:`, error);
  }
  console.log(`✅ Payout plan progress updated for: ${planId}`);
}
/**
 * Create transaction record
 */ async function createTransactionRecord(plan, transferResult) {
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

  if (transferResult.provider === "safehaven") {
    metadata.safehaven_transfer_id = transferResult.id || transferResult._id;
    metadata.safehaven_transfer_code = transferResult.reference || transferResult.paymentReference;
    metadata.safehaven_transfer_status = transferResult.status || "Pending";
    metadata.safehaven_transfer_session_id = transferResult.sessionId;
  } else if (transferResult.provider === "paystack") {
    metadata.paystack_transfer_id = transferResult.id;
    metadata.paystack_reference = transferResult.reference;
  }

  // Use the database function with proper type casting
  const { data: transactionId, error } = await supabase.rpc("create_transaction_record", {
    p_user_id: plan.user_id,
    p_type: 'payout',
    p_amount: plan.payout_amount,
    p_status: 'pending',
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
  // if (!transactionId?.id) {
  //   throw new Error("transactions upsert returned no id");
  // }
  console.log(`✅ Transaction record created for payout: ${plan.name}`, {
    transactionId
  });
  return transactionId;
}
/**
 * Update wallet balance
 */ // async function updateWalletBalance(userId, amount) {
//   const { data, error } = await supabase.rpc("deduct_locked_funds", {
//     arg_user_id: userId,
//     arg_amount: amount
//   });
//   if (error) {
//     throw new Error(`Failed to update wallet balance: ${error.message}`);
//   }
//   if (!data?.success) {
//     throw new Error(`Wallet balance update failed: ${data?.error || "Unknown error"}`);
//   }
//   console.log(`✅ Wallet balance updated successfully for user ${userId}`);
//   return data;
// }
/**
 * Create notification for user
 */ async function createNotification(userId, plan, transferResult) {
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
      user_ids: [
        userId
      ],
      notification_type: 'payout_pending',
      title: 'Payout Initiated! 💰',
      body: `Your ₦${plan.payout_amount.toLocaleString()} payout from "${plan.name}" has been initiated and should arrive in your account shortly.`,
      data: {
        type: 'payout_ready',
        plan_id: plan.plan_id,
        plan_name: plan.name,
        amount: plan.payout_amount,
        transfer_reference: transferResult.reference,
        timestamp: new Date().toISOString(),
        route: `/view-payout/${plan.plan_id}`,
        action: 'view_plan'
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
 */ async function validateWalletBalance(userId, amount) {
  const { data: wallet, error } = await supabase.from("wallets").select("locked_balance").eq("user_id", userId).single();
  if (error || !wallet) {
    throw new Error("Wallet not found");
  }
  return wallet.locked_balance >= amount;
}
/**
 * Process a scheduled emergency withdrawal
 */ async function processScheduledEmergencyWithdrawal(withdrawal) {
  // Update status to processing
  const { error: updateError } = await supabase
    .from("emergency_withdrawals")
    .update({ 
      status: "processing",
      processed_at: new Date().toISOString()
    })
    .eq("id", withdrawal.id);

  if (updateError) {
    throw new Error(`Failed to update withdrawal status: ${updateError.message}`);
  }

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

  // Resolve bank codes (SafeHaven and Paystack) from payout_accounts or bank_comparison table
  const { safehavenCode, paystackCode } = await resolveBankCodes(payoutAccount);

  // Determine which provider to use
  const canUseSafeHaven = !!safehavenCode;
  const canUsePaystack = !!paystackCode;

  if (!canUseSafeHaven && !canUsePaystack) {
    throw new Error(`No bank code found for ${payoutAccount.bank_name}. Please update the payout account or bank_comparison table.`);
  }

  // Get SafeHaven token only if we're using SafeHaven
  let safeHavenToken: any = null;
  let accessToken: string | null = null;
  
  if (canUseSafeHaven) {
    const { data: tokenData, error: tokenError } = await supabase
      .from("safehaven_tokens")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", withdrawal.user_id)
      .single();

    if (tokenError || !tokenData) {
      console.log("⚠️ SafeHaven token not found, will use Paystack fallback");
      // Continue to Paystack fallback
    } else {
      safeHavenToken = tokenData;
      
      // Check if token needs refresh
      const expiresAt = new Date(safeHavenToken.expires_at);
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      
      const needsRefresh = isNaN(expiresAt.getTime()) || (expiresAt.getTime() - now.getTime() < bufferTime);
      
      accessToken = safeHavenToken.access_token;
      
      if (needsRefresh) {
        console.log("SafeHaven token expired or expiring soon, attempting refresh...");
        accessToken = await refreshOrCreateSafeHavenToken(withdrawal.user_id, safeHavenToken);
      }
    }
  }

  // Process the transfer via SafeHaven or Paystack
  let transferResult;
  if (canUseSafeHaven && accessToken) {
    transferResult = await initiateSafeHavenEmergencyTransfer(
      withdrawal,
      payoutAccount,
      accessToken,
      netAmount,
      plan.name,
      safehavenCode!
    );
  } else if (canUsePaystack) {
    transferResult = await initiatePaystackEmergencyTransfer(
      withdrawal,
      payoutAccount,
      paystackCode!,
      netAmount,
      plan.name
    );
  } else {
    throw new Error("Unable to process transfer: No valid provider available");
  }

  // Update withdrawal status to completed
  const withdrawalMetadata: Record<string, any> = {
    provider: transferResult.provider,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    transfer_status: transferResult.status,
    response: transferResult.rawResponse || transferResult,
    processed_via: "scheduled_cron"
  };

  if (transferResult.provider === "safehaven") {
    withdrawalMetadata.safehaven_transfer_id = transferResult.id || transferResult._id;
    withdrawalMetadata.safehaven_reference = transferResult.reference || transferResult.paymentReference;
    withdrawalMetadata.session_id = transferResult.sessionId;
  } else if (transferResult.provider === "paystack") {
    withdrawalMetadata.paystack_transfer_id = transferResult.id;
    withdrawalMetadata.paystack_reference = transferResult.reference;
  }

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

  // Reduce both balance and locked_balance since money is being withdrawn from the system
  const { error: reduceError } = await supabase.rpc("transfer_funds", {
    arg_user_id: withdrawal.user_id,
    arg_amount: withdrawal.withdrawal_amount
  });

  if (reduceError) {
    console.error("Error reducing wallet balance:", reduceError);
    throw new Error(`Failed to reduce wallet balance: ${reduceError.message}`);
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

  if (transferResult.provider === "safehaven") {
    txMetadata.safehaven_transfer_id = transferResult.id || transferResult._id;
    txMetadata.safehaven_transfer_code = transferResult.reference || transferResult.paymentReference;
    txMetadata.safehaven_transfer_status = transferResult.status || "Pending";
    txMetadata.safehaven_transfer_session_id = transferResult.sessionId;
  } else if (transferResult.provider === "paystack") {
    txMetadata.paystack_transfer_id = transferResult.id;
    txMetadata.paystack_reference = transferResult.reference;
  }

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
 */ async function refreshOrCreateSafeHavenToken(userId, safeHavenToken) {
  let tokenData = null;
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
    } catch (newTokenError) {
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
 */ async function initiateSafeHavenEmergencyTransfer(
  withdrawal,
  payoutAccount,
  accessToken,
  netAmount,
  planName,
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
 * Initiate Paystack transfer for emergency withdrawal
 */ async function initiatePaystackEmergencyTransfer(
  withdrawal,
  payoutAccount,
  paystackBankCode: string,
  netAmount: number,
  planName: string
) {
  if (!paystackSecretKey) {
    throw new Error("Paystack secret key not configured. Cannot process emergency withdrawal.");
  }

  console.log(`Using Paystack transfer for emergency withdrawal ${withdrawal.id}.`);

  const recipientCode = await ensurePaystackRecipient(payoutAccount, paystackBankCode);
  const amountInKobo = Math.round(Number(netAmount) * 100);
  const transferReference = withdrawal.reference || `EMERGENCY_${withdrawal.id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const transferResponse = await fetch(`${paystackApiUrl}/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      source: "balance",
      amount: amountInKobo,
      recipient: recipientCode,
      reason: `Emergency withdrawal: ${planName}`,
      reference: transferReference
    })
  });

  const transferPayload = await transferResponse.json();

  if (!transferResponse.ok || !transferPayload?.status) {
    throw new Error(`Paystack transfer failed: ${transferPayload?.message || "Unknown error"}`);
  }

  const transferData = transferPayload.data;

  return {
    provider: "paystack",
    id: transferData.id,
    reference: transferData.reference || transferReference,
    transfer_code: transferData.transfer_code,
    sessionId: null,
    status: normalizePaystackStatus(transferData.status),
    paymentReference: transferData.reference || transferReference,
    rawResponse: transferData
  };
}

/**
 * Log emergency withdrawal failure for monitoring
 */ async function logEmergencyWithdrawalFailure(withdrawal, error) {
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
 */ async function logPayoutFailure(plan, error) {
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
      user_ids: [
        plan.user_id
      ],
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
        timestamp: new Date().toISOString(),
        route: `/view-payout/${plan.plan_id}`,
        action: 'view_plan'
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
 */ serve(async (req)=>{
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405
    });
  }
  try {
    const result = await processDuePayouts();
    return new Response(JSON.stringify({
      success: true,
      message: "Payout processing.....",
      result
    }), {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
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
