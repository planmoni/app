import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushNotificationType =
  | "payout_ready"
  | "payout_failed"
  | "deposit_received"
  | "security_alert"
  | "general"
  | "daily_digest"
  | "mid_plan"
  | "re_engagement"
  | "no_plan_yet"
  | "deposit_no_plan"
  | "payout_updates"
  | "vault_updates"
  | "deposit_updates";

/**
 * Payload for push notifications. All fields in `data` are forwarded to FCM
 * and available to the app on notification tap. For deep linking, callers
 * should always pass:
 * - data.type: notification type (e.g. payout_ready, plan_expiry_reminder)
 * - data.route: primary deep link path (e.g. /view-payout/[id]) so the app opens the right screen
 * - data.plan_id: when applicable, plan uuid for plan-detail routes
 */
interface NotificationPayload {
  user_ids?: string[];
  notification_type: PushNotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  send_to_all?: boolean;
}

interface PushRecipient {
  user_id: string;
  fcm_token: string | null;
  expo_push_token: string | null;
  notification_preferences: Record<string, boolean>;
  push_notifications?: Record<string, boolean>;
}

function parseHM(value: string): { hour: number; minute: number } | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function isWithinQuietHours(pref: Record<string, any> | undefined): boolean {
  const quietHours = pref?.quiet_hours;
  if (!quietHours || quietHours.enabled !== true) return false;
  const start = parseHM(String(quietHours.start ?? ""));
  const end = parseHM(String(quietHours.end ?? ""));
  const timezone = String(quietHours.timezone ?? "Africa/Lagos");
  if (!start || !end) return false;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = formatter
    .format(now)
    .split(":")
    .map((x) => Number(x));
  const current = h * 60 + m;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  if (startMinutes <= endMinutes) {
    return current >= startMinutes && current < endMinutes;
  }
  return current >= startMinutes || current < endMinutes;
}

function canSendByPreferences(
  notificationType: PushNotificationType,
  tokenData: PushRecipient,
): boolean {
  const preferences = tokenData.notification_preferences || {};
  const pushPrefs = tokenData.push_notifications || {};
  if (pushPrefs.enabled === false) return false;

  if (notificationType !== "security_alert" && isWithinQuietHours(pushPrefs)) {
    return false;
  }

  switch (notificationType) {
    case "daily_digest":
      return pushPrefs.daily_digest !== false;
    case "mid_plan":
      return pushPrefs.mid_plan !== false && pushPrefs.plan_reminders !== false;
    case "re_engagement":
      return pushPrefs.re_engagement !== false;
    case "no_plan_yet":
      return pushPrefs.no_plan_nudge !== false;
    case "deposit_no_plan":
      return pushPrefs.deposit_no_plan_nudge !== false;
    case "payout_ready":
    case "payout_failed":
    case "payout_updates":
      return pushPrefs.payout_updates !== false && preferences.payouts !== false;
    case "deposit_received":
    case "deposit_updates":
      return pushPrefs.deposit_updates !== false && preferences.deposits !== false;
    case "vault_updates":
      return pushPrefs.vault_updates !== false;
    case "security_alert":
      return preferences.security !== false;
    default:
      return preferences.general !== false;
  }
}

function extractExpoToken(recipient: PushRecipient): string | null {
  const direct = recipient.expo_push_token?.trim();
  const fallback = recipient.fcm_token?.trim();
  const candidate = direct || fallback;
  if (!candidate) return null;
  if (!candidate.startsWith("ExponentPushToken[")) return null;
  return candidate;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    // Get tokens based on user selection
    let recipients: PushRecipient[] = [];

    if (payload.send_to_all) {
      // Get all active FCM tokens
      const { data, error } = await supabase.rpc("get_active_fcm_tokens");

      if (error) {
        console.error("❌ Error fetching all FCM tokens:", error);
        throw error;
      }

      recipients = data || [];
    } else if (payload.user_ids && payload.user_ids.length > 0) {
      // Get FCM tokens for specific users
      const { data, error } = await supabase.rpc("get_active_fcm_tokens", {
        user_ids: payload.user_ids,
      });

      if (error) {
        console.error("❌ Error fetching user FCM tokens:", error);
        throw error;
      }

      recipients = data || [];
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

    if (recipients.length === 0) {
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

    const eligible = recipients.filter((row) =>
      canSendByPreferences(payload.notification_type, row),
    );
    console.log(`📊 Eligible users: ${eligible.length}/${recipients.length}`);
    if (eligible.length === 0) {
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

    // Send notifications in Expo batches.
    let totalSent = 0;
    let totalFailed = 0;
    const normalizedData = {
      type: payload.notification_type,
      ...(payload.data
        ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
        : {}),
    };

    const batchSize = 100;
    for (let i = 0; i < eligible.length; i += batchSize) {
      const batch = eligible.slice(i, i + batchSize);
      const body = batch
        .map((recipient) => {
          const expoToken = extractExpoToken(recipient);
          if (!expoToken) return null;
          return {
            to: expoToken,
            title: payload.title,
            body: payload.body,
            sound: "default",
            priority: "high",
            channelId: getChannelId(payload.notification_type),
            data: normalizedData,
          };
        })
        .filter(Boolean);

      if (body.length === 0) continue;

      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      const tickets: any[] = Array.isArray(result?.data) ? result.data : [];

      for (let idx = 0; idx < body.length; idx++) {
        const ticket = tickets[idx];
        const row = batch[idx];
        const token = body[idx].to;
        const ok = ticket?.status === "ok";
        if (ok) totalSent++;
        else totalFailed++;

        await supabase.from("notification_delivery_logs").insert({
          user_id: row.user_id,
          token,
          notification_type: payload.notification_type,
          title: payload.title,
          body: payload.body,
          payload: payload.data ?? {},
          status: ok ? "sent" : "failed",
          provider: "expo",
          provider_response: ticket ?? {},
          error: ok ? null : (ticket?.message ?? "Push send failed"),
          source_function: "send-push-notification",
          sent_at: ok ? new Date().toISOString() : null,
        });

        if (!ok && ticket?.details?.error === "DeviceNotRegistered") {
          await supabase
            .from("profiles")
            .update({ fcm_token: null })
            .eq("fcm_token", token);
          await supabase
            .from("user_push_tokens")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("expo_push_token", token);
        }
      }
    }

    console.log(`📊 Expo push results: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Push notifications sent",
        sent_count: totalSent,
        failed_count: totalFailed,
        total_recipients: eligible.length,
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

function getChannelId(notificationType: PushNotificationType): string {
  switch (notificationType) {
    case "payout_ready":
    case "payout_failed":
    case "payout_updates":
      return "payouts";
    case "deposit_received":
    case "deposit_updates":
      return "deposits";
    case "vault_updates":
      return "vaults";
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
