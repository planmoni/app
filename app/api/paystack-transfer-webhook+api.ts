/**
 * Transfer Webhook Handler
 *
 * Handles Paystack transfer webhooks to update payout status and confirm transfers
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!PAYSTACK_WEBHOOK_SECRET) {
    console.error("Paystack webhook secret not configured");
    return false;
  }

  const computedSignature = crypto
    .createHmac("sha512", PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

async function handleTransferSuccess(data: any) {
  try {
    console.log("Processing transfer.success webhook:", data);

    const { reference, amount, status, transfer_code, recipient } = data;

    // Find the automated payout record
    const { data: automatedPayout, error: findError } = await supabase
      .from("automated_payouts")
      .select("*")
      .eq("transfer_reference", reference)
      .single();

    if (findError || !automatedPayout) {
      console.error(`No automated payout found for reference: ${reference}`);
      return;
    }

    // Update automated payout status to completed
    const { error: updatePayoutError } = await supabase
      .from("automated_payouts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...automatedPayout.metadata,
          transfer_success_data: data,
          final_status: status,
        },
      })
      .eq("id", automatedPayout.id);

    if (updatePayoutError) {
      console.error("Error updating automated payout:", updatePayoutError);
    }

    // Update transaction status to completed
    const { error: updateTransactionError } = await supabase
      .from("transactions")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference)
      .eq("type", "payout");

    if (updateTransactionError) {
      console.error("Error updating transaction:", updateTransactionError);
    }

    // Create success notification
    await supabase.from("events").insert({
      user_id: automatedPayout.user_id,
      type: "payout_completed",
      title: "Payout Completed",
      description: `₦${(amount / 100).toLocaleString()} has been successfully transferred to your bank account.`,
      status: "unread",
      payout_plan_id: automatedPayout.payout_plan_id,
      metadata: {
        transfer_reference: reference,
        transfer_code,
        automated: true,
      },
    });

    console.log(
      `✅ Successfully processed transfer.success for reference: ${reference}`
    );
  } catch (error) {
    console.error("Error handling transfer.success:", error);
  }
}

async function handleTransferFailed(data: any) {
  try {
    console.log("Processing transfer.failed webhook:", data);

    const { reference, amount, status, failure_reason } = data;

    // Find the automated payout record
    const { data: automatedPayout, error: findError } = await supabase
      .from("automated_payouts")
      .select("*")
      .eq("transfer_reference", reference)
      .single();

    if (findError || !automatedPayout) {
      console.error(`No automated payout found for reference: ${reference}`);
      return;
    }

    // Update automated payout status to failed
    const retryCount = (automatedPayout.retry_count || 0) + 1;
    const shouldRetry = retryCount <= 3;
    const retryAfter = shouldRetry
      ? new Date(Date.now() + Math.pow(2, retryCount) * 60 * 1000) // Exponential backoff
      : null;

    const { error: updatePayoutError } = await supabase
      .from("automated_payouts")
      .update({
        status: shouldRetry ? "retrying" : "failed",
        error_message: failure_reason || "Transfer failed",
        retry_count: retryCount,
        retry_after: retryAfter?.toISOString(),
        metadata: {
          ...automatedPayout.metadata,
          transfer_failed_data: data,
          failure_reason,
        },
      })
      .eq("id", automatedPayout.id);

    if (updatePayoutError) {
      console.error("Error updating automated payout:", updatePayoutError);
    }

    // Update transaction status to failed
    const { error: updateTransactionError } = await supabase
      .from("transactions")
      .update({
        status: "failed",
        metadata: {
          failure_reason,
          retry_count: retryCount,
          will_retry: shouldRetry,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference)
      .eq("type", "payout");

    if (updateTransactionError) {
      console.error("Error updating transaction:", updateTransactionError);
    }

    // Reverse wallet balance if this is the final failure
    if (!shouldRetry) {
      await supabase.rpc("reverse_locked_funds", {
        arg_user_id: automatedPayout.user_id,
        arg_amount: automatedPayout.amount,
      });
    }

    // Create failure notification
    const notificationTitle = shouldRetry
      ? "Payout Retry Scheduled"
      : "Payout Failed";
    const notificationDescription = shouldRetry
      ? `Payout of ₦${automatedPayout.amount.toLocaleString()} failed but will be retried automatically.`
      : `Payout of ₦${automatedPayout.amount.toLocaleString()} failed permanently. Funds have been returned to your wallet.`;

    await supabase.from("events").insert({
      user_id: automatedPayout.user_id,
      type: shouldRetry ? "payout_retry" : "payout_failed",
      title: notificationTitle,
      description: notificationDescription,
      status: "unread",
      payout_plan_id: automatedPayout.payout_plan_id,
      metadata: {
        transfer_reference: reference,
        failure_reason,
        retry_count: retryCount,
        will_retry: shouldRetry,
        automated: true,
      },
    });

    console.log(
      `⚠️ Processed transfer.failed for reference: ${reference}, will retry: ${shouldRetry}`
    );
  } catch (error) {
    console.error("Error handling transfer.failed:", error);
  }
}

async function handleTransferReversed(data: any) {
  try {
    console.log("Processing transfer.reversed webhook:", data);

    const { reference, amount, reversal_reason } = data;

    // Find the automated payout record
    const { data: automatedPayout, error: findError } = await supabase
      .from("automated_payouts")
      .select("*")
      .eq("transfer_reference", reference)
      .single();

    if (findError || !automatedPayout) {
      console.error(`No automated payout found for reference: ${reference}`);
      return;
    }

    // Update automated payout status to failed (reversed)
    const { error: updatePayoutError } = await supabase
      .from("automated_payouts")
      .update({
        status: "failed",
        error_message: `Transfer reversed: ${reversal_reason}`,
        metadata: {
          ...automatedPayout.metadata,
          transfer_reversed_data: data,
          reversal_reason,
        },
      })
      .eq("id", automatedPayout.id);

    if (updatePayoutError) {
      console.error("Error updating automated payout:", updatePayoutError);
    }

    // Update transaction status to failed
    const { error: updateTransactionError } = await supabase
      .from("transactions")
      .update({
        status: "failed",
        metadata: {
          reversal_reason,
          reversed: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference)
      .eq("type", "payout");

    if (updateTransactionError) {
      console.error("Error updating transaction:", updateTransactionError);
    }

    // Reverse wallet balance
    await supabase.rpc("reverse_locked_funds", {
      arg_user_id: automatedPayout.user_id,
      arg_amount: automatedPayout.amount,
    });

    // Create reversal notification
    await supabase.from("events").insert({
      user_id: automatedPayout.user_id,
      type: "payout_reversed",
      title: "Payout Reversed",
      description: `₦${automatedPayout.amount.toLocaleString()} payout was reversed. Funds have been returned to your wallet.`,
      status: "unread",
      payout_plan_id: automatedPayout.payout_plan_id,
      metadata: {
        transfer_reference: reference,
        reversal_reason,
        automated: true,
      },
    });

    console.log(`🔄 Processed transfer.reversed for reference: ${reference}`);
  } catch (error) {
    console.error("Error handling transfer.reversed:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    if (!signature) {
      console.error("Missing Paystack signature");
      return new Response("Unauthorized", { status: 401 });
    }

    if (!verifyWebhookSignature(body, signature)) {
      console.error("Invalid Paystack signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const event = JSON.parse(body);
    console.log("Transfer webhook received:", event.event);

    switch (event.event) {
      case "transfer.success":
        await handleTransferSuccess(event.data);
        break;

      case "transfer.failed":
        await handleTransferFailed(event.data);
        break;

      case "transfer.reversed":
        await handleTransferReversed(event.data);
        break;

      default:
        console.log(`Unhandled transfer webhook event: ${event.event}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing transfer webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
