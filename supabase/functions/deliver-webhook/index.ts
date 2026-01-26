/**
 * Webhook Delivery Service
 * 
 * Delivers webhooks to partner endpoints with retry logic and
 * exponential backoff. Handles signature generation and delivery tracking.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get pending and retrying webhook deliveries
    const { data: deliveries, error: fetchError } = await supabase
      .from("webhook_deliveries")
      .select("*, webhook_configurations(*), partners(*)")
      .in("status", ["pending", "retrying"])
      .lte("next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error("Error fetching webhook deliveries:", fetchError)
      return new Response(
        JSON.stringify({ error: "Failed to fetch deliveries" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!deliveries || deliveries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No webhooks to deliver", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    let successCount = 0
    let failureCount = 0

    // Process each delivery
    for (const delivery of deliveries) {
      const config = delivery.webhook_configurations
      if (!config || !config.is_active) {
        // Mark as failed if config is inactive
        await supabase
          .from("webhook_deliveries")
          .update({
            status: "failed",
            error_message: "Webhook configuration is inactive",
          })
          .eq("id", delivery.id)
        failureCount++
        continue
      }

      try {
        // Generate HMAC signature
        const signature = generateSignature(
          JSON.stringify(delivery.event_data),
          config.secret || ""
        )

        // Deliver webhook
        const response = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Planmoni-Signature": signature,
            "X-Planmoni-Event-Type": delivery.event_type,
            "X-Planmoni-Delivery-ID": delivery.id,
          },
          body: JSON.stringify({
            event_type: delivery.event_type,
            data: delivery.event_data,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })

        const responseBody = await response.text()
        const newAttemptCount = delivery.attempt_count + 1

        if (response.ok) {
          // Success
          await supabase
            .from("webhook_deliveries")
            .update({
              status: "delivered",
              delivered_at: new Date().toISOString(),
              attempt_count: newAttemptCount,
              response_status: response.status,
              response_body: responseBody.substring(0, 1000), // Limit response body size
            })
            .eq("id", delivery.id)

          successCount++
        } else {
          // Failed - retry if attempts remaining
          if (newAttemptCount < delivery.max_attempts) {
            const nextRetry = calculateNextRetry(newAttemptCount)
            await supabase
              .from("webhook_deliveries")
              .update({
                status: "retrying",
                attempt_count: newAttemptCount,
                next_retry_at: nextRetry,
                response_status: response.status,
                response_body: responseBody.substring(0, 1000),
                error_message: `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
              })
              .eq("id", delivery.id)

            failureCount++
          } else {
            // Max attempts reached - mark as failed
            await supabase
              .from("webhook_deliveries")
              .update({
                status: "failed",
                attempt_count: newAttemptCount,
                response_status: response.status,
                response_body: responseBody.substring(0, 1000),
                error_message: `Max attempts reached. Last error: HTTP ${response.status}`,
              })
              .eq("id", delivery.id)

            failureCount++
          }
        }
      } catch (error: any) {
        // Network or other error
        const newAttemptCount = delivery.attempt_count + 1
        const errorMessage = error.message || "Unknown error"

        if (newAttemptCount < delivery.max_attempts) {
          const nextRetry = calculateNextRetry(newAttemptCount)
          await supabase
            .from("webhook_deliveries")
            .update({
              status: "retrying",
              attempt_count: newAttemptCount,
              next_retry_at: nextRetry,
              error_message: errorMessage,
            })
            .eq("id", delivery.id)

          failureCount++
        } else {
          await supabase
            .from("webhook_deliveries")
            .update({
              status: "failed",
              attempt_count: newAttemptCount,
              error_message: `Max attempts reached. Last error: ${errorMessage}`,
            })
            .eq("id", delivery.id)

          failureCount++
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Webhook delivery processed",
        processed: deliveries.length,
        successful: successCount,
        failed: failureCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Webhook delivery error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

/**
 * Generate HMAC signature for webhook
 */
function generateSignature(payload: string, secret: string): string {
  if (!secret) {
    return ""
  }

  const hmac = createHmac("sha256", secret)
  hmac.update(payload)
  return hmac.digest("hex")
}

/**
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetry(attemptCount: number): string {
  // Exponential backoff: 1min, 5min, 15min, 30min, 1hr
  const delays = [1, 5, 15, 30, 60] // minutes
  const delayMinutes = delays[Math.min(attemptCount - 1, delays.length - 1)]
  
  const nextRetry = new Date()
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes)
  
  return nextRetry.toISOString()
}
