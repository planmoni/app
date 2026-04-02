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

    const { data: plans, error } = await supabase
      .from("budget_plans")
      .select("id,user_id,name,current_balance,total_budget,status")
      .eq("status", "active")
      .gt("total_budget", 0)
      .limit(500);

    if (error) throw error;

    const lowBalancePlans = (plans || []).filter((p: any) => {
      const ratio = Number(p.current_balance || 0) / Number(p.total_budget || 1);
      return ratio > 0 && ratio <= 0.2;
    });

    let sent = 0;
    for (const plan of lowBalancePlans) {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_ids: [plan.user_id],
          notification_type: "vault_updates",
          title: "Vault running low",
          body: `"${plan.name}" is running low. Add funds to keep payouts on track.`,
          data: {
            type: "vault_low_balance",
            plan_id: plan.id,
            route: "/(tabs)?activeBalanceTab=plans",
            action: "view_vault",
          },
        }),
      });
      if (response.ok) sent += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: plans?.length ?? 0,
        eligible: lowBalancePlans.length,
        sent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

