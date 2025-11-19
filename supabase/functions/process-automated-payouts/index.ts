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

    const results: any[] = []
    let successCount = 0
    let failureCount = 0

    // Process each due payout plan
    for (const plan of duePlans) {
      // Declare variables outside try block for use in catch block
      let transferReference: string | null = null
      let automatedPayout: any = null
      
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
        let accountDetails: any = null
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
        transferReference = `AUTO_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        
        const { data: createdPayout, error: createPayoutError } = await supabase
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

        automatedPayout = createdPayout
        console.log("Created automated payout record:", automatedPayout.id)

        // Get SafeHaven configuration
        const safeHavenClientId = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID") || Deno.env.get("SAFEHAVEN_CLIENT_ID")
        const safeHavenClientAssertion = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION") || Deno.env.get("SAFEHAVEN_CLIENT_ASSERTION")
        const safeHavenApiUrl = "https://api.safehavenmfb.com"
        
        if (!safeHavenClientId || !safeHavenClientAssertion) {
          throw new Error("SafeHaven credentials not configured")
        }

        // Get user's SafeHaven token
        const { data: safeHavenToken, error: tokenError } = await supabase
          .from("safehaven_tokens")
          .select("access_token, expires_at, refresh_token")
          .eq("user_id", plan.user_id)
          .single()

        if (tokenError || !safeHavenToken) {
          throw new Error("SafeHaven token not found. User needs to authenticate with SafeHaven first.")
        }

        // Check if token is expired (with 5 minute buffer)
        const expiresAt = new Date(safeHavenToken.expires_at)
        const now = new Date()
        const bufferTime = 5 * 60 * 1000 // 5 minutes in milliseconds
        
        if (expiresAt.getTime() - now.getTime() < bufferTime) {
          // Token expired or expiring soon, try to refresh
          console.log("SafeHaven token expired or expiring soon, attempting refresh...")
          
          const refreshResponse = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              grant_type: "refresh_token",
              client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
              client_assertion: safeHavenClientAssertion,
              client_id: safeHavenClientId,
              refresh_token: safeHavenToken.refresh_token
            })
          })

          if (!refreshResponse.ok) {
            throw new Error("Failed to refresh SafeHaven token")
          }

          const refreshData = await refreshResponse.json()
          
          // Update token in database
          await supabase
            .from("safehaven_tokens")
            .update({
              access_token: refreshData.access_token,
              refresh_token: refreshData.refresh_token || safeHavenToken.refresh_token,
              expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("user_id", plan.user_id)

          safeHavenToken.access_token = refreshData.access_token
        }

        // Get user's SafeHaven default account (fromAccount)
        const { data: safeHavenAccount, error: accountError } = await supabase
          .from("safehaven_accounts")
          .select("account_number, account_name, can_debit, account_balance")
          .eq("user_id", plan.user_id)
          .eq("is_deleted", false)
          .order("is_default", { ascending: false })
          .order("account_balance", { ascending: false })
          .limit(1)
          .single()

        if (accountError || !safeHavenAccount) {
          throw new Error("SafeHaven account not found. User needs to have a SafeHaven account.")
        }

        if (!safeHavenAccount.can_debit) {
          throw new Error("SafeHaven account does not allow debits")
        }

        if (safeHavenAccount.account_balance < plan.payout_amount) {
          throw new Error(`Insufficient balance. Available: ₦${safeHavenAccount.account_balance}, Required: ₦${plan.payout_amount}`)
        }

        console.log("Processing SafeHaven transfer:", {
          fromAccount: safeHavenAccount.account_number,
          toAccount: accountDetails.account_number,
          amount: plan.payout_amount
        })

        // Step 1: Perform name enquiry first
        console.log("Performing name enquiry...")
        const nameEnquiryResponse = await fetch(`${safeHavenApiUrl}/transfers/name-enquiry`, {
          method: "POST",
          headers: {
            "ClientID": safeHavenClientId,
            "Authorization": `Bearer ${safeHavenToken.access_token}`,
            "accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bankCode: accountDetails.bank_code,
            accountNumber: accountDetails.account_number
          })
        })

        const nameEnquiryData = await nameEnquiryResponse.json()
        
        if (!nameEnquiryResponse.ok) {
          const errorMessage = nameEnquiryData.message || nameEnquiryData.error || 'Name enquiry failed'
          throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`)
        }

        const nameEnquiryReference = nameEnquiryData.data?.sessionId || nameEnquiryData.sessionId
        if (!nameEnquiryReference) {
          throw new Error("Name enquiry did not return sessionId")
        }

        console.log("Name enquiry successful, sessionId:", nameEnquiryReference)

        // Step 2: Initiate SafeHaven transfer with nameEnquiryReference
        const transferResponse = await fetch(`${safeHavenApiUrl}/transfers`, {
          method: "POST",
          headers: {
            "ClientID": safeHavenClientId,
            "Authorization": `Bearer ${safeHavenToken.access_token}`,
            "accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            saveBeneficiary: true,
            amount: plan.payout_amount,
            beneficiaryAccountNumber: accountDetails.account_number,
            beneficiaryBankCode: accountDetails.bank_code,
            debitAccountNumber: safeHavenAccount.account_number,
            nameEnquiryReference: nameEnquiryReference,
            narration: `Automated payout: ${plan.name}`,
            paymentReference: transferReference
          })
        })

        const transferData = await transferResponse.json()
        
        if (!transferResponse.ok) {
          const errorMessage = transferData.message || transferData.error || 'Unknown transfer error'
          throw new Error(`SafeHaven transfer failed: ${errorMessage}`)
        }

        // Extract transfer details from response
        const transferResult = transferData.data || transferData
        const transferId = transferResult._id || transferResult.id
        const paymentReference = transferResult.paymentReference || transferReference
        const sessionId = transferResult.sessionId || transferResult.session_id

        console.log("SafeHaven transfer initiated:", {
          transferId,
          paymentReference,
          status: transferResult.status || "Pending"
        })

        // Update automated payout with SafeHaven transfer details
        // Note: Status will be updated by webhook when transfer completes
        await supabase
          .from("automated_payouts")
          .update({ 
            status: transferResult.status === "Completed" ? "completed" : "processing",
            safehaven_transfer_id: transferId,
            transfer_code: paymentReference,
            session_id: sessionId,
            payment_reference: paymentReference,
            completed_at: transferResult.status === "Completed" ? new Date().toISOString() : null,
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
            status: transferResult.status === "Completed" ? "completed" : "pending",
            source: "payout_plan",
            destination: "bank_account",
            payout_plan_id: plan.id,
            bank_account_id: plan.bank_account_id,
            reference: paymentReference,
            description: `Automated payout from ${plan.name}`,
            metadata: {
              automated_payout_id: automatedPayout.id,
              safehaven_transfer_id: transferId,
              transfer_code: paymentReference,
              session_id: sessionId,
              provider: "safehaven"
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
          const startDate = new Date(plan.start_date)
          let nextDate = new Date(startDate)

          // Calculate the next payout date based on start_date and completed_payouts count
          // This ensures the first payout happens on start_date, and subsequent payouts
          // are calculated from the start_date + (completed_payouts * frequency_interval)
          switch (plan.frequency) {
            case "weekly":
              nextDate.setDate(startDate.getDate() + (newCompletedPayouts * 7))
              break
            case "biweekly":
              nextDate.setDate(startDate.getDate() + (newCompletedPayouts * 14))
              break
            case "monthly":
              nextDate.setMonth(startDate.getMonth() + newCompletedPayouts)
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
          updated_at: new Date().toISOString()
        }
        
        if (nextPayoutDate) {
          planUpdates.next_payout_date = nextPayoutDate
        } else {
          planUpdates.next_payout_date = null
        }

        // Mark as completed if all payouts are done
        if (newCompletedPayouts >= plan.duration) {
          planUpdates.status = "completed"
        }

        await supabase
          .from("payout_plans")
          .update(planUpdates)
          .eq("id", plan.id)

        // Create success notification (only if transfer is completed immediately)
        if (transferResult.status === "Completed") {
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
          
        } else {
          // If transfer is pending, create a processing notification
          await supabase
            .from("events")
            .insert({
              user_id: plan.user_id,
              type: "payout_processing",
              title: "Payout Processing",
              description: `Your payout of ₦${plan.payout_amount.toLocaleString()} from "${plan.name}" is being processed. You will be notified when it completes.`,
              status: "unread",
              payout_plan_id: plan.id
            })
        }

        console.log(`Successfully initiated SafeHaven transfer for plan ${plan.id}`)
        
        results.push({
          planId: plan.id,
          planName: plan.name,
          amount: plan.payout_amount,
          status: transferResult.status === "Completed" ? "success" : "processing",
          transferId: transferId,
          transferCode: paymentReference,
          message: transferResult.status === "Completed" 
            ? "Transfer completed successfully" 
            : "Transfer initiated, awaiting completion"
        })
        
        // Only count as success if completed immediately
        if (transferResult.status === "Completed") {
          successCount++
        } else {
          // Count as success since transfer was initiated successfully
          // Webhook will update status when it completes
          successCount++
        }

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