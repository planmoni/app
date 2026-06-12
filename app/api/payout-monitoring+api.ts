/**
 * Payout Monitoring API
 *
 * Provides monitoring and statistics for automated payouts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date =
      url.searchParams.get("date") || new Date().toISOString().split("T")[0];
    const type = url.searchParams.get("type") || "daily";

    switch (type) {
      case "daily":
        return await getDailyStats(date);
      case "summary":
        return await getPayoutSummary();
      case "failed":
        return await getFailedPayouts();
      case "pending":
        return await getPendingPayouts();
      default:
        return new Response(
          JSON.stringify({ error: "Invalid type parameter" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Error in payout monitoring API:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function getDailyStats(date: string) {
  const { data: stats, error } = await supabase.rpc("get_payout_statistics", {
    p_date: date,
  });

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: stats,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function getPayoutSummary() {
  // Get summary data using a custom query
  const { data: summary, error } = await supabase
    .from("automated_payouts")
    .select("status, amount")
    .gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    );

  if (error) {
    throw error;
  }

  // Group and aggregate the data manually
  const grouped = summary.reduce((acc: any, item: any) => {
    if (!acc[item.status]) {
      acc[item.status] = { count: 0, total_amount: 0 };
    }
    acc[item.status].count += 1;
    acc[item.status].total_amount += parseFloat(item.amount || 0);
    return acc;
  }, {});

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        last_7_days: summary,
        summary: grouped,
      },
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function getFailedPayouts() {
  const { data: failedPayouts, error } = await supabase
    .from("automated_payouts")
    .select(
      `
      id,
      payout_plan_id,
      user_id,
      amount,
      error_message,
      retry_count,
      retry_after,
      created_at,
      payout_plans!inner(name, user_id),
      profiles!inner(first_name, last_name, email)
    `
    )
    .in("status", ["failed", "retrying"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: failedPayouts,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function getPendingPayouts() {
  const { data: pendingPayouts, error } = await supabase.rpc(
    "get_due_payout_plans",
    { check_at: new Date().toISOString() }
  );

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: pendingPayouts,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payout_id } = body;

    switch (action) {
      case "retry_payout":
        return await retrySpecificPayout(payout_id);
      case "cancel_payout":
        return await cancelPayout(payout_id);
      case "process_due_payouts":
        return await triggerPayoutProcessing();
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error in payout monitoring POST:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function retrySpecificPayout(payoutId: string) {
  // Trigger the retry function for a specific payout
  const { data, error } = await supabase.functions.invoke(
    "retry-failed-payouts",
    {
      body: { payout_id: payoutId },
    }
  );

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Payout retry initiated",
      data,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function cancelPayout(payoutId: string) {
  // Cancel a specific payout and reverse funds
  const { data: payout, error: fetchError } = await supabase
    .from("automated_payouts")
    .select("*")
    .eq("id", payoutId)
    .single();

  if (fetchError || !payout) {
    throw new Error("Payout not found");
  }

  if (!["pending", "retrying"].includes(payout.status)) {
    throw new Error("Can only cancel pending or retrying payouts");
  }

  // Update status to cancelled
  const { error: updateError } = await supabase
    .from("automated_payouts")
    .update({
      status: "failed",
      error_message: "Cancelled by admin",
      completed_at: new Date().toISOString(),
    })
    .eq("id", payoutId);

  if (updateError) {
    throw updateError;
  }

  // Reverse funds
  await supabase.rpc("reverse_locked_funds", {
    arg_user_id: payout.user_id,
    arg_amount: payout.amount,
  });

  // Create notification
  await supabase.from("events").insert({
    user_id: payout.user_id,
    type: "payout_cancelled",
    title: "Payout Cancelled",
    description: `Payout of ₦${payout.amount.toLocaleString()} has been cancelled. Funds have been returned to your wallet.`,
    status: "unread",
    payout_plan_id: payout.payout_plan_id,
    metadata: {
      cancelled_by: "admin",
      automated: false,
    },
  });

  // Send push notification for payout cancellation
  try {
    const pushNotificationPayload = {
      user_ids: [payout.user_id],
      notification_type: "general" as const,
      title: "Payout Cancelled 🚫",
      body: `Your ₦${payout.amount.toLocaleString()} payout has been cancelled. Funds have been returned to your wallet.`,
      data: {
        type: "payout_cancelled",
        amount: payout.amount,
        timestamp: new Date().toISOString(),
      },
    };

    const pushResponse = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushNotificationPayload),
      }
    );

    if (pushResponse.ok) {
      console.log(
        `✅ Payout cancellation push notification sent for user ${payout.user_id}`
      );
    } else {
      console.error(
        `❌ Failed to send payout cancellation push notification:`,
        await pushResponse.text()
      );
    }
  } catch (pushError) {
    console.error(
      `❌ Error sending payout cancellation push notification:`,
      pushError
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Payout cancelled successfully",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function triggerPayoutProcessing() {
  // Manually trigger the payout processing function
  const { data, error } = await supabase.functions.invoke(
    "process-due-payouts"
  );

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Payout processing triggered",
      data,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
