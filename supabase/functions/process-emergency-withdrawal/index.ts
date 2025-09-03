import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"

// Deno types for Edge Functions
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user authentication
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const userId = userData.user.id

    // Get request data
    const { emergencyWithdrawalId } = await req.json()

    if (!emergencyWithdrawalId) {
      return new Response(
        JSON.stringify({ error: "Emergency withdrawal ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get the emergency withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("emergency_withdrawals")
      .select(`
        *,
        payout_plans (
          id,
          name,
          total_amount,
          payout_amount,
          completed_payouts,
          emergency_withdrawal_enabled
        ),
        payout_accounts (
          account_name,
          account_number,
          bank_name,
          bank_code,
          paystack_recipient_code,
          transfer_enabled,
          last_transfer_attempt
        ),
        bank_accounts (
          account_name,
          account_number,
          bank_name,
          bank_code,
          paystack_recipient_code,
          transfer_enabled,
          last_transfer_attempt
        )
      `)
      .eq("id", emergencyWithdrawalId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .single()

    if (withdrawalError || !withdrawal) {
      return new Response(
        JSON.stringify({ error: "Emergency withdrawal not found or already processed" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate that emergency withdrawal is enabled for this plan
    if (!withdrawal.payout_plans?.emergency_withdrawal_enabled) {
      return new Response(
        JSON.stringify({ error: "Emergency withdrawal is not enabled for this payout plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Calculate remaining amount in the plan
    const plan = withdrawal.payout_plans
    const remainingAmount = plan.total_amount - (plan.completed_payouts * plan.payout_amount)

    // Validate withdrawal amount
    if (withdrawal.withdrawal_amount > remainingAmount) {
      return new Response(
        JSON.stringify({ error: "Withdrawal amount exceeds available funds in the plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Update withdrawal status to processing
    const { error: updateError } = await supabase
      .from("emergency_withdrawals")
      .update({ 
        status: "processing",
        processed_at: new Date().toISOString()
      })
      .eq("id", emergencyWithdrawalId)

    if (updateError) {
      console.error("Error updating withdrawal status:", updateError)
      return new Response(
        JSON.stringify({ error: "Failed to update withdrawal status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    try {
      // Get Paystack secret key
      const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")
      
      if (!paystackSecretKey) {
        throw new Error("Paystack secret key not configured")
      }

      // Determine recipient code and account details based on account type
      let recipientCode = ""
      let accountDetails = ""
      let bankCode = ""
      let accountName = ""
      let accountNumber = ""
      let bankName = ""
      
      if (withdrawal.payout_account_id && withdrawal.payout_accounts) {
        recipientCode = withdrawal.payout_accounts.paystack_recipient_code || ""
        bankCode = withdrawal.payout_accounts.bank_code || ""
        accountName = withdrawal.payout_accounts.account_name
        accountNumber = withdrawal.payout_accounts.account_number
        bankName = withdrawal.payout_accounts.bank_name
        accountDetails = `${bankName} ${accountNumber}`
      } else if (withdrawal.bank_account_id && withdrawal.bank_accounts) {
        recipientCode = withdrawal.bank_accounts.paystack_recipient_code || ""
        bankCode = withdrawal.bank_accounts.bank_code || ""
        accountName = withdrawal.bank_accounts.account_name
        accountNumber = withdrawal.bank_accounts.account_number
        bankName = withdrawal.bank_accounts.bank_name
        accountDetails = `${bankName} ${accountNumber}`
      } else {
        throw new Error("No valid bank account found for this withdrawal")
      }

      // Validate that we have a bank code
      if (!bankCode) {
        throw new Error(`Bank code not found for account ${accountNumber}. Please update your bank account details.`)
      }

      // Validate that we have all required account details
      if (!accountName || !accountNumber || !bankName) {
        throw new Error("Incomplete bank account information. Please update your account details.")
      }

      // If no recipient code, create one (this would normally be done when adding the account)
      if (!recipientCode) {
        console.log("Creating Paystack recipient with:", {
          account_name: accountName,
          account_number: accountNumber,
          bank_code: bankCode,
          bank_name: bankName
        })

        // Create recipient on Paystack
        const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${paystackSecretKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: "nuban",
            name: accountName,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: "NGN"
          })
        })

        const recipientData = await recipientResponse.json()
        
        console.log("Paystack recipient response:", {
          status: recipientResponse.status,
          ok: recipientResponse.ok,
          data: recipientData
        })
        
        if (recipientResponse.ok && recipientData.status) {
          recipientCode = recipientData.data.recipient_code
          
          // Update the account with the recipient code and enable transfers
          if (withdrawal.payout_account_id) {
            await supabase
              .from("payout_accounts")
              .update({ 
                paystack_recipient_code: recipientCode,
                transfer_enabled: true,
                last_transfer_attempt: new Date().toISOString()
              })
              .eq("id", withdrawal.payout_account_id)
          } else if (withdrawal.bank_account_id) {
            await supabase
              .from("bank_accounts")
              .update({ 
                paystack_recipient_code: recipientCode,
                transfer_enabled: true,
                last_transfer_attempt: new Date().toISOString()
              })
              .eq("id", withdrawal.bank_account_id)
          }
        } else {
          throw new Error(`Failed to create recipient: ${recipientData.message || 'Cannot resolve account'}`)
        }
      }

      console.log("Processing transfer with recipient code:", recipientCode)

      // Process the transfer via Paystack
      const transferResponse = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: "balance",
          amount: withdrawal.net_amount * 100, // Convert to kobo
          recipient: recipientCode,
          reason: `Emergency withdrawal: ${plan.name}`,
          reference: withdrawal.reference
        })
      })

      const transferData = await transferResponse.json()
      
      console.log("Paystack transfer response:", {
        status: transferResponse.status,
        ok: transferResponse.ok,
        data: transferData
      })
      
      if (!transferResponse.ok || !transferData.status) {
        throw new Error(`Transfer failed: ${transferData.message || 'Unknown transfer error'}`)
      }

      // Update withdrawal status to completed
      const { error: completeError } = await supabase
        .from("emergency_withdrawals")
        .update({ 
          status: "completed",
          transfer_code: transferData.data.transfer_code,
          transferred_at: new Date().toISOString(),
          metadata: {
            paystack_transfer_id: transferData.data.id,
            paystack_reference: transferData.data.reference
          }
        })
        .eq("id", emergencyWithdrawalId)

      if (completeError) {
        console.error("Error updating withdrawal to completed:", completeError)
      }

      // Deduct the withdrawal amount from locked balance
      const { error: unlockError } = await supabase.rpc("unlock_funds", {
        arg_user_id: userId,
        arg_amount: withdrawal.withdrawal_amount
      })

      if (unlockError) {
        console.error("Error unlocking funds:", unlockError)
        throw new Error(`Failed to unlock funds: ${unlockError.message}`)
      }

      // Update the transaction status to completed
      const { error: txUpdateError } = await supabase
        .from("transactions")
        .update({ 
          status: "completed",
          metadata: {
            paystack_transfer_id: transferData.data.id,
            transfer_code: transferData.data.transfer_code
          }
        })
        .eq("reference", withdrawal.reference)

      if (txUpdateError) {
        console.error("Error updating transaction status:", txUpdateError)
      }

      // Create success notification
      await supabase
        .from("events")
        .insert({
          user_id: userId,
          type: "payout_completed",
          title: "Emergency Withdrawal Completed",
          description: `Your emergency withdrawal of ₦${withdrawal.net_amount.toLocaleString()} has been processed successfully.`,
          status: "unread"
        })

      return new Response(
        JSON.stringify({
          success: true,
          message: "Emergency withdrawal processed successfully",
          data: {
            transfer_code: transferData.data.transfer_code,
            reference: withdrawal.reference,
            net_amount: withdrawal.net_amount,
            status: "completed",
            account_details: accountDetails
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

    } catch (error) {
      console.error("Error processing transfer:", error)
      
      // Update withdrawal status to failed
      await supabase
        .from("emergency_withdrawals")
        .update({ 
          status: "failed",
          error_message: error.message,
          processed_at: new Date().toISOString()
        })
        .eq("id", emergencyWithdrawalId)

      // Update transaction status to failed
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("reference", withdrawal.reference)

      // Create failure notification
      await supabase
        .from("events")
        .insert({
          user_id: userId,
          type: "disbursement_failed",
          title: "Emergency Withdrawal Failed",
          description: `Your emergency withdrawal request failed: ${error.message}`,
          status: "unread"
        })

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to process emergency withdrawal",
          details: error.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

  } catch (error) {
    console.error("Error in emergency withdrawal processor:", error)
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})