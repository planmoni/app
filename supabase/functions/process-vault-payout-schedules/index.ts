import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Phase 2: scheduled vault → bank payouts.
 * Stub: selects due rows and returns counts. Wire Safe Haven / bank transfer here.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase env" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split("T")[0];

    const { data: due, error } = await supabase
      .from("vault_payout_schedules")
      .select("id, status, next_payout_date, budget_plan_id, payout_account_id")
      .eq("status", "active")
      .not("next_payout_date", "is", null)
      .lte("next_payout_date", today);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        dueCount: due?.length ?? 0,
        note: "Stub: bank transfer execution not implemented. Extend this to process each row.",
        scheduleIds: (due ?? []).map((r) => r.id),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("process-vault-payout-schedules:", e);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
