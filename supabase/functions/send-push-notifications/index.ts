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
    
    // Allow the function to be called without JWT verification (for cron jobs and internal triggers)
    // But still require service role key in environment variables for security
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
        
        // Log token format for debugging (first 50 chars only for security)
        if (pushToken) {
          console.log(`Token format check: ${pushToken.substring(0, 50)}...`);
        } else {
          console.warn(`⚠️ No push token found for notification ${notification.id}`);
        }
        
        // Check if it's an Expo Push Token
        // Expo tokens can be: ExponentPushToken[...] or ExpoPushToken[...]
        const isExpoToken = pushToken && (
          pushToken.startsWith('ExponentPushToken[') || 
          pushToken.startsWith('ExpoPushToken[') ||
          pushToken.includes('ExponentPushToken') ||
          pushToken.includes('ExpoPushToken')
        );
        
        if (isExpoToken) {
          // Build notification payload according to Expo Push Notification API
          // Expo Push API requires an array of notification objects, even for a single notification
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

          // Send via Expo Push Notification API
          // IMPORTANT: Expo Push API requires an array, even for a single notification
          const expoResponse = await fetch(EXPO_PUSH_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify([notificationPayload]), // Wrap in array as required by Expo API
          });

          const expoResult = await expoResponse.json();

          // Handle Expo API response format - can be single object or array
          const resultData = Array.isArray(expoResult.data) ? expoResult.data[0] : expoResult.data;
          
          if (expoResponse.ok && resultData && resultData.status === 'ok') {
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
            // Handle both array and single object response formats
            const resultData = Array.isArray(expoResult.data) ? expoResult.data[0] : expoResult.data;
            const errorMsg = resultData?.details?.error || resultData?.message || expoResult.errors?.[0]?.message || JSON.stringify(expoResult);
            
            // Mark as failed
            await supabase
              .from('push_notification_queue')
              .update({
                status: 'failed',
                error_message: errorMsg.substring(0, 500), // Limit error message length
                updated_at: new Date().toISOString()
              })
              .eq('id', notification.id);

            console.error(`❌ Failed to send Expo push notification: ${notification.id}`, {
              status: expoResponse.status,
              statusText: expoResponse.statusText,
              result: expoResult,
              token: pushToken?.substring(0, 50) + '...'
            });
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
