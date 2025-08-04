// @deno-types="https://deno.land/x/types/index.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sign } from "npm:jsonwebtoken";

// Type declarations for Deno environment
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Firebase HTTP v1 API configuration
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
const PROJECT_ID = "planmoni-7e669"; // From google-services.json
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;
const GOOGLE_AUTH_URL = "https://oauth2.googleapis.com/token";

// Cache for access token
let accessTokenCache: { token: string; expires: number } | null = null;

// JWT and OAuth 2.0 helper functions
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (accessTokenCache && Date.now() < accessTokenCache.expires) {
    return accessTokenCache.token;
  }

  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set");
  }

  try {
    let serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);

    console.log(
      serviceAccount.private_key,
      Object.keys(GOOGLE_SERVICE_ACCOUNT_JSON),
      Object.keys(serviceAccount)
    );

    if (typeof serviceAccount === "string") {
      serviceAccount = JSON.parse(serviceAccount);
    }

    const privateKey = serviceAccount.private_key.replace(/\\n/g, "\n");

    // Create JWT assertion
    const jwt = await sign(
      {
        scope: "https://www.googleapis.com/auth/firebase.messaging",
      },
      privateKey,
      {
        algorithm: "RS256",
        issuer: serviceAccount.client_email,
        audience: GOOGLE_AUTH_URL,
        expiresIn: "1h", // 1 hour
      }
    );

    // Exchange JWT for access token
    const response = await fetch(GOOGLE_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const tokenData = await response.json();

    // Cache the token (expires in 1 hour, cache for 55 minutes)
    accessTokenCache = {
      token: tokenData.access_token,
      expires: Date.now() + 55 * 60 * 1000, // 55 minutes
    };

    return tokenData.access_token;
  } catch (error) {
    console.error("❌ Error getting access token:", error);
    throw error;
  }
}

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

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.error("❌ GOOGLE_SERVICE_ACCOUNT_JSON not configured");
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

    // Get access token for authentication
    const accessToken = await getAccessToken();

    // Send notifications individually (HTTP v1 API doesn't support multicast)
    let totalSent = 0;
    let totalFailed = 0;
    const failedTokens: string[] = [];

    // Process tokens in batches to manage rate limits
    const batchSize = 100;
    for (let i = 0; i < filteredTokens.length; i += batchSize) {
      const batch = filteredTokens.slice(i, i + batchSize);

      // Send each token individually
      const batchPromises = batch.map(async (tokenData) => {
        try {
          // Create HTTP v1 message format
          const message = {
            message: {
              token: tokenData.fcm_token,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: {
                type: payload.notification_type,
                ...(payload.data
                  ? Object.fromEntries(
                      Object.entries(payload.data).map(([k, v]) => [
                        k,
                        String(v),
                      ])
                    )
                  : {}),
              },
              android: {
                priority: "high", // ✅ valid here
                notification: {
                  channel_id: getChannelId(payload.notification_type),
                  sound: "default", // ✅ standard sound key
                  vibrate_timings: ["0.1s", "0.2s", "0.3s"], // Optional: must follow ISO 8601 format
                  default_sound: true, // ✅ only if sound not set manually
                  default_vibrate_timings: true, // ✅ optional fallback
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
            },
          };

          const response = await fetch(FCM_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
          });

          if (response.ok) {
            return { success: true, token: tokenData.fcm_token };
          } else {
            const errorData = await response.json();
            console.log(
              `❌ Failed to send to token ${tokenData.fcm_token}:`,
              errorData
            );

            // Handle specific error cases for token cleanup
            if (
              errorData.error?.details?.[0]?.errorCode === "INVALID_ARGUMENT" ||
              errorData.error?.details?.[0]?.errorCode === "UNREGISTERED"
            ) {
              // Remove invalid token from database
              await supabase
                .from("profiles")
                .update({ fcm_token: null })
                .eq("fcm_token", tokenData.fcm_token);
              console.log(`🗑️ Removed invalid token: ${tokenData.fcm_token}`);
            }

            return {
              success: false,
              token: tokenData.fcm_token,
              error: errorData,
            };
          }
        } catch (error) {
          console.error(
            `❌ Error sending to token ${tokenData.fcm_token}:`,
            error
          );
          return {
            success: false,
            token: tokenData.fcm_token,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      // Wait for all promises in this batch to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            totalSent++;
          } else {
            totalFailed++;
            failedTokens.push(result.value.token);
          }
        } else {
          totalFailed++;
          console.error("❌ Promise rejected:", result.reason);
        }
      });

      console.log(
        `✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${totalSent} sent, ${totalFailed} failed so far`
      );

      // Add small delay between batches to respect rate limits
      if (i + batchSize < filteredTokens.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

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
        details: error instanceof Error ? error.message : "Unknown error",
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
