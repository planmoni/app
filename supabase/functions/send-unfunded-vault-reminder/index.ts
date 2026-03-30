import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const COOLDOWN_DAYS = 7;

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

    const cooldownCutoff = new Date();
    cooldownCutoff.setDate(cooldownCutoff.getDate() - COOLDOWN_DAYS);
    const cooldownCutoffIso = cooldownCutoff.toISOString();

    // Active vaults with no funding yet.
    const { data: plans, error: planError } = await supabase
      .from("budget_plans")
      .select("id,user_id,name,current_balance,total_budget,status")
      .eq("status", "active")
      .gt("total_budget", 0)
      .lte("current_balance", 0)
      .limit(1000);

    if (planError) {
      throw planError;
    }

    if (!plans || plans.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No unfunded active vaults found",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send one push per user, using the first vault as CTA context.
    const firstPlanByUser = new Map<string, { id: string; name: string }>();
    for (const plan of plans) {
      if (!firstPlanByUser.has(plan.user_id)) {
        firstPlanByUser.set(plan.user_id, { id: plan.id, name: plan.name || "Your vault" });
      }
    }

    const candidateUserIds = [...firstPlanByUser.keys()];
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", candidateUserIds)
      .or(`unfunded_vault_reminder_sent_at.is.null,unfunded_vault_reminder_sent_at.lte.${cooldownCutoffIso}`);

    if (profileError) {
      throw profileError;
    }

    const eligibleIds = (profiles || []).map((p) => p.id);
    if (eligibleIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users passed unfunded-vault cooldown",
          eligible: 0,
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const sentUserIds: string[] = [];

    for (const userId of eligibleIds) {
      const plan = firstPlanByUser.get(userId);
      if (!plan) continue;

      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_ids: [userId],
          notification_type: "vault_updates",
          title: "Fund your vault to stay on track",
          body: `"${plan.name}" is still unfunded. Add money now to keep your plan moving.`,
          data: {
            type: "vault_unfunded_reminder",
            plan_id: plan.id,
            route: "/(tabs)?activeBalanceTab=plans",
            action: "fund_vault",
          },
        }),
      });

      if (!pushResponse.ok) {
        failedCount += 1;
        continue;
      }

      const result = await pushResponse.json();
      const userSent = result.sent_count ?? 0;
      sentCount += userSent;
      failedCount += result.failed_count ?? 0;
      if (userSent > 0) {
        sentUserIds.push(userId);
      }
    }

    if (sentUserIds.length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ unfunded_vault_reminder_sent_at: new Date().toISOString() })
        .in("id", sentUserIds);

      if (updateError) {
        console.warn("Failed to set unfunded_vault_reminder_sent_at:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Unfunded-vault reminder completed",
        scanned: plans.length,
        eligible: eligibleIds.length,
        sent_count: sentCount,
        failed_count: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unfunded-vault reminder error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
