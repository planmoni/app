import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Automated Payout Processing Function
 *
 * This function runs on a schedule to process due payout plans
 * and initiate bank transfers via Paystack Transfer API.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface PayoutPlan {
  plan_id: string;
  user_id: string;
  name: string;
  payout_amount: number;
  bank_account_id: string;
  next_payout_date: string;
  completed_payouts: number;
  duration: number;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  paystack_recipient_code?: string;
  transfer_enabled: boolean;
}

/**
 * Main function to process due payouts
 */
async function processDuePayouts() {
  console.log("🚀 Starting automated payout processing...");

  try {
    // Get all due payout plans
    const { data: duePlans, error: plansError } = await supabase.rpc(
      "get_due_payout_plans"
    );

    if (plansError) {
      console.error("❌ Error fetching due payout plans:", plansError);
      throw plansError;
    }

    if (!duePlans || duePlans.length === 0) {
      console.log("✅ No due payouts found");
      return { processed: 0, success: 0, failed: 0 };
    }

    console.log(`📋 Found ${duePlans.length} due payout plans`);

    let successCount = 0;
    let failureCount = 0;

    // Process each due payout plan
    for (const plan of duePlans) {
      try {
        console.log(
          `⏳ Processing payout for plan: ${plan.name} (${plan.plan_id})`
        );

        await processSinglePayout(plan);
        successCount++;

        console.log(`✅ Successfully processed payout for plan: ${plan.name}`);
      } catch (error) {
        console.error(
          `❌ Failed to process payout for plan: ${plan.name}`,
          error
        );
        failureCount++;

        // Log the failure
        await logPayoutFailure(plan, error);
      }
    }

    console.log(
      `🏁 Payout processing completed. Success: ${successCount}, Failed: ${failureCount}`
    );
    return {
      processed: duePlans.length,
      success: successCount,
      failed: failureCount,
    };
  } catch (error) {
    console.error("💥 Critical error in payout processing:", error);
    throw error;
  }
}

/**
 * Process a single payout plan
 */
async function processSinglePayout(plan: PayoutPlan) {
  // 1. Create automated payout record
  const { data: payoutId, error: createError } = await supabase.rpc(
    "create_automated_payout",
    {
      p_plan_id: plan.plan_id,
      p_scheduled_date: plan.next_payout_date,
    }
  );

  if (createError) {
    throw new Error(
      `Failed to create automated payout record: ${createError.message}`
    );
  }

  // 2. Get bank account details
  const { data: bankAccount, error: bankError } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("id", plan.bank_account_id)
    .single();

  if (bankError || !bankAccount) {
    throw new Error(`Bank account not found: ${plan.bank_account_id}`);
  }

  // 3. Ensure transfer recipient exists
  await ensureTransferRecipient(bankAccount);

  // 4. Check wallet balance
  const hasBalance = await validateWalletBalance(
    plan.user_id,
    plan.payout_amount
  );
  if (!hasBalance) {
    throw new Error("Insufficient wallet balance for payout");
  }

  // 5. Initiate transfer
  const transferResult = await initiatePaystackTransfer(
    plan,
    bankAccount,
    payoutId
  );

  // 6. Update automated payout record with transfer details
  await updateAutomatedPayout(payoutId, transferResult);

  // 7. Update payout plan progress
  await updatePayoutPlanProgress(plan.plan_id);

  // 8. Create transaction record
  await createTransactionRecord(plan, transferResult);

  // 9. Update wallet balance
  await updateWalletBalance(plan.user_id, plan.payout_amount);

  // 10. Create notification
  await createNotification(plan.user_id, plan, transferResult);
}

/**
 * Ensure transfer recipient exists for bank account
 */
async function ensureTransferRecipient(bankAccount: BankAccount) {
  if (bankAccount.paystack_recipient_code) {
    console.log(
      `📝 Using existing recipient code: ${bankAccount.paystack_recipient_code}`
    );
    return bankAccount.paystack_recipient_code;
  }

  console.log("🔄 Creating new transfer recipient...");

  // Get bank code from bank name (you might need a mapping)
  const bankCode = await getBankCode(bankAccount.bank_name);

  const recipientData = {
    type: "nuban",
    name: bankAccount.account_name,
    account_number: bankAccount.account_number,
    bank_code: bankCode,
    currency: "NGN",
  };

  const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(recipientData),
  });

  const result = await response.json();

  if (!response.ok || !result.status) {
    throw new Error(`Failed to create transfer recipient: ${result.message}`);
  }

  // Update bank account with recipient code
  await supabase
    .from("bank_accounts")
    .update({
      paystack_recipient_code: result.data.recipient_code,
      transfer_enabled: true,
    })
    .eq("id", bankAccount.id);

  console.log(`✅ Transfer recipient created: ${result.data.recipient_code}`);
  return result.data.recipient_code;
}

/**
 * Initiate transfer via Paystack
 */
async function initiatePaystackTransfer(
  plan: PayoutPlan,
  bankAccount: BankAccount,
  payoutId: string
) {
  const reference = `auto_payout_${plan.plan_id}_${Date.now()}`;
  const amountInKobo = Math.round(plan.payout_amount * 100);

  const transferData = {
    source: "balance",
    amount: amountInKobo,
    recipient: bankAccount.paystack_recipient_code!,
    reason: `Automated payout from ${plan.name}`,
    reference: reference,
  };

  console.log(
    `💸 Initiating transfer of ₦${plan.payout_amount} to ${bankAccount.account_number}`
  );

  const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(transferData),
  });

  const result = await response.json();

  if (!response.ok || !result.status) {
    throw new Error(`Transfer initiation failed: ${result.message}`);
  }

  console.log(`✅ Transfer initiated: ${result.data.transfer_code}`);
  return result.data;
}

/**
 * Update automated payout record with transfer details
 */
async function updateAutomatedPayout(payoutId: string, transferResult: any) {
  await supabase
    .from("automated_payouts")
    .update({
      status: "processing",
      paystack_transfer_id: transferResult.id,
      transfer_reference: transferResult.reference,
      metadata: {
        transfer_code: transferResult.transfer_code,
        paystack_response: transferResult,
      },
    })
    .eq("id", payoutId);
}

/**
 * Update payout plan progress and next date
 */
async function updatePayoutPlanProgress(planId: string) {
  // This will use the existing update_payout_plan_progress function
  await supabase.rpc("update_payout_plan_progress", { p_plan_id: planId });
}

/**
 * Create transaction record
 */
async function createTransactionRecord(plan: PayoutPlan, transferResult: any) {
  await supabase.from("transactions").insert({
    user_id: plan.user_id,
    type: "payout",
    amount: plan.payout_amount,
    status: "processing",
    source: "wallet",
    destination: `Bank Transfer`,
    payout_plan_id: plan.plan_id,
    reference: transferResult.reference,
    description: `Automated payout from ${plan.name}`,
    metadata: {
      transfer_code: transferResult.transfer_code,
      automated: true,
    },
  });
}

/**
 * Update wallet balance
 */
async function updateWalletBalance(userId: string, amount: number) {
  await supabase
    .from("wallets")
    .update({
      balance: supabase.raw("balance - ?", [amount]),
      locked_balance: supabase.raw("locked_balance - ?", [amount]),
    })
    .eq("user_id", userId);
}

/**
 * Create notification for user
 */
async function createNotification(
  userId: string,
  plan: PayoutPlan,
  transferResult: any
) {
  await supabase.from("events").insert({
    user_id: userId,
    type: "payout_initiated",
    title: "Payout Initiated",
    description: `₦${plan.payout_amount.toLocaleString()} payout from "${plan.name}" has been initiated.`,
    status: "unread",
    payout_plan_id: plan.plan_id,
    metadata: {
      transfer_reference: transferResult.reference,
      automated: true,
    },
  });
}

/**
 * Validate wallet has sufficient balance
 */
async function validateWalletBalance(
  userId: string,
  amount: number
): Promise<boolean> {
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
 * Log payout failure for monitoring
 */
async function logPayoutFailure(plan: PayoutPlan, error: any) {
  await supabase
    .from("automated_payouts")
    .update({
      status: "failed",
      error_message: error.message,
      retry_count: 1,
      retry_after: new Date(Date.now() + 30 * 60 * 1000), // Retry in 30 minutes
    })
    .eq("payout_plan_id", plan.plan_id)
    .eq("scheduled_date", plan.next_payout_date);
}

/**
 * Get bank code from bank name (simplified mapping)
 */
async function getBankCode(bankName: string): Promise<string> {
  // This is a simplified mapping - in production, you'd fetch from Paystack API
  const bankCodeMap: { [key: string]: string } = {
    "Access Bank": "044",
    GTBank: "058",
    "Zenith Bank": "057",
    UBA: "033",
    "First Bank": "011",
    "Fidelity Bank": "070",
    FCMB: "214",
    "Sterling Bank": "232",
    "Polaris Bank": "076",
    "Keystone Bank": "082",
  };

  const code = bankCodeMap[bankName];
  if (!code) {
    throw new Error(`Bank code not found for: ${bankName}`);
  }

  return code;
}

/**
 * Main serve handler
 */
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const result = await processDuePayouts();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payout processing completed",
        result,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Function execution failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
