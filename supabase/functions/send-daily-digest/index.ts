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

    console.log("Starting daily digest push...");

    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        send_to_all: true,
        notification_type: "daily_digest",
        title: "Your Planmoni daily summary",
        body: "Tap to see your plans and next payout.",
        data: {
          type: "daily_digest",
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
    console.log("Daily digest result:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily digest push completed",
        sent_count: result.sent_count ?? 0,
        failed_count: result.failed_count ?? 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Daily digest error:", error);
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
