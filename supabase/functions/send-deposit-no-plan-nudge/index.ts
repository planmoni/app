import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting deposit-but-no-plan nudge...");

    // Users with wallet balance > 0
    const { data: walletsWithBalance, error: walletsError } = await supabase
      .from("wallets")
      .select("user_id")
      .gt("balance", 0);

    if (walletsError) {
      console.error("Error fetching wallets:", walletsError);
      throw walletsError;
    }

    const userIdsWithBalance = [...new Set((walletsWithBalance || []).map((w) => w.user_id))];
    if (userIdsWithBalance.length === 0) {
      console.log("No users with wallet balance");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users with balance",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exclude users who have at least one payout plan
    const { data: plans } = await supabase
      .from("payout_plans")
      .select("user_id")
      .in("user_id", userIdsWithBalance);

    const userIdsWithPlans = new Set((plans || []).map((p) => p.user_id));
    const userIdsBalanceNoPlan = userIdsWithBalance.filter((id) => !userIdsWithPlans.has(id));
    if (userIdsBalanceNoPlan.length === 0) {
      console.log("All users with balance already have a plan");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users with balance and no plan",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Of those, only with FCM token and not yet nudged
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .in("id", userIdsBalanceNoPlan)
      .not("fcm_token", "is", null)
      .neq("fcm_token", "")
      .is("deposit_no_plan_nudge_sent_at", null);

    const eligibleIds = (profiles || []).map((p) => p.id);
    if (eligibleIds.length === 0) {
      console.log("No eligible users for deposit-no-plan nudge");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No eligible users",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${eligibleIds.length} users with balance but no plan`);

    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_ids: eligibleIds,
        notification_type: "deposit_no_plan",
        title: "You've got funds — create a plan 💰",
        body: "Turn your balance into automated payouts. Tap to create your first plan.",
        data: {
          type: "deposit_no_plan",
          route: "/create-payout/amount",
          action: "create_plan",
        },
      }),
    });

    if (!pushResponse.ok) {
      const errText = await pushResponse.text();
      console.error("send-push-notification failed:", errText);
      throw new Error(`Push failed: ${errText}`);
    }

    const result = await pushResponse.json();
    const sentCount = result.sent_count ?? 0;

    if (eligibleIds.length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ deposit_no_plan_nudge_sent_at: new Date().toISOString() })
        .in("id", eligibleIds);

      if (updateError) {
        console.warn("Failed to set deposit_no_plan_nudge_sent_at:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Deposit-no-plan nudge completed",
        eligible: eligibleIds.length,
        sent_count: sentCount,
        failed_count: result.failed_count ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Deposit-no-plan nudge error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
