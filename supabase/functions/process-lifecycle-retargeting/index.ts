import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Campaign = {
  campaignKey: string;
  progressEvent: string;
  completeEvent: string;
  title: string;
  body: string;
  dataType: string;
  route: string;
};

const CAMPAIGNS: Campaign[] = [
  {
    campaignKey: "vault_abandon_after_details",
    progressEvent: "vault_flow_step_details",
    completeEvent: "vault_flow_completed",
    title: "Finish your vault",
    body: "You started a vault—finish setting it up before you forget.",
    dataType: "vault_abandon_reminder",
    route: "/expense-planner",
  },
  {
    campaignKey: "payout_abandon_after_review",
    progressEvent: "payout_plan_flow_step_details",
    completeEvent: "payout_plan_flow_completed",
    title: "Finish your payout plan",
    body: "You almost finished creating a payout plan—tap to continue.",
    dataType: "payout_abandon_reminder",
    route: "/create-payout/amount",
  },
];

const MIN_AGE_HOURS = 2;
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

    let totalSent = 0;
    let totalFailed = 0;
    const details: Record<string, { eligible: number; sent: number; failed: number }> = {};

    for (const campaign of CAMPAIGNS) {
      const { data: candidates, error: rpcError } = await supabase.rpc(
        "lifecycle_retargeting_candidates",
        {
          p_progress_event: campaign.progressEvent,
          p_complete_event: campaign.completeEvent,
          p_min_age_hours: MIN_AGE_HOURS,
          p_cooldown_days: COOLDOWN_DAYS,
          p_campaign_key: campaign.campaignKey,
        },
      );

      if (rpcError) {
        console.error("lifecycle_retargeting_candidates error:", rpcError);
        details[campaign.campaignKey] = { eligible: 0, sent: 0, failed: 0 };
        continue;
      }

      const userIds = (candidates as { user_id: string }[] | null)?.map((r) => r.user_id) ?? [];
      details[campaign.campaignKey] = { eligible: userIds.length, sent: 0, failed: 0 };

      for (const userId of userIds) {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_ids: [userId],
            notification_type: "re_engagement",
            title: campaign.title,
            body: campaign.body,
            data: {
              type: campaign.dataType,
              route: campaign.route,
              campaign_key: campaign.campaignKey,
              funnel: campaign.progressEvent.startsWith("vault") ? "vault" : "payout_plan",
            },
          }),
        });

        if (!pushResponse.ok) {
          totalFailed += 1;
          details[campaign.campaignKey].failed += 1;
          continue;
        }

        const result = await pushResponse.json();
        const sent = result.sent_count ?? 0;
        const failed = result.failed_count ?? 0;
        totalSent += sent;
        totalFailed += failed;
        details[campaign.campaignKey].sent += sent;
        details[campaign.campaignKey].failed += failed;

        if (sent > 0) {
          const { error: logError } = await supabase.from("lifecycle_notification_log").upsert(
            {
              user_id: userId,
              campaign_key: campaign.campaignKey,
              sent_at: new Date().toISOString(),
              metadata: { notification_type: "re_engagement", data_type: campaign.dataType },
            },
            { onConflict: "user_id,campaign_key" },
          );
          if (logError) {
            console.warn("lifecycle_notification_log upsert failed:", logError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lifecycle retargeting run completed",
        sent_count: totalSent,
        failed_count: totalFailed,
        campaigns: details,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("process-lifecycle-retargeting error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
