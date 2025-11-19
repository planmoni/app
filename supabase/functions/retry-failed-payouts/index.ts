import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Retry Failed Payouts Function
 *
 * This function retries failed payout transfers with exponential backoff
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface RetryPayout {
  payout_id: string;
  payout_plan_id: string;
  user_id: string;
  amount: number;
  payout_account_id: string;
  transfer_reference: string;
  retry_count: number;
  error_message: string;
}

/**
 * Main function to retry failed payouts
 */
async function retryFailedPayouts() {
  console.log("🔄 Starting retry of failed payouts...");

  try {
    // Get all payouts ready for retry
    const { data: retryPayouts, error: retryError } =
      await supabase.rpc("get_retry_payouts");

    if (retryError) {
      console.error("❌ Error fetching retry payouts:", retryError);
      throw retryError;
    }

    if (!retryPayouts || retryPayouts.length === 0) {
      console.log("✅ No payouts to retry");
      return { retried: 0, success: 0, failed: 0 };
    }

    console.log(`📋 Found ${retryPayouts.length} payouts to retry`);

    let successCount = 0;
    let failureCount = 0;

    // Process each retry payout
    for (const payout of retryPayouts) {
      try {
        console.log(
          `⏳ Retrying payout: ${payout.payout_id} (attempt ${payout.retry_count + 1})`
        );

        await retrySinglePayout(payout);
        successCount++;

        console.log(`✅ Successfully retried payout: ${payout.payout_id}`);
      } catch (error) {
        console.error(`❌ Failed to retry payout: ${payout.payout_id}`, error);
        failureCount++;

        // Update retry status
        await updateRetryFailure(payout, error);
      }
    }

    console.log(
      `🏁 Retry processing completed. Success: ${successCount}, Failed: ${failureCount}`
    );
    return {
      retried: retryPayouts.length,
      success: successCount,
      failed: failureCount,
    };
  } catch (error) {
    console.error("💥 Critical error in retry processing:", error);
    throw error;
  }
}

/**
 * Retry a single payout
 */
async function retrySinglePayout(payout: RetryPayout) {
  // 1. Validate payout eligibility again
  const { data: eligibility, error: eligibilityError } = await supabase.rpc(
    "validate_payout_eligibility",
    { p_plan_id: payout.payout_plan_id }
  );

  if (eligibilityError) {
    throw new Error(`Eligibility check failed: ${eligibilityError.message}`);
  }

  if (!eligibility.eligible) {
    throw new Error(`Payout no longer eligible: ${eligibility.reason}`);
  }

  // 2. Get payout account details
  const { data: payoutAccount, error: payoutError } = await supabase
    .from("payout_accounts")
    .select("*")
    .eq("id", payout.payout_account_id)
    .single();

  if (payoutError || !payoutAccount) {
    throw new Error(`Payout account not found: ${payout.payout_account_id}`);
  }

  if (!payoutAccount.paystack_recipient_code) {
    throw new Error(
      "Payout account does not have transfer recipient configured"
    );
  }

  // 3. Generate new transfer reference for retry
  const newReference = `retry_${payout.transfer_reference}_${Date.now()}`;

  // 4. Initiate new transfer
  const transferResult = await initiateRetryTransfer(
    payout,
    payoutAccount,
    newReference
  );

  // 5. Update automated payout record
  await supabase.rpc("update_payout_retry_status", {
    p_payout_id: payout.payout_id,
    p_status: "processing",
    p_paystack_transfer_id: transferResult.id,
  });

  // 6. Update transfer reference
  await supabase
    .from("automated_payouts")
    .update({
      transfer_reference: newReference,
      metadata: {
        retry_transfer_data: transferResult,
        original_reference: payout.transfer_reference,
      },
    })
    .eq("id", payout.payout_id);

  // 7. Create retry notification
  await createRetryNotification(payout.user_id, payout, transferResult);
}

/**
 * Initiate retry transfer via Paystack
 */
async function initiateRetryTransfer(
  payout: RetryPayout,
  payoutAccount: any,
  reference: string
) {
  const amountInKobo = Math.round(payout.amount * 100);

  const transferData = {
    source: "balance",
    amount: amountInKobo,
    recipient: payoutAccount.paystack_recipient_code,
    reason: `Retry payout (attempt ${payout.retry_count + 1})`,
    reference: reference,
  };

  console.log(
    `💸 Retrying transfer of ₦${payout.amount} to ${payoutAccount.account_number}`
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
    throw new Error(`Retry transfer failed: ${result.message}`);
  }

  console.log(`✅ Retry transfer initiated: ${result.data.transfer_code}`);
  return result.data;
}

/**
 * Update retry failure status
 */
async function updateRetryFailure(payout: RetryPayout, error: any) {
  const newRetryCount = payout.retry_count + 1;
  const maxRetries = 3;
  const shouldRetry = newRetryCount <= maxRetries;

  await supabase.rpc("update_payout_retry_status", {
    p_payout_id: payout.payout_id,
    p_status: shouldRetry ? "retrying" : "failed",
    p_error_message: error.message,
  });

  // If final failure, reverse funds and notify user
  if (!shouldRetry) {
    await supabase.rpc("reverse_locked_funds", {
      arg_user_id: payout.user_id,
      arg_amount: payout.amount,
    });

    await supabase.from("events").insert({
      user_id: payout.user_id,
      type: "payout_failed_final",
      title: "Payout Failed",
      description: `Payout of ₦${payout.amount.toLocaleString()} failed after ${maxRetries} attempts. Funds have been returned to your wallet.`,
      status: "unread",
      payout_plan_id: payout.payout_plan_id,
      metadata: {
        final_error: error.message,
        retry_count: newRetryCount,
        automated: true,
      },
    });

    // Send push notification for final failure
    try {
      const pushNotificationPayload = {
        user_ids: [payout.user_id],
        notification_type: "payout_failed" as const,
        title: "Payout Failed ❌",
        body: `Your ₦${payout.amount.toLocaleString()} payout failed after ${maxRetries} attempts. Funds have been returned to your wallet.`,
        data: {
          type: "payout_final_failure",
          amount: payout.amount,
          max_attempts: maxRetries,
          timestamp: new Date().toISOString(),
        },
      };

      const pushResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushNotificationPayload),
        }
      );

      if (pushResponse.ok) {
        console.log(
          `✅ Final failure push notification sent for user ${payout.user_id}`
        );
      } else {
        console.error(
          `❌ Failed to send final failure push notification:`,
          await pushResponse.text()
        );
      }
    } catch (pushError) {
      console.error(
        `❌ Error sending final failure push notification:`,
        pushError
      );
    }
  }
}

/**
 * Create retry notification
 */
async function createRetryNotification(
  userId: string,
  payout: RetryPayout,
  transferResult: any
) {
  await supabase.from("events").insert({
    user_id: userId,
    type: "payout_retry_initiated",
    title: "Payout Retry Initiated",
    description: `₦${payout.amount.toLocaleString()} payout retry has been initiated (attempt ${payout.retry_count + 1}).`,
    status: "unread",
    payout_plan_id: payout.payout_plan_id,
    metadata: {
      transfer_reference: transferResult.reference,
      retry_count: payout.retry_count + 1,
      automated: true,
    },
  });

  // Send push notification for retry initiation
  try {
    const pushNotificationPayload = {
      user_ids: [userId],
      notification_type: "payout_ready" as const,
      title: "Payout Retry Initiated 🔄",
      body: `We're retrying your ₦${payout.amount.toLocaleString()} payout (attempt ${payout.retry_count + 1}). We'll notify you once it's complete.`,
      data: {
        type: "payout_retry",
        amount: payout.amount,
        attempt_number: payout.retry_count + 1,
        timestamp: new Date().toISOString(),
      },
    };

    const pushResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushNotificationPayload),
      }
    );

    if (pushResponse.ok) {
      console.log(`✅ Retry push notification sent for user ${userId}`);
    } else {
      console.error(
        `❌ Failed to send retry push notification:`,
        await pushResponse.text()
      );
    }
  } catch (pushError) {
    console.error(`❌ Error sending retry push notification:`, pushError);
  }
}

/**
 * Main serve handler
 */
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const result = await retryFailedPayouts();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Retry processing completed",
        result,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Retry function execution failed:", error);

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
