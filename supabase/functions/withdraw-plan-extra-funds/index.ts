import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

type BankTableName = "payout_accounts" | "bank_accounts";

interface BankCodeResolution {
  safehavenCode: string | null;
  paystackCode: string | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    const { planId, amount, accountId } = await req.json()

    if (!planId || !amount || !accountId) {
      return new Response(
        JSON.stringify({ error: "planId, amount, and accountId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get payout account
    const { data: payoutAccount, error: accountError } = await supabase
      .from("payout_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single()

    if (accountError || !payoutAccount) {
      return new Response(
        JSON.stringify({ error: "Payout account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("expense_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", userId)
      .single()

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: "Plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate SafeHaven credentials
    if (!safeHavenClientId || !safeHavenClientAssertion) {
      return new Response(
        JSON.stringify({ error: "SafeHaven credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Resolve bank codes
    const { safehavenCode } = await resolveBankCodes(supabase, payoutAccount, "payout_accounts", accountId)

    if (!safehavenCode) {
      return new Response(
        JSON.stringify({ error: "SafeHaven bank code not found for transfer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get SafeHaven token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("safehaven_tokens")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", userId)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: "SafeHaven token not found. User needs to authenticate with SafeHaven first." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const expiresAt = new Date(tokenRecord.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000;
    const needsRefresh = isNaN(expiresAt.getTime()) || expiresAt.getTime() - now.getTime() < bufferTime;

    let accessToken = tokenRecord.access_token;

    if (needsRefresh) {
      console.log("SafeHaven token expired or expiring soon, attempting refresh...");
      accessToken = await refreshOrCreateSafeHavenToken(userId, tokenRecord, supabase);
    }

    // Call RPC function to update database
    const { data: dbResult, error: dbError } = await supabase.rpc("withdraw_plan_extra_funds", {
      arg_plan_id: planId,
      arg_amount: amount,
      arg_account_id: accountId,
    })

    if (dbError || !dbResult?.success) {
      return new Response(
        JSON.stringify({ error: dbResult?.error || dbError?.message || "Failed to process withdrawal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Initiate SafeHaven transfer
    const transferResult = await initiateSafeHavenTransfer(
      plan,
      payoutAccount,
      accessToken,
      amount,
      safehavenCode,
      dbResult.reference,
      userId,
      supabase
    )

    // Create main transaction record
    const { error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "withdrawal",
        amount: amount,
        status: "completed",
        source: `Expense Plan: ${plan.name}`,
        destination: `${payoutAccount.bank_name} ••••${payoutAccount.account_number.slice(-4)}`,
        description: `Withdrawal of extra funds from ${plan.name}`,
        reference: dbResult.reference,
        metadata: {
          plan_id: planId,
          plan_transaction_id: dbResult.plan_transaction_id,
          transfer_code: transferResult.transfer_code || transferResult.reference,
          provider: "safehaven"
        }
      })

    if (txError) {
      console.error("Error creating transaction record:", txError)
    }

    // Create event notification
    const { error: eventError } = await supabase
      .from("events")
      .insert({
        user_id: userId,
        type: "payout_completed",
        title: "Extra Funds Withdrawn",
        message: `₦${amount.toLocaleString()} withdrawn from ${plan.name} to ${payoutAccount.bank_name}`,
        metadata: {
          plan_id: planId,
          plan_transaction_id: dbResult.plan_transaction_id,
          transaction_id: null,
          amount: amount
        }
      })

    if (eventError) {
      console.error("Error creating event:", eventError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Withdrawal processed successfully",
        transfer_code: transferResult.transfer_code || transferResult.reference,
        reference: dbResult.reference
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error("Error processing withdrawal:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

async function resolveBankCodes(
  supabaseClient: any,
  payoutAccount: any,
  tableName: BankTableName,
  accountId: string | null
): Promise<BankCodeResolution> {
  let safehavenCode: string | null = null

  // Try to get SafeHaven bank code from payout account
  if (payoutAccount.safehaven_bank_code) {
    safehavenCode = payoutAccount.safehaven_bank_code
  } else {
    // Try to get from bank_comparison table
    const { data: bankComparison } = await supabaseClient
      .from("bank_comparison")
      .select("safehaven_code")
      .eq("bank_name", payoutAccount.bank_name)
      .single()

    if (bankComparison?.safehaven_code) {
      safehavenCode = bankComparison.safehaven_code
      
      // Update payout account with SafeHaven bank code
      if (tableName && accountId) {
        await supabaseClient
          .from(tableName)
          .update({ safehaven_bank_code: safehavenCode })
          .eq("id", accountId)
          .catch(() => null)
      }
    }
  }

  return { safehavenCode, paystackCode: null }
}

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

  // Update token in database
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

  await supabase
    .from("safehaven_tokens")
    .upsert({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || safeHavenToken.refresh_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: "user_id"
    });

  return tokenData.access_token;
}

async function initiateSafeHavenTransfer(
  plan: any,
  payoutAccount: any,
  accessToken: string,
  amount: number,
  safehavenCode: string,
  reference: string,
  userId: string,
  supabaseClient: any
): Promise<any> {
  console.log("Processing SafeHaven plan extra funds withdrawal transfer:", {
    fromAccount: "0117753301",
    toAccount: payoutAccount.account_number,
    amount: amount,
    safehavenBankCode: safehavenCode,
    bankName: payoutAccount.bank_name
  });

  if (!safehavenCode) {
    throw new Error(`SafeHaven bank code is required. Please update the payout account with safehaven_bank_code.`);
  }

  console.log(`✅ Using SafeHaven bank code: ${safehavenCode}`);

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
      bankCode: safehavenCode,
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

  // Step 2: Initiate SafeHaven transfer with nameEnquiryReference
  console.log(`💸 Initiating plan extra funds withdrawal transfer of ₦${amount} to ${payoutAccount.account_number}`);
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
      amount: amount,
      beneficiaryAccountNumber: payoutAccount.account_number,
      beneficiaryBankCode: safehavenCode,
      debitAccountNumber: "0117753301",
      nameEnquiryReference: nameEnquiryReference,
      narration: `Withdrawal of extra funds from ${plan.name}`,
      paymentReference: reference
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
  const paymentReference = transferResult.paymentReference || reference;
  const sessionId = transferResult.sessionId || transferResult.session_id;

  console.log("SafeHaven transfer initiated:", {
    transferId,
    paymentReference,
    status: transferResult.status || "Pending"
  });

  return {
    provider: "safehaven",
    id: transferId,
    _id: transferId,
    reference: paymentReference,
    paymentReference: paymentReference,
    transfer_code: paymentReference,
    sessionId: sessionId,
    status: transferResult.status || "Pending",
    rawResponse: transferData
  };
}

