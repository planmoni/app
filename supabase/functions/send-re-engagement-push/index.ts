import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/** Days of inactivity before sending re-engagement push */
const INACTIVE_DAYS = 7;

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

    console.log(`Starting re-engagement push (inactive >= ${INACTIVE_DAYS} days)...`);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);
    const cutoffIso = cutoff.toISOString();

    // Inactive = last_seen_at older than cutoff, OR no last_seen_at and created long ago (has FCM token)
    const { data: withLastSeen } = await supabase
      .from("profiles")
      .select("id")
      .not("fcm_token", "is", null)
      .neq("fcm_token", "")
      .lt("last_seen_at", cutoffIso);

    const { data: noLastSeen } = await supabase
      .from("profiles")
      .select("id")
      .is("last_seen_at", null)
      .not("fcm_token", "is", null)
      .neq("fcm_token", "")
      .lt("created_at", cutoffIso);

    const inactiveByLastSeen = (withLastSeen || []).map((r) => r.id);
    const inactiveByCreated = (noLastSeen || []).map((r) => r.id);
    const allInactiveIds = [...new Set([...inactiveByLastSeen, ...inactiveByCreated])];

    if (allInactiveIds.length === 0) {
      console.log("No inactive users to notify");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No inactive users found",
          sent_count: 0,
          failed_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_ids: allInactiveIds,
        notification_type: "re_engagement",
        title: "We miss you! 👋",
        body: "Your plans are waiting. Tap to see your next payout.",
        data: {
          type: "re_engagement",
          route: "/(tabs)/",
          action: "open_home",
        },
      }),
    });

    if (!pushResponse.ok) {
      const errText = await pushResponse.text();
      console.error("send-push-notification failed:", errText);
      throw new Error(`Push failed: ${errText}`);
    }

    const result = await pushResponse.json();
    console.log("Re-engagement result:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Re-engagement push completed",
        eligible: allInactiveIds.length,
        sent_count: result.sent_count ?? 0,
        failed_count: result.failed_count ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Re-engagement error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
