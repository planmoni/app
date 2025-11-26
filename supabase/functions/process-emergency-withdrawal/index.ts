import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Deno types for Edge Functions
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

// SafeHaven API configuration
const safeHavenClientId = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID") || Deno.env.get("SAFEHAVEN_CLIENT_ID");
const safeHavenClientAssertion = Deno.env.get("EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION") || Deno.env.get("SAFEHAVEN_CLIENT_ASSERTION");
const safeHavenApiUrl = "https://api.safehavenmfb.com";

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
          emergency_withdrawal_enabled,
          created_at
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

    // Calculate time elapsed since plan creation
    const planCreatedAt = new Date(plan.created_at)
    const now = new Date()
    const timeElapsedMs = now.getTime() - planCreatedAt.getTime()
    const timeElapsedHours = timeElapsedMs / (1000 * 60 * 60)
    const timeElapsedDays = timeElapsedHours / 24

    console.log(`Plan created: ${planCreatedAt.toISOString()}`)
    console.log(`Current time: ${now.toISOString()}`)
    console.log(`Time elapsed: ${timeElapsedHours.toFixed(2)} hours (${timeElapsedDays.toFixed(2)} days)`)

    // Determine the correct withdrawal type based on time elapsed
    let correctWithdrawalType = ""
    let feePercentage = 0

    if (timeElapsedHours < 24) {
      // Less than 24 hours - only instant withdrawal allowed
      correctWithdrawalType = "instant"
      feePercentage = 12.00
    } else if (timeElapsedHours < 72) {
      // Between 24-72 hours - 24hrs or instant withdrawal allowed
      if (withdrawal.withdrawal_type === "instant") {
        correctWithdrawalType = "instant"
        feePercentage = 12.00
      } else if (withdrawal.withdrawal_type === "24hrs") {
        correctWithdrawalType = "24hrs"
        feePercentage = 10.00
      } else {
        return new Response(
          JSON.stringify({ 
            error: "Invalid withdrawal type for this time period. Only 'instant' or '24hrs' allowed for plans less than 72 hours old." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    } else {
      // More than 72 hours - all withdrawal types allowed
      if (withdrawal.withdrawal_type === "instant") {
        correctWithdrawalType = "instant"
        feePercentage = 12.00
      } else if (withdrawal.withdrawal_type === "24hrs") {
        correctWithdrawalType = "24hrs"
        feePercentage = 10.00
      } else if (withdrawal.withdrawal_type === "72hrs") {
        correctWithdrawalType = "72hrs"
        feePercentage = 6.00
      } else {
        return new Response(
          JSON.stringify({ 
            error: "Invalid withdrawal type. Must be 'instant', '24hrs', or '72hrs'." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    console.log(`Selected withdrawal type: ${correctWithdrawalType}, Fee percentage: ${feePercentage}%`)

    // Calculate fee based on remaining amount (not total amount)
    const feeAmount = (remainingAmount * feePercentage) / 100
    const netAmount = remainingAmount - feeAmount

    console.log(`Remaining amount: ₦${remainingAmount.toLocaleString()}`)
    console.log(`Fee amount (${feePercentage}%): ₦${feeAmount.toLocaleString()}`)
    console.log(`Net amount to user: ₦${netAmount.toLocaleString()}`)

    // Validate withdrawal amount matches remaining amount
    if (withdrawal.withdrawal_amount !== remainingAmount) {
      return new Response(
        JSON.stringify({ 
          error: `Withdrawal amount must equal remaining amount (₦${remainingAmount.toLocaleString()}). Emergency withdrawal withdraws the entire remaining balance.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Update the withdrawal record with correct fee and net amounts
    const { error: feeUpdateError } = await supabase
      .from("emergency_withdrawals")
      .update({ 
        fee_amount: feeAmount,
        net_amount: netAmount,
        withdrawal_type: correctWithdrawalType
      })
      .eq("id", emergencyWithdrawalId)

    if (feeUpdateError) {
      console.error("Error updating withdrawal fees:", feeUpdateError)
      return new Response(
        JSON.stringify({ error: "Failed to update withdrawal fees" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Calculate scheduled processing time based on withdrawal type
    let scheduledProcessingTime = new Date()
    let status = "processing"
    
    if (correctWithdrawalType === "instant") {
      // Process immediately
      scheduledProcessingTime = new Date()
      status = "processing"
    } else if (correctWithdrawalType === "24hrs") {
      // Schedule for processing within 24 hours
      scheduledProcessingTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      status = "scheduled"
    } else if (correctWithdrawalType === "72hrs") {
      // Schedule for processing within 72 hours
      scheduledProcessingTime = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours from now
      status = "scheduled"
    }

    // Update withdrawal status and scheduled time
    const { error: updateError } = await supabase
      .from("emergency_withdrawals")
      .update({ 
        status: status,
        processed_at: status === "processing" ? new Date().toISOString() : null,
        scheduled_processing_time: scheduledProcessingTime.toISOString()
      })
      .eq("id", emergencyWithdrawalId)

    if (updateError) {
      console.error("Error updating withdrawal status:", updateError)
      return new Response(
        JSON.stringify({ error: "Failed to update withdrawal status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Only process immediately for instant withdrawals
    if (correctWithdrawalType === "instant") {
      try {
        // Validate SafeHaven credentials
        if (!safeHavenClientId || !safeHavenClientAssertion) {
          throw new Error("SafeHaven credentials not configured")
        }

        // Determine account details based on account type
        let accountDetails = ""
        let bankCode = ""
        let accountName = ""
        let accountNumber = ""
        let bankName = ""
        let payoutAccount: any = null
        
        if (withdrawal.payout_account_id && withdrawal.payout_accounts) {
          payoutAccount = withdrawal.payout_accounts
          bankCode = payoutAccount.bank_code || ""
          accountName = payoutAccount.account_name
          accountNumber = payoutAccount.account_number
          bankName = payoutAccount.bank_name
          accountDetails = `${bankName} ${accountNumber}`
        } else if (withdrawal.bank_account_id && withdrawal.bank_accounts) {
          payoutAccount = withdrawal.bank_accounts
          bankCode = payoutAccount.bank_code || ""
          accountName = payoutAccount.account_name
          accountNumber = payoutAccount.account_number
          bankName = payoutAccount.bank_name
          accountDetails = `${bankName} ${accountNumber}`
        } else {
          throw new Error("No valid bank account found for this withdrawal")
        }

        // Validate that we have all required account details
        if (!accountName || !accountNumber || !bankName) {
          throw new Error("Incomplete bank account information. Please update your account details.")
        }

        // Get SafeHaven token
        const { data: safeHavenToken, error: tokenError } = await supabase
          .from("safehaven_tokens")
          .select("access_token, expires_at, refresh_token")
          .eq("user_id", userId)
          .single();

        if (tokenError || !safeHavenToken) {
          throw new Error("SafeHaven token not found. User needs to authenticate with SafeHaven first.");
        }

        // Check if token needs refresh
        const expiresAt = new Date(safeHavenToken.expires_at);
        const now = new Date();
        const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        const needsRefresh = isNaN(expiresAt.getTime()) || (expiresAt.getTime() - now.getTime() < bufferTime);
        
        let accessToken = safeHavenToken.access_token;
        
        if (needsRefresh) {
          console.log("SafeHaven token expired or expiring soon, attempting refresh...");
          accessToken = await refreshOrCreateSafeHavenToken(userId, safeHavenToken, supabase);
        }

        // Process the transfer via SafeHaven
        const transferResult = await initiateSafeHavenEmergencyTransfer(
          withdrawal,
          payoutAccount,
          accessToken,
          netAmount,
          plan.name
        );

        // Update withdrawal status to completed
        const { error: completeError } = await supabase
          .from("emergency_withdrawals")
          .update({ 
            status: "completed",
            transfer_code: transferResult.reference || transferResult.paymentReference,
            transferred_at: new Date().toISOString(),
            metadata: {
              safehaven_transfer_id: transferResult.id || transferResult._id,
              safehaven_reference: transferResult.reference || transferResult.paymentReference,
              session_id: transferResult.sessionId
            }
          })
          .eq("id", emergencyWithdrawalId)

        if (completeError) {
          console.error("Error updating withdrawal to completed:", completeError)
        }

      // Reduce both balance and locked_balance since money is being withdrawn from the system
      const { error: reduceError } = await supabase.rpc("transfer_funds", {
        arg_user_id: userId,
        arg_amount: withdrawal.withdrawal_amount
      })

      if (reduceError) {
        console.error("Error reducing wallet balance:", reduceError)
        throw new Error(`Failed to reduce wallet balance: ${reduceError.message}`)
      }

      // Create transaction record for emergency withdrawal
      const { error: txCreateError } = await supabase.rpc('create_transaction_record', {
        p_user_id: userId,
        p_type: 'withdrawal',
        p_amount: netAmount,
        p_status: 'completed',
        p_source: 'Wallet',
        p_destination: 'Bank Transfer',
        p_reference: withdrawal.reference,
        p_payout_plan_id: withdrawal.payout_plan_id,
        p_description: 'Emergency withdrawal transfer',
        p_metadata: {
          safehaven_transfer_id: transferResult.id || transferResult._id,
          transfer_code: transferResult.reference || transferResult.paymentReference,
          session_id: transferResult.sessionId,
          emergency_withdrawal_id: withdrawal.id,
          withdrawal_type: correctWithdrawalType,
          fee_percentage: feePercentage,
          fee_amount: feeAmount
        }
      })

      if (txCreateError) {
        console.error("Error creating transaction record:", txCreateError)
      }

      // Update the payout plan status to cancelled after successful emergency withdrawal
      const { error: planUpdateError } = await supabase
        .from("payout_plans")
        .update({ 
          status: "cancelled",
          updated_at: new Date().toISOString()
        })
        .eq("id", withdrawal.payout_plan_id)

      if (planUpdateError) {
        console.error("Error updating plan status to cancelled:", planUpdateError)
        // Don't throw error here as the withdrawal was successful
      } else {
        console.log(`Successfully updated plan ${withdrawal.payout_plan_id} status to cancelled`)
      }

      // Create success notification (both event and notification for immediate alert)
      const eventResult = await supabase
        .from("events")
        .insert({
          user_id: userId,
          type: "payout_completed",
          title: "Emergency Withdrawal Completed",
          description: `Your emergency withdrawal of ₦${netAmount.toLocaleString()} has been processed successfully. Fee charged: ₦${feeAmount.toLocaleString()} (${feePercentage}%).`,
          status: "unread"
        })
        .select()
        .single();

      // Also create notification directly to ensure immediate alert
      if (eventResult.data) {
        await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: "Emergency Withdrawal Completed",
            message: `Your emergency withdrawal of ₦${netAmount.toLocaleString()} has been processed successfully. Fee charged: ₦${feeAmount.toLocaleString()} (${feePercentage}%).`,
            type: "payout",
            data: {
              eventId: eventResult.data.id,
              eventType: "payout_completed",
              route: "/all-payouts",
              payoutPlanId: withdrawal.payout_plan_id,
            },
            is_read: false
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Emergency withdrawal processed successfully",
          data: {
            transfer_code: transferResult.reference || transferResult.paymentReference,
            transfer_id: transferResult.id || transferResult._id,
            session_id: transferResult.sessionId,
            reference: withdrawal.reference,
            withdrawal_type: correctWithdrawalType,
            fee_percentage: feePercentage,
            fee_amount: feeAmount,
            net_amount: netAmount,
            remaining_amount: remainingAmount,
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

      // Create transaction record for failed emergency withdrawal
      await supabase.rpc('create_transaction_record', {
        p_user_id: userId,
        p_type: 'withdrawal',
        p_amount: withdrawal.withdrawal_amount,
        p_status: 'failed',
        p_source: 'Wallet',
        p_destination: 'Bank Transfer',
        p_reference: withdrawal.reference,
        p_payout_plan_id: withdrawal.payout_plan_id,
        p_description: 'Emergency withdrawal transfer (failed)',
        p_metadata: {
          emergency_withdrawal_id: withdrawal.id,
          error_message: error.message
        }
      })

      // Create failure notification (both event and notification for immediate alert)
      const failureEventResult = await supabase
        .from("events")
        .insert({
          user_id: userId,
          type: "disbursement_failed",
          title: "Emergency Withdrawal Failed",
          description: `Your emergency withdrawal request failed: ${error.message}`,
          status: "unread"
        })
        .select()
        .single();

      // Also create notification directly to ensure immediate alert
      if (failureEventResult.data) {
        await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: "Emergency Withdrawal Failed",
            message: `Your emergency withdrawal request failed: ${error.message}`,
            type: "payout",
            data: {
              eventId: failureEventResult.data.id,
              eventType: "disbursement_failed",
              route: "/all-payouts",
            },
            is_read: false
          });
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to process emergency withdrawal",
          details: error.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
      }
    } else {
      // For scheduled withdrawals (24hrs, 72hrs), just return success without processing
      const processingTimeText = correctWithdrawalType === "24hrs" ? "within 24 hours" : "within 72 hours"
      
      // Create notification for scheduled withdrawal (both event and notification for immediate alert)
      const scheduledEventResult = await supabase
        .from("events")
        .insert({
          user_id: userId,
          type: "withdrawal_scheduled",
          title: "Emergency Withdrawal Scheduled",
          description: `Your emergency withdrawal of ₦${netAmount.toLocaleString()} has been scheduled for processing ${processingTimeText}.`,
          status: "unread"
        })
        .select()
        .single();

      // Also create notification directly to ensure immediate alert
      if (scheduledEventResult.data) {
        await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: "Emergency Withdrawal Scheduled",
            message: `Your emergency withdrawal of ₦${netAmount.toLocaleString()} has been scheduled for processing ${processingTimeText}.`,
            type: "payout",
            data: {
              eventId: scheduledEventResult.data.id,
              eventType: "withdrawal_scheduled",
              route: "/all-payouts",
              payoutPlanId: withdrawal.payout_plan_id,
            },
            is_read: false
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Emergency withdrawal scheduled for processing ${processingTimeText}`,
          data: {
            withdrawal_type: correctWithdrawalType,
            fee_percentage: feePercentage,
            fee_amount: feeAmount,
            net_amount: netAmount,
            remaining_amount: remainingAmount,
            status: "scheduled",
            scheduled_processing_time: scheduledProcessingTime.toISOString(),
            processing_time_text: processingTimeText
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

/**
 * Refresh or create SafeHaven token
 */
async function refreshOrCreateSafeHavenToken(userId: string, safeHavenToken: any, supabase: any): Promise<string> {
  let tokenData: any = null;
  let tokenUpdated = false;
  
  // Try to refresh the token first
  if (safeHavenToken.refresh_token) {
    try {
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
      });

      if (refreshResponse.ok) {
        tokenData = await refreshResponse.json();
        
        if (tokenData.access_token) {
          tokenUpdated = true;
          console.log("✅ Successfully refreshed SafeHaven token");
        }
      } else {
        console.log("⚠️ Token refresh failed, will create new token");
      }
    } catch (refreshError) {
      console.log("⚠️ Token refresh error, will create new token:", refreshError);
    }
  }
  
  // If refresh failed or no refresh token, create a new token using client_credentials
  if (!tokenUpdated) {
    console.log("Creating new SafeHaven access token using client_credentials...");
    
    try {
      const newTokenResponse = await fetch(`${safeHavenApiUrl}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: safeHavenClientAssertion,
          client_id: safeHavenClientId
        })
      });

      if (!newTokenResponse.ok) {
        const errorText = await newTokenResponse.text();
        throw new Error(`Failed to create new SafeHaven token: ${newTokenResponse.status} ${newTokenResponse.statusText} - ${errorText}`);
      }

      tokenData = await newTokenResponse.json();
      
      if (!tokenData.access_token) {
        throw new Error("Failed to create new SafeHaven token: No access token in response");
      }
      
      console.log("✅ Successfully created new SafeHaven token");
    } catch (newTokenError) {
      throw new Error(`Failed to create new SafeHaven token: ${newTokenError.message}`);
    }
  }
  
  // Calculate expiration time with fallback
  const expiresIn = tokenData.expires_in && typeof tokenData.expires_in === 'number' 
    ? tokenData.expires_in 
    : 3600; // Default to 1 hour
  
  const currentTimestamp = Date.now();
  const expiresAtTimestamp = currentTimestamp + (expiresIn * 1000);
  const expiresAtDate = new Date(expiresAtTimestamp);
  
  // Validate the date is valid
  if (isNaN(expiresAtDate.getTime())) {
    throw new Error(`Failed to calculate token expiration date. expiresIn: ${expiresIn}, timestamp: ${expiresAtTimestamp}`);
  }
  
  const currentDate = new Date();
  if (isNaN(currentDate.getTime())) {
    throw new Error("Failed to get current date");
  }
  
  // Update token in database
  const { error: updateError } = await supabase
    .from("safehaven_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || safeHavenToken.refresh_token || null,
      expires_at: expiresAtDate.toISOString(),
      updated_at: currentDate.toISOString()
    })
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`Failed to update SafeHaven token in database: ${updateError.message}`);
  }

  return tokenData.access_token;
}

/**
 * Fetch list of banks from SafeHaven API
 */
async function fetchSafeHavenBanks(accessToken: string) {
  console.log("Fetching SafeHaven banks list...");
  const banksResponse = await fetch(`${safeHavenApiUrl}/transfers/banks`, {
    method: "GET",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json"
    }
  });

  if (!banksResponse.ok) {
    const errorText = await banksResponse.text();
    throw new Error(`Failed to fetch SafeHaven banks: ${banksResponse.status} ${banksResponse.statusText} - ${errorText}`);
  }

  const banksData = await banksResponse.json();
  
  if (banksData.statusCode !== 200 || banksData.responseCode !== "00") {
    throw new Error(`Failed to fetch SafeHaven banks: ${banksData.message || "Unknown error"}`);
  }

  return banksData.data || [];
}

/**
 * Find SafeHaven bank code by matching bank name
 */
function findSafeHavenBankCode(bankName: string, safeHavenBanks: any[]): string | null {
  if (!bankName || !safeHavenBanks || safeHavenBanks.length === 0) {
    return null;
  }

  // Normalize bank name for comparison
  const normalizedBankName = bankName.toUpperCase().trim().replace(/\s+/g, " ");

  // First, try exact match
  for (const bank of safeHavenBanks) {
    const bankNameNormalized = bank.name?.toUpperCase().trim();
    if (bankNameNormalized === normalizedBankName) {
      console.log(`✅ Found exact bank match: ${bank.name} -> ${bank.bankCode}`);
      return bank.bankCode;
    }
  }

  // Then, try matching with aliases
  for (const bank of safeHavenBanks) {
    if (bank.alias && Array.isArray(bank.alias)) {
      for (const alias of bank.alias) {
        const aliasNormalized = alias.toUpperCase().trim();
        if (aliasNormalized === normalizedBankName) {
          console.log(`✅ Found bank match via alias: ${bank.name} (${alias}) -> ${bank.bankCode}`);
          return bank.bankCode;
        }
      }
    }
  }

  // Finally, try partial match (contains)
  for (const bank of safeHavenBanks) {
    const bankNameNormalized = bank.name?.toUpperCase().trim();
    if (bankNameNormalized && normalizedBankName.includes(bankNameNormalized)) {
      console.log(`✅ Found partial bank match: ${bank.name} -> ${bank.bankCode}`);
      return bank.bankCode;
    }
    
    // Check aliases for partial match
    if (bank.alias && Array.isArray(bank.alias)) {
      for (const alias of bank.alias) {
        const aliasNormalized = alias.toUpperCase().trim();
        if (normalizedBankName.includes(aliasNormalized) || aliasNormalized.includes(normalizedBankName)) {
          console.log(`✅ Found partial bank match via alias: ${bank.name} (${alias}) -> ${bank.bankCode}`);
          return bank.bankCode;
        }
      }
    }
  }

  console.log(`⚠️ Could not find SafeHaven bank code for: ${bankName}`);
  return null;
}

/**
 * Initiate SafeHaven transfer for emergency withdrawal
 */
async function initiateSafeHavenEmergencyTransfer(
  withdrawal: any,
  payoutAccount: any,
  accessToken: string,
  netAmount: number,
  planName: string
) {
  const transferReference = withdrawal.reference || `EMERGENCY_${withdrawal.id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  console.log("Processing SafeHaven emergency withdrawal transfer:", {
    fromAccount: "0117753301",
    toAccount: payoutAccount.account_number,
    amount: netAmount,
    storedBankCode: payoutAccount.bank_code,
    bankName: payoutAccount.bank_name
  });

  // Step 0: Fetch SafeHaven banks list and find correct bank code
  console.log("Fetching SafeHaven banks to find correct bank code...");
  const safeHavenBanks = await fetchSafeHavenBanks(accessToken);
  
  // Find the correct bank code by matching bank name
  let correctBankCode = payoutAccount.bank_code; // Fallback to stored bank code
  if (payoutAccount.bank_name) {
    const foundBankCode = findSafeHavenBankCode(payoutAccount.bank_name, safeHavenBanks);
    if (foundBankCode) {
      correctBankCode = foundBankCode;
      console.log(`✅ Using SafeHaven bank code: ${correctBankCode} (matched from bank name: ${payoutAccount.bank_name})`);
    } else {
      console.log(`⚠️ Could not match bank name "${payoutAccount.bank_name}", using stored bank code: ${correctBankCode}`);
    }
  } else {
    console.log(`⚠️ No bank name available, using stored bank code: ${correctBankCode}`);
  }

  // Step 1: Perform name enquiry first
  console.log("Performing name enquiry...");
  const nameEnquiryResponse = await fetch(`${safeHavenApiUrl}/transfers/name-enquiry`, {
    method: "POST",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bankCode: correctBankCode,
      accountNumber: payoutAccount.account_number
    })
  });

  const nameEnquiryData = await nameEnquiryResponse.json();
  
  if (!nameEnquiryResponse.ok) {
    const errorMessage = nameEnquiryData.message || nameEnquiryData.error || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`);
  }

  // Check if response indicates success
  if (nameEnquiryData.statusCode !== 200 || nameEnquiryData.responseCode !== "00") {
    const errorMessage = nameEnquiryData.message || nameEnquiryData.data?.responseMessage || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${errorMessage}`);
  }

  const nameEnquiryReference = nameEnquiryData.data?.sessionId || nameEnquiryData.sessionId;
  if (!nameEnquiryReference) {
    throw new Error("Name enquiry did not return sessionId");
  }

  console.log("Name enquiry successful, sessionId:", nameEnquiryReference);
  console.log("Account details:", {
    accountName: nameEnquiryData.data?.accountName,
    accountNumber: nameEnquiryData.data?.accountNumber,
    bankCode: nameEnquiryData.data?.bankCode
  });

  // Step 2: Initiate SafeHaven transfer with nameEnquiryReference
  console.log(`💸 Initiating emergency withdrawal transfer of ₦${netAmount} to ${payoutAccount.account_number}`);
  const transferResponse = await fetch(`${safeHavenApiUrl}/transfers`, {
    method: "POST",
    headers: {
      "ClientID": safeHavenClientId,
      "Authorization": `Bearer ${accessToken}`,
      "accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      saveBeneficiary: true,
      amount: netAmount,
      beneficiaryAccountNumber: payoutAccount.account_number,
      beneficiaryBankCode: correctBankCode,
      debitAccountNumber: "0117753301",
      nameEnquiryReference: nameEnquiryReference,
      narration: `Emergency withdrawal: ${planName}`,
      paymentReference: transferReference
    })
  });

  const transferData = await transferResponse.json();
  
  if (!transferResponse.ok) {
    const errorMessage = transferData.message || transferData.error || 'Unknown transfer error';
    throw new Error(`SafeHaven transfer failed: ${errorMessage}`);
  }

  // Extract transfer details from response
  const transferResult = transferData.data || transferData;
  const transferId = transferResult._id || transferResult.id;
  const paymentReference = transferResult.paymentReference || transferReference;
  const sessionId = transferResult.sessionId || transferResult.session_id;

  console.log("SafeHaven transfer initiated:", {
    transferId,
    paymentReference,
    status: transferResult.status || "Pending"
  });

  return {
    id: transferId,
    _id: transferId,
    reference: paymentReference,
    paymentReference: paymentReference,
    transfer_code: paymentReference,
    sessionId: sessionId,
    status: transferResult.status || "Pending"
  };
}