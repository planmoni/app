import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/** Days after signup before sending "no plan" nudge (avoid nagging immediately) */
const DAYS_AFTER_SIGNUP = 3;

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

    console.log(`Starting no-plan nudge (signup >= ${DAYS_AFTER_SIGNUP} days ago)...`);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS_AFTER_SIGNUP);
    const cutoffIso = cutoff.toISOString();

    // Users with FCM token, no payout plan, signed up at least DAYS_AFTER_SIGNUP ago, not yet nudged
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .not("fcm_token", "is", null)
      .neq("fcm_token", "")
      .lt("created_at", cutoffIso)
      .is("no_plan_nudge_sent_at", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      console.log("No eligible profiles for no-plan nudge");
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

    const profileIds = profiles.map((p) => p.id);

    // Exclude users who have at least one payout plan (any status)
    const { data: plans } = await supabase
      .from("payout_plans")
      .select("user_id")
      .in("user_id", profileIds);

    const userIdsWithPlans = new Set((plans || []).map((p) => p.user_id));
    const userIdsNoPlan = profileIds.filter((id) => !userIdsWithPlans.has(id));

    if (userIdsNoPlan.length === 0) {
      console.log("All eligible profiles already have a plan");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users without a plan",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${userIdsNoPlan.length} users without a plan`);

    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_ids: userIdsNoPlan,
        notification_type: "no_plan_yet",
        title: "Create your first payout plan 🎯",
        body: "Start saving with automated payouts. Tap to get started.",
        data: {
          type: "no_plan_yet",
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

    // Mark nudged so we don't send again (at most one nudge per user until they create a plan)
    if (sentCount > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ no_plan_nudge_sent_at: new Date().toISOString() })
        .in("id", userIdsNoPlan);

      if (updateError) {
        console.warn("Failed to set no_plan_nudge_sent_at:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "No-plan nudge completed",
        eligible: userIdsNoPlan.length,
        sent_count: sentCount,
        failed_count: result.failed_count ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("No-plan nudge error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
