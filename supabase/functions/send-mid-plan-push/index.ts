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

    console.log("Starting mid-plan push...");

    // Plans at midpoint: completed_payouts = floor(duration/2), not yet sent, duration >= 2
    const { data: plans, error: plansError } = await supabase
      .from("payout_plans")
      .select(`
        id,
        user_id,
        name,
        duration,
        completed_payouts,
        payout_amount,
        profiles!payout_plans_user_id_fkey (
          id,
          first_name,
          push_notifications
        )
      `)
      .eq("status", "active")
      .not("next_payout_date", "is", null)
      .is("mid_plan_push_sent_at", null)
      .gte("duration", 2);

    if (plansError) {
      console.error("Error fetching plans:", plansError);
      throw plansError;
    }

    // Filter to exactly at midpoint: completed_payouts = floor(duration/2)
    const atMidpoint = (plan: { duration: number; completed_payouts: number }) =>
      plan.completed_payouts === Math.floor(plan.duration / 2);
    const eligiblePlans = (plans || []).filter(atMidpoint);

    console.log(`Found ${eligiblePlans.length} plans at midpoint (of ${plans?.length ?? 0} unsent)`);

    let sentCount = 0;

    for (const plan of eligiblePlans) {
      const profile = (plan as any).profiles;
      const pushPrefs = profile?.push_notifications || {};
      if (pushPrefs.enabled === false || pushPrefs.mid_plan === false) {
        continue;
      }

      try {
        const remaining = plan.duration - plan.completed_payouts;
        const pushTitle = "Halfway there!";
        const pushBody = `"${plan.name}" is halfway done. ${remaining} payouts to go. Tap to view.`;

        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_ids: [plan.user_id],
            notification_type: "mid_plan",
            title: pushTitle,
            body: pushBody,
            data: {
              type: "mid_plan",
              plan_id: plan.id,
              route: `/view-payout/${plan.id}`,
              action: "view_plan",
              plan_name: plan.name,
              completed_payouts: plan.completed_payouts,
              remaining_payouts: remaining,
            },
          }),
        });

        if (pushResponse.ok) {
          const { error: updateErr } = await supabase
            .from("payout_plans")
            .update({ mid_plan_push_sent_at: new Date().toISOString() })
            .eq("id", plan.id);

          if (updateErr) {
            console.warn(`Failed to set mid_plan_push_sent_at for plan ${plan.id}:`, updateErr);
          } else {
            sentCount++;
            console.log(`Sent mid-plan push for plan ${plan.id} to user ${plan.user_id}`);
          }
        } else {
          console.warn(`Push failed for plan ${plan.id}:`, await pushResponse.text());
        }
      } catch (err) {
        console.warn(`Error sending mid-plan push for plan ${plan.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Mid-plan push completed",
        eligible: eligiblePlans.length,
        sent: sentCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Mid-plan push error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
