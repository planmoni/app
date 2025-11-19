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
/**
 * Main function to process due payouts
 */ async function processDuePayouts() {
  console.log("🚀 Starting automated payout processing...");
  try {
    // Get all due payout plans
    const { data: duePlans, error: plansError } = await supabase.rpc("get_due_payout_plans");
    if (plansError) {
      console.error("❌ Error fetching due payout plans:", plansError);
      throw plansError;
    }
    if (!duePlans || duePlans.length === 0) {
      console.log("✅ No due payouts found");
      return {
        processed: 0,
        success: 0,
        failed: 0
      };
    }
    console.log(`📋 Found ${duePlans.length} due payout plans`);
    let successCount = 0;
    let failureCount = 0;
    // Process each due payout plan
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
    console.log(`🏁 Payout processing completed. Success: ${successCount}, Failed: ${failureCount}`);
    return {
      processed: duePlans.length,
      success: successCount,
      failed: failureCount
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
  const { data: payoutAccount, error: payoutError } = await supabase.from("payout_accounts").select("*").eq("id", plan.payout_account_id).single();
  if (payoutError || !payoutAccount) {
    throw new Error(`Payout account not found: ${plan.payout_account_id}`);
  }
  
  // 3. Validate account details
  if (!payoutAccount.bank_code) {
    throw new Error(`Bank code missing for account ${payoutAccount.account_number}`);
  }
  if (!payoutAccount.account_name || !payoutAccount.account_number || !payoutAccount.bank_name) {
    throw new Error("Incomplete bank account information");
  }
  
  // 4. Check wallet balance
  const hasBalance = await validateWalletBalance(plan.user_id, plan.payout_amount);
  if (!hasBalance) {
    throw new Error("Insufficient wallet balance for payout");
  }
  
  // 5. Get SafeHaven token
  const { data: safeHavenToken, error: tokenError } = await supabase
    .from("safehaven_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("user_id", plan.user_id)
    .single();

  if (tokenError || !safeHavenToken) {
    throw new Error("SafeHaven token not found. User needs to authenticate with SafeHaven first.");
  }

  // 6. Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(safeHavenToken.expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  if (expiresAt.getTime() - now.getTime() < bufferTime) {
    // Token expired or expiring soon, try to refresh
    console.log("SafeHaven token expired or expiring soon, attempting refresh...");
    
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

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh SafeHaven token");
    }

    const refreshData = await refreshResponse.json();
    
    // Update token in database
    await supabase
      .from("safehaven_tokens")
      .update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token || safeHavenToken.refresh_token,
        expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", plan.user_id);

    safeHavenToken.access_token = refreshData.access_token;
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

  // 8. Initiate SafeHaven transfer (with name enquiry first)
  const transferResult = await initiateSafeHavenTransfer(plan, payoutAccount, safeHavenToken.access_token, payoutId);
  
  // 9. Update automated payout record with transfer details
  await updateAutomatedPayout(payoutId, transferResult);
  
  // 10. Update payout plan progress
  await updatePayoutPlanProgress(plan.plan_id);
  
  // 11. Create notification (email will be sent by webhook when transfer completes)
  await createNotification(plan.user_id, plan, transferResult);
}
/**
 * Initiate transfer via SafeHaven
 */ async function initiateSafeHavenTransfer(plan, payoutAccount, accessToken, payoutId) {
  const transferReference = `AUTO_${plan.plan_id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  console.log("Processing SafeHaven transfer:", {
    fromAccount: "0117753301",
    toAccount: payoutAccount.account_number,
    amount: plan.payout_amount
  });

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
      bankCode: payoutAccount.bank_code,
      accountNumber: payoutAccount.account_number
    })
  });

  const nameEnquiryData = await nameEnquiryResponse.json();
  
  if (!nameEnquiryResponse.ok) {
    const errorMessage = nameEnquiryData.message || nameEnquiryData.error || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`);
  }

  const nameEnquiryReference = nameEnquiryData.data?.sessionId || nameEnquiryData.sessionId;
  if (!nameEnquiryReference) {
    throw new Error("Name enquiry did not return sessionId");
  }

  console.log("Name enquiry successful, sessionId:", nameEnquiryReference);

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
      beneficiaryBankCode: payoutAccount.bank_code,
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
    id: transferId,
    reference: paymentReference,
    transfer_code: paymentReference,
    sessionId: sessionId,
    status: transferResult.status || "Pending",
    _id: transferId,
    paymentReference: paymentReference
  };
}
/**
 * Update automated payout record with transfer details
 */ async function updateAutomatedPayout(payoutId, transferResult) {
  await supabase.from("automated_payouts").update({
    status: transferResult.status === "Completed" ? "completed" : "processing",
    safehaven_transfer_id: transferResult.id || transferResult._id,
    transfer_reference: transferResult.reference,
    transfer_code: transferResult.transfer_code || transferResult.reference,
    session_id: transferResult.sessionId,
    payment_reference: transferResult.paymentReference || transferResult.reference,
    completed_at: transferResult.status === "Completed" ? new Date().toISOString() : null,
    transferred_at: new Date().toISOString(),
    metadata: {
      transfer_code: transferResult.transfer_code || transferResult.reference,
      session_id: transferResult.sessionId,
      safehaven_response: transferResult
    }
  }).eq("id", payoutId);
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
  const user_ids = plan.user_id;
  const plan_ids = plan.plan_id;
  console.log(`📑 Creating transaction record for payout: ${plan.name}`);
  console.log({
    plan,
    transferResult
  });
  // Guard: fail fast if required fields are missing
  if (!plan?.user_id) throw new Error("Missing plan.user_id");
  if (!plan?.plan_id) throw new Error("Missing plan.plan_id");
  // Use the database function with proper type casting
  const { data: transactionId, error } = await supabase.rpc("create_transaction_record", {
    p_user_id: plan.user_id,
    p_type: "payout",
    p_amount: plan.payout_amount,
    p_status: "completed",
    p_source: "wallet",
    p_destination: "Bank Transfer",
    p_reference: transferResult.reference,
    p_payout_plan_id: plan.plan_id,
    p_description: `Automated payout from ${plan.name}`
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
    type: "payout_pending",
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
 */ async function validateWalletBalance(userId, amount) {
  const { data: wallet, error } = await supabase.from("wallets").select("locked_balance").eq("user_id", userId).single();
  if (error || !wallet) {
    throw new Error("Wallet not found");
  }
  return wallet.locked_balance >= amount;
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
    type: "payout_failed",
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
