// Follow Deno's ES modules convention
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Expo Push Notification API endpoint
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log("🔄 Starting push notification processing...");
    
    // Get pending notifications from queue
    const { data: pendingNotifications, error: queueError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (queueError) {
      console.error("Error fetching pending notifications:", queueError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending notifications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log("No pending notifications found");
      return new Response(
        JSON.stringify({ message: "No pending notifications" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingNotifications.length} pending notifications`);

    let successCount = 0;
    let failureCount = 0;

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        console.log(`Processing notification ${notification.id} for user ${notification.user_id}`);

        const pushToken = notification.fcm_token;
        
        // Check if it's an Expo Push Token
        const isExpoToken = pushToken && (pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken['));
        
        if (isExpoToken) {
          // Send via Expo Push Notification API
          const expoResponse = await fetch(EXPO_PUSH_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
            },
            // Build notification payload according to Expo Push Notification API
            const notificationPayload: any = {
              to: pushToken,
              sound: 'default',
              title: notification.title,
              body: notification.body,
              data: {
                ...notification.data,
                notification_id: notification.id,
                user_id: notification.user_id,
                // Ensure route is included for navigation
                route: notification.data?.route || '/(tabs)/',
              },
              badge: 1,
              priority: 'high',
            };

            // Add Android-specific channel ID
            if (notification.data?.type === 'payout') {
              notificationPayload.android = { channelId: 'payouts' };
            } else if (notification.data?.type === 'security') {
              notificationPayload.android = { channelId: 'security' };
            } else if (notification.data?.type === 'transaction' || notification.data?.type === 'deposit_successful') {
              notificationPayload.android = { channelId: 'transactions' };
            } else {
              notificationPayload.android = { channelId: 'default' };
            }

            const expoResponse = await fetch(EXPO_PUSH_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
              },
              body: JSON.stringify(notificationPayload),
          });

          const expoResult = await expoResponse.json();

          if (expoResponse.ok && expoResult.data && expoResult.data.status === 'ok') {
            // Mark as sent
            await supabase
              .from('push_notification_queue')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', notification.id);

            console.log(`✅ Expo push notification sent successfully: ${notification.id}`);
            successCount++;
          } else {
            // Check if there are errors in the response
            const errorMsg = expoResult.data?.details?.error || JSON.stringify(expoResult);
            
            // Mark as failed
            await supabase
              .from('push_notification_queue')
              .update({
                status: 'failed',
                error_message: errorMsg,
                updated_at: new Date().toISOString()
              })
              .eq('id', notification.id);

            console.error(`❌ Failed to send Expo push notification: ${notification.id}`, expoResult);
            failureCount++;
          }
        } else {
          // For non-Expo tokens, log that we need FCM implementation
          console.warn(`⚠️ Non-Expo token detected for notification ${notification.id}, skipping (FCM not implemented)`);
          
          await supabase
            .from('push_notification_queue')
            .update({
              status: 'failed',
              error_message: 'Non-Expo token - FCM implementation needed',
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          failureCount++;
        }

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('push_notification_queue')
          .update({
            status: 'failed',
            error_message: (error as Error).message || 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        failureCount++;
      }
    }

    console.log(`✅ Push notification processing completed: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Push notifications processed",
        processed: pendingNotifications.length,
        sent: successCount,
        failed: failureCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in push notification processing:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process push notifications",
        details: (error as Error).message || "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
