import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Firebase Server Key - should be stored in environment variables
const FIREBASE_SERVER_KEY = Deno.env.get("FIREBASE_SERVER_KEY");
const FCM_URL = "https://fcm.googleapis.com/fcm/send";

interface NotificationPayload {
  user_ids?: string[];
  notification_type:
    | "payout_ready"
    | "payout_failed"
    | "deposit_received"
    | "security_alert"
    | "general";
  title: string;
  body: string;
  data?: Record<string, any>;
  send_to_all?: boolean;
}

interface FCMToken {
  user_id: string;
  fcm_token: string;
  notification_preferences: Record<string, boolean>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!FIREBASE_SERVER_KEY) {
      console.error("❌ FIREBASE_SERVER_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const payload: NotificationPayload = await req.json();
    console.log("📱 Push notification request:", payload);

    // Validate required fields
    if (!payload.title || !payload.body || !payload.notification_type) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: title, body, notification_type",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get FCM tokens based on user selection
    let fcmTokens: FCMToken[] = [];

    if (payload.send_to_all) {
      // Get all active FCM tokens
      const { data, error } = await supabase.rpc("get_active_fcm_tokens");

      if (error) {
        console.error("❌ Error fetching all FCM tokens:", error);
        throw error;
      }

      fcmTokens = data || [];
    } else if (payload.user_ids && payload.user_ids.length > 0) {
      // Get FCM tokens for specific users
      const { data, error } = await supabase.rpc("get_active_fcm_tokens", {
        user_ids: payload.user_ids,
      });

      if (error) {
        console.error("❌ Error fetching user FCM tokens:", error);
        throw error;
      }

      fcmTokens = data || [];
    } else {
      return new Response(
        JSON.stringify({
          error: "Either user_ids or send_to_all must be specified",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (fcmTokens.length === 0) {
      console.log("⚠️ No FCM tokens found for the specified criteria");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No FCM tokens found",
          sent_count: 0,
          failed_count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filter tokens based on user notification preferences
    const filteredTokens = fcmTokens.filter((tokenData) => {
      const preferences = tokenData.notification_preferences || {};

      // Check if user has enabled this type of notification
      switch (payload.notification_type) {
        case "payout_ready":
        case "payout_failed":
          return preferences.payouts !== false;
        case "deposit_received":
          return preferences.deposits !== false;
        case "security_alert":
          return preferences.security !== false;
        case "general":
          return preferences.general !== false;
        default:
          return true;
      }
    });

    console.log(
      `📊 Filtered ${filteredTokens.length} tokens from ${fcmTokens.length} total`
    );

    if (filteredTokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users have enabled this notification type",
          sent_count: 0,
          failed_count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare FCM message
    const fcmMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
        sound: "default",
      },
      data: {
        type: payload.notification_type,
        ...payload.data,
      },
      android: {
        priority: "high",
        notification: {
          channel_id: getChannelId(payload.notification_type),
          priority: "high",
          default_sound: true,
          default_vibrate_timings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    // Send notifications in batches to avoid rate limits
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < filteredTokens.length; i += batchSize) {
      batches.push(filteredTokens.slice(i, i + batchSize));
    }

    let totalSent = 0;
    let totalFailed = 0;
    const failedTokens: string[] = [];

    for (const batch of batches) {
      const tokens = batch.map((t) => t.fcm_token);

      try {
        const fcmResponse = await fetch(FCM_URL, {
          method: "POST",
          headers: {
            Authorization: `key=${FIREBASE_SERVER_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...fcmMessage,
            registration_ids: tokens,
          }),
        });

        const fcmResult = await fcmResponse.json();

        if (fcmResult.success) {
          totalSent += fcmResult.success;
        }

        if (fcmResult.failure) {
          totalFailed += fcmResult.failure;
        }

        // Handle individual token failures
        if (fcmResult.results) {
          fcmResult.results.forEach((result: any, index: number) => {
            if (result.error) {
              console.log(
                `❌ Failed to send to token ${tokens[index]}: ${result.error}`
              );
              failedTokens.push(tokens[index]);

              // Remove invalid tokens from database
              if (
                result.error === "InvalidRegistration" ||
                result.error === "NotRegistered"
              ) {
                supabase
                  .from("profiles")
                  .update({ fcm_token: null })
                  .eq("fcm_token", tokens[index])
                  .then(() =>
                    console.log(`🗑️ Removed invalid token: ${tokens[index]}`)
                  );
              }
            }
          });
        }

        console.log(
          `✅ Batch sent: ${fcmResult.success || 0} success, ${fcmResult.failure || 0} failed`
        );
      } catch (error) {
        console.error("❌ Error sending FCM batch:", error);
        totalFailed += tokens.length;
        failedTokens.push(...tokens);
      }
    }

    // Log the notification send attempt
    await supabase
      .from("notification_logs")
      .insert({
        notification_type: payload.notification_type,
        title: payload.title,
        body: payload.body,
        total_recipients: filteredTokens.length,
        successful_sends: totalSent,
        failed_sends: totalFailed,
        sent_at: new Date().toISOString(),
      })
      .catch((error) => console.log("Failed to log notification:", error));

    console.log(`📊 Final results: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Push notifications sent",
        sent_count: totalSent,
        failed_count: totalFailed,
        total_recipients: filteredTokens.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in send-push-notification function:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getChannelId(notificationType: string): string {
  switch (notificationType) {
    case "payout_ready":
    case "payout_failed":
      return "payouts";
    case "deposit_received":
      return "deposits";
    case "security_alert":
      return "security";
    default:
      return "general";
  }
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-push-notification' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
