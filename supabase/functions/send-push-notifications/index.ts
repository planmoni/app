// Follow Deno's ES modules convention
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID") || "";
    const firebaseServiceAccountKey = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey || !firebaseProjectId || !firebaseServiceAccountKey) {
      console.error("Missing required environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
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

        // Get access token using service account
        const serviceAccount = JSON.parse(firebaseServiceAccountKey);
        const accessToken = await getAccessToken(serviceAccount);

        // Send push notification via FCM v1 API
        const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: notification.fcm_token,
              notification: {
                title: notification.title,
                body: notification.body,
              },
              data: {
                ...notification.data,
                notification_id: notification.id,
                user_id: notification.user_id,
              },
              android: {
                priority: 'high',
                notification: {
                  icon: 'ic_launcher',
                  click_action: 'FLUTTER_NOTIFICATION_CLICK',
                }
              },
              apns: {
                payload: {
                  aps: {
                    badge: 1,
                    sound: 'default'
                  }
                }
              }
            }
          }),
        });

        const fcmResult = await fcmResponse.json();

        if (fcmResponse.ok && fcmResult.name) {
          // Mark as sent
          await supabase
            .from('push_notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id);

          console.log(`✅ Push notification sent successfully: ${notification.id}`);
          successCount++;
        } else {
          // Mark as failed
          await supabase
            .from('push_notification_queue')
            .update({
              status: 'failed',
              error_message: JSON.stringify(fcmResult),
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id);

          console.error(`❌ Failed to send push notification: ${notification.id}`, fcmResult);
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
        details: error.message || "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Function to get access token using service account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

  // Create JWT token
  const jwtToken = await createJWT(jwtPayload, serviceAccount.private_key);
  
  // Get access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtToken
    })
  });
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Simplified JWT creation for service account
async function createJWT(payload: any, privateKey: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  
  // Base64URL encode header and payload
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  // Create signature input
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  // For simplicity, we'll use a basic approach
  // In production, consider using a proper JWT library
  const encoder = new TextEncoder();
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  
  // Import the private key
  const keyData = encoder.encode(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  // Sign the signature input
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );
  
  // Base64URL encode the signature
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Return the complete JWT
  return `${signatureInput}.${signatureB64}`;
} 