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

    console.log("Starting automated payout processing...")

    // Get all active payout plans that are due for payout (including past due)
    const now = new Date()
    const todayString = now.toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Check for payouts due today or overdue (past due dates)
    console.log("Checking for payouts due on or before:", todayString)

    const { data: duePlans, error: plansError } = await supabase
      .from("payout_plans")
      .select(`
        *,
        payout_accounts (
          account_name,
          account_number,
          bank_name,
          bank_code,
          paystack_recipient_code,
          transfer_enabled
        ),
        bank_accounts (
          account_name,
          account_number,
          bank_name,
          bank_code,
          paystack_recipient_code,
          transfer_enabled
        )
      `)
      .eq("status", "active")
      .lte("next_payout_date", todayString)
      .not("next_payout_date", "is", null)
      .order("next_payout_date", { ascending: true }) // Process overdue payouts first

    if (plansError) {
      console.error("Error fetching due payout plans:", plansError)
      return new Response(
        JSON.stringify({ error: "Failed to fetch due payout plans" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log(`Found ${duePlans?.length || 0} payout plans due for processing`)

    if (!duePlans || duePlans.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No payouts due for processing",
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const results = []
    let successCount = 0
    let failureCount = 0

    // Process each due payout plan
    for (const plan of duePlans) {
      try {
        console.log(`Processing payout for plan: ${plan.name} (${plan.id})`)

        // Check if there's already a pending automated payout for today
        const { data: existingPayout, error: existingError } = await supabase
          .from("automated_payouts")
          .select("id, status")
          .eq("payout_plan_id", plan.id)
          .eq("scheduled_date", todayString)
          .single()

        if (existingError && existingError.code !== "PGRST116") { // PGRST116 = no rows found
          console.error("Error checking existing payout:", existingError)
          continue
        }

        if (existingPayout) {
          console.log(`Payout already exists for plan ${plan.id} on ${todayString} with status: ${existingPayout.status}`)
          continue
        }

        // Determine which account to use for payout
        let accountDetails = null
        let accountType = ""

        if (plan.payout_account_id && plan.payout_accounts) {
          accountDetails = plan.payout_accounts
          accountType = "payout_account"
        } else if (plan.bank_account_id && plan.bank_accounts) {
          accountDetails = plan.bank_accounts
          accountType = "bank_account"
        }

        if (!accountDetails) {
          throw new Error("No valid bank account found for this payout plan")
        }

        // Validate account details
        if (!accountDetails.bank_code) {
          throw new Error(`Bank code missing for account ${accountDetails.account_number}`)
        }

        if (!accountDetails.account_name || !accountDetails.account_number || !accountDetails.bank_name) {
          throw new Error("Incomplete bank account information")
        }

        // Create automated payout record
        const transferReference = `AUTO_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        
        const { data: automatedPayout, error: createPayoutError } = await supabase
          .from("automated_payouts")
          .insert({
            payout_plan_id: plan.id,
            user_id: plan.user_id,
            scheduled_date: todayString,
            amount: plan.payout_amount,
            status: "processing",
            transfer_reference: transferReference,
            payout_account_id: plan.payout_account_id,
            execution_date: new Date().toISOString()
          })
          .select()
          .single()

        if (createPayoutError) {
          console.error("Error creating automated payout record:", createPayoutError)
          throw new Error("Failed to create payout record")
        }

        console.log("Created automated payout record:", automatedPayout.id)

        // Get Paystack secret key
        const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")
        
        if (!paystackSecretKey) {
          throw new Error("Paystack secret key not configured")
        }

        let recipientCode = accountDetails.paystack_recipient_code

        // Create recipient if not exists
        if (!recipientCode) {
          console.log("Creating Paystack recipient for:", {
            account_name: accountDetails.account_name,
            account_number: accountDetails.account_number,
            bank_code: accountDetails.bank_code
          })

          const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${paystackSecretKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              type: "nuban",
              name: accountDetails.account_name,
              account_number: accountDetails.account_number,
              bank_code: accountDetails.bank_code,
              currency: "NGN"
            })
          })

          const recipientData = await recipientResponse.json()
          
          if (!recipientResponse.ok || !recipientData.status) {
            throw new Error(`Failed to create recipient: ${recipientData.message || 'Cannot resolve account'}`)
          }

          recipientCode = recipientData.data.recipient_code

          // Update account with recipient code
          const updateTable = accountType === "payout_account" ? "payout_accounts" : "bank_accounts"
          await supabase
            .from(updateTable)
            .update({ 
              paystack_recipient_code: recipientCode,
              transfer_enabled: true,
              last_transfer_attempt: new Date().toISOString()
            })
            .eq("id", accountType === "payout_account" ? plan.payout_account_id : plan.bank_account_id)
        }

        console.log("Processing transfer with recipient code:", recipientCode)

        // Process the transfer
        const transferResponse = await fetch("https://api.paystack.co/transfer", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${paystackSecretKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source: "balance",
            amount: plan.payout_amount * 100, // Convert to kobo
            recipient: recipientCode,
            reason: `Automated payout: ${plan.name}`,
            reference: transferReference
          })
        })

        const transferData = await transferResponse.json()
        
        if (!transferResponse.ok || !transferData.status) {
          throw new Error(`Transfer failed: ${transferData.message || 'Unknown transfer error'}`)
        }

        console.log("Transfer successful:", transferData.data.transfer_code)

        // Update automated payout to completed
        await supabase
          .from("automated_payouts")
          .update({ 
            status: "completed",
            paystack_transfer_id: transferData.data.id,
            transfer_code: transferData.data.transfer_code,
            completed_at: new Date().toISOString(),
            transferred_at: new Date().toISOString()
          })
          .eq("id", automatedPayout.id)

        // Create transaction record
        await supabase
          .from("transactions")
          .insert({
            user_id: plan.user_id,
            type: "payout",
            amount: plan.payout_amount,
            status: "completed",
            source: "payout_plan",
            destination: "bank_account",
            payout_plan_id: plan.id,
            bank_account_id: plan.bank_account_id,
            reference: transferReference,
            description: `Automated payout from ${plan.name}`,
            metadata: {
              automated_payout_id: automatedPayout.id,
              paystack_transfer_id: transferData.data.id,
              transfer_code: transferData.data.transfer_code
            }
          })

        // Unlock the payout amount from locked balance
        const { error: unlockError } = await supabase.rpc("unlock_funds", {
          arg_user_id: plan.user_id,
          arg_amount: plan.payout_amount
        })

        if (unlockError) {
          console.error("Error unlocking funds:", unlockError)
          // Don't fail the entire process, just log the error
        }

        // Update payout plan - increment completed payouts and calculate next payout date
        const newCompletedPayouts = plan.completed_payouts + 1
        let nextPayoutDate = null

        // Calculate next payout date if plan is not completed
        if (newCompletedPayouts < plan.duration) {
          const currentPayoutDate = new Date(plan.next_payout_date)
          const nextDate = new Date(currentPayoutDate)

          switch (plan.frequency) {
            case "weekly":
              nextDate.setDate(currentPayoutDate.getDate() + 7)
              break
            case "biweekly":
              nextDate.setDate(currentPayoutDate.getDate() + 14)
              break
            case "monthly":
              nextDate.setMonth(currentPayoutDate.getMonth() + 1)
              break
            case "custom":
              // For custom frequency, get the next date from custom_payout_dates
              const { data: customDates } = await supabase
                .from("custom_payout_dates")
                .select("payout_date")
                .eq("payout_plan_id", plan.id)
                .gt("payout_date", todayString)
                .order("payout_date", { ascending: true })
                .limit(1)
                .single()
              
              if (customDates) {
                nextPayoutDate = customDates.payout_date
              }
              break
          }

          if (plan.frequency !== "custom") {
            nextPayoutDate = nextDate.toISOString().split('T')[0]
          }
        }

        // Update payout plan
        const planUpdates: any = {
          completed_payouts: newCompletedPayouts,
          next_payout_date: nextPayoutDate,
          updated_at: new Date().toISOString()
        }

        // Mark as completed if all payouts are done
        if (newCompletedPayouts >= plan.duration) {
          planUpdates.status = "completed"
        }

        await supabase
          .from("payout_plans")
          .update(planUpdates)
          .eq("id", plan.id)

        // Create success notification
        await supabase
          .from("events")
          .insert({
            user_id: plan.user_id,
            type: "payout_completed",
            title: "Payout Completed",
            description: `Your payout of ₦${plan.payout_amount.toLocaleString()} from "${plan.name}" has been processed successfully.`,
            status: "unread",
            payout_plan_id: plan.id
          })

        console.log(`Successfully processed payout for plan ${plan.id}`)
        
        results.push({
          planId: plan.id,
          planName: plan.name,
          amount: plan.payout_amount,
          status: "success",
          transferCode: transferData.data.transfer_code
        })
        
        successCount++

      } catch (error: any) {
        console.error(`Error processing payout for plan ${plan.id}:`, error)
        
        // Update automated payout to failed if it was created
        try {
          await supabase
            .from("automated_payouts")
            .update({ 
              status: "failed",
              error_message: error.message || 'Unknown error',
              completed_at: new Date().toISOString()
            })
            .eq("payout_plan_id", plan.id)
            .eq("scheduled_date", todayString)
            .eq("status", "processing")
        } catch (updateError) {
          console.error("Error updating failed payout status:", updateError)
        }

        // Create failure notification
        await supabase
          .from("events")
          .insert({
            user_id: plan.user_id,
            type: "disbursement_failed",
            title: "Payout Failed",
            description: `Your scheduled payout from "${plan.name}" failed to process: ${error.message || 'Unknown error'}`,
            status: "unread",
            payout_plan_id: plan.id
          })

        results.push({
          planId: plan.id,
          planName: plan.name,
          amount: plan.payout_amount,
          status: "failed",
          error: error.message
        })
        
        failureCount++
      }
    }

    console.log(`Automated payout processing completed. Success: ${successCount}, Failed: ${failureCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${successCount + failureCount} payouts. ${successCount} successful, ${failureCount} failed.`,
        processed: successCount + failureCount,
        successful: successCount,
        failed: failureCount,
        results: results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error("Error in automated payout processor:", error)
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message || 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})