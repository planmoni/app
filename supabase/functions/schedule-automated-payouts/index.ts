import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log("Starting automated payout scheduling...")

    // Get all active payout plans
    const { data: activePlans, error: plansError } = await supabase
      .from("payout_plans")
      .select("*")
      .eq("status", "active")
      .not("next_payout_date", "is", null)

    if (plansError) {
      console.error("Error fetching active payout plans:", plansError)
      return new Response(
        JSON.stringify({ error: "Failed to fetch active payout plans" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log(`Found ${activePlans?.length || 0} active payout plans`)

    if (!activePlans || activePlans.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active payout plans to schedule",
          scheduled: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    let scheduledCount = 0

    // Schedule payouts for the next 30 days
    for (const plan of activePlans) {
      try {
        const scheduledDates = []
        let currentDate = new Date(plan.next_payout_date)
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + 30) // Schedule 30 days ahead

        // Generate scheduled dates based on frequency
        while (currentDate <= endDate && plan.completed_payouts + scheduledDates.length < plan.duration) {
          const dateString = currentDate.toISOString().split('T')[0]
          
          // Check if automated payout already exists for this date
          const { data: existingPayout } = await supabase
            .from("automated_payouts")
            .select("id")
            .eq("payout_plan_id", plan.id)
            .eq("scheduled_date", dateString)
            .single()

          if (!existingPayout) {
            scheduledDates.push({
              payout_plan_id: plan.id,
              user_id: plan.user_id,
              scheduled_date: dateString,
              amount: plan.payout_amount,
              status: "pending",
              payout_account_id: plan.payout_account_id,
              execution_date: new Date(currentDate.getTime() + 12 * 60 * 60 * 1000).toISOString() // Execute at noon
            })
          }

          // Calculate next date based on frequency
          switch (plan.frequency) {
            case "weekly":
              currentDate.setDate(currentDate.getDate() + 7)
              break
            case "biweekly":
              currentDate.setDate(currentDate.getDate() + 14)
              break
            case "monthly":
              currentDate.setMonth(currentDate.getMonth() + 1)
              break
            case "custom":
              // For custom frequency, get next date from custom_payout_dates
              const { data: nextCustomDate } = await supabase
                .from("custom_payout_dates")
                .select("payout_date")
                .eq("payout_plan_id", plan.id)
                .gt("payout_date", dateString)
                .order("payout_date", { ascending: true })
                .limit(1)
                .single()
              
              if (nextCustomDate) {
                currentDate = new Date(nextCustomDate.payout_date)
              } else {
                break // No more custom dates
              }
              break
            default:
              currentDate.setDate(currentDate.getDate() + 7) // Default to weekly
          }
        }

        // Insert scheduled payouts
        if (scheduledDates.length > 0) {
          const { error: insertError } = await supabase
            .from("automated_payouts")
            .insert(scheduledDates)

          if (insertError) {
            console.error("Error inserting scheduled payouts:", insertError)
          } else {
            scheduledCount += scheduledDates.length
            console.log(`Scheduled ${scheduledDates.length} payouts for plan ${plan.id}`)
          }
        }

      } catch (error) {
        console.error(`Error scheduling payouts for plan ${plan.id}:`, error)
      }
    }

    console.log(`Automated payout scheduling completed. Scheduled ${scheduledCount} payouts.`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scheduled ${scheduledCount} automated payouts`,
        scheduled: scheduledCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Error in automated payout scheduler:", error)
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})