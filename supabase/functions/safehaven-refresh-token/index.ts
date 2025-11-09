/**
 * SafeHaven Refresh Token Edge Function
 * 
 * This function handles SafeHaven API token refresh with comprehensive audit logging
 * to ensure full traceability of all SafeHaven API operations.
 * 
 * Features:
 * - Secure token refresh with audit logging
 * - Comprehensive request/response tracking
 * - User authentication and authorization
 * - Error handling with audit trails
 * - Performance monitoring
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SafeHaven API configuration
const SAFEHAVEN_API_URL = 'https://api.safehavenmfb.com';
const SAFEHAVEN_CLIENT_ID = Deno.env.get('SAFEHAVEN_CLIENT_ID')!;
const SAFEHAVEN_CLIENT_ASSERTION = Deno.env.get('SAFEHAVEN_CLIENT_ASSERTION')!;

interface SafeHavenRefreshTokenRequest {
  grant_type: string;
  client_assertion_type: string;
  client_assertion: string;
  client_id: string;
  refresh_token: string;
}

interface SafeHavenTokenResponse {
  access_token: string;
  client_id: string;
  token_type: string;
  expires_in: number;
  ibs_client_id: string;
  ibs_user_id: string;
}

interface SafeHavenAccount {
  canDebit: boolean;
  canCredit: boolean;
  _id: string;
  client: string;
  accountProduct: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  currencyCode: string;
  bvn: string;
  accountBalance: number;
  bookBalance: number;
  interestBalance: number;
  withHoldingTaxBalance: number;
  status: string;
  isDefault: boolean;
  nominalAnnualInterestRate: number;
  interestCompoundingPeriod: string;
  interestPostingPeriod: string;
  interestCalculationType: string;
  interestCalculationDaysInYearType: string;
  minRequiredOpeningBalance: number;
  lockinPeriodFrequency: number;
  lockinPeriodFrequencyType: string;
  allowOverdraft: boolean;
  overdraftLimit: number;
  chargeWithHoldingTax: boolean;
  chargeValueAddedTax: boolean;
  chargeStampDuty: boolean;
  notificationSettings: {
    smsNotification: boolean;
    emailNotification: boolean;
    emailMonthlyStatement: boolean;
    smsMonthlyStatement: boolean;
  };
  isSubAccount: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
  cbaAccountId: string;
}

interface SafeHavenAccountsResponse {
  statusCode: number;
  message: string;
  data: SafeHavenAccount[];
}

// Helper function to create JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Verify user authentication
async function verifyAuth(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Create audit log entry
async function createAuditLog(
  userId: string,
  operationType: string,
  requestData: any,
  responseData: any,
  status: string,
  errorMessage?: string,
  metadata?: any
) {
  try {
    const { error } = await supabase.rpc('create_kyc_audit_log', {
      p_user_id: userId,
      p_operation_type: operationType,
      p_verification_type: 'safehaven_api',
      p_verification_provider: 'safehaven',
      p_request_data: requestData,
      p_response_data: responseData,
      p_status: status,
      p_result_code: status === 'success' ? 'SUCCESS' : 'ERROR',
      p_result_message: errorMessage || 'SafeHaven API operation completed',
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown',
      p_metadata: {
        ...metadata,
        endpoint: 'SafeHaven API',
        timestamp: new Date().toISOString(),
        function: 'safehaven-refresh-token'
      }
    });

    if (error) {
      console.error('Error creating audit log:', error);
    }
  } catch (error) {
    console.error('Error in audit logging:', error);
  }
}

// Refresh SafeHaven access token
async function refreshSafeHavenToken(refreshToken: string): Promise<SafeHavenTokenResponse> {
  const requestData: SafeHavenRefreshTokenRequest = {
    grant_type: 'refresh_token',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: SAFEHAVEN_CLIENT_ASSERTION,
    client_id: SAFEHAVEN_CLIENT_ID,
    refresh_token: refreshToken
  };

  const response = await fetch(`${SAFEHAVEN_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SafeHaven token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

// Get SafeHaven accounts
async function getSafeHavenAccounts(accessToken: string): Promise<SafeHavenAccountsResponse> {
  const response = await fetch(`${SAFEHAVEN_API_URL}/accounts/`, {
    method: 'GET',
    headers: {
      'ClientID': SAFEHAVEN_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SafeHaven accounts fetch failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

// Store SafeHaven token in database
async function storeSafeHavenToken(
  userId: string,
  tokenData: SafeHavenTokenResponse,
  refreshToken: string
) {
  try {
    // Check if user already has SafeHaven token data
    const { data: existingToken, error: fetchError } = await supabase
      .from('safehaven_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    const tokenRecord = {
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: refreshToken,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      ibs_client_id: tokenData.ibs_client_id,
      ibs_user_id: tokenData.ibs_user_id,
      client_id: tokenData.client_id,
      updated_at: new Date().toISOString()
    };

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from('safehaven_tokens')
        .update(tokenRecord)
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }
    } else {
      // Insert new token
      const { error: insertError } = await supabase
        .from('safehaven_tokens')
        .insert({
          ...tokenRecord,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }
    }
  } catch (error) {
    console.error('Error storing SafeHaven token:', error);
    throw error;
  }
}

// Store SafeHaven accounts in database
async function storeSafeHavenAccounts(
  userId: string,
  accounts: SafeHavenAccount[]
) {
  try {
    // Delete existing accounts for this user
    await supabase
      .from('safehaven_accounts')
      .delete()
      .eq('user_id', userId);

    // Insert new accounts
    const accountRecords = accounts.map(account => ({
      user_id: userId,
      safehaven_account_id: account._id,
      client_id: account.client,
      account_product: account.accountProduct,
      account_number: account.accountNumber,
      account_name: account.accountName,
      account_type: account.accountType,
      currency_code: account.currencyCode,
      bvn: account.bvn,
      account_balance: account.accountBalance,
      book_balance: account.bookBalance,
      interest_balance: account.interestBalance,
      withholding_tax_balance: account.withHoldingTaxBalance,
      status: account.status,
      is_default: account.isDefault,
      can_debit: account.canDebit,
      can_credit: account.canCredit,
      nominal_annual_interest_rate: account.nominalAnnualInterestRate,
      interest_compounding_period: account.interestCompoundingPeriod,
      interest_posting_period: account.interestPostingPeriod,
      interest_calculation_type: account.interestCalculationType,
      interest_calculation_days_in_year_type: account.interestCalculationDaysInYearType,
      min_required_opening_balance: account.minRequiredOpeningBalance,
      lockin_period_frequency: account.lockinPeriodFrequency,
      lockin_period_frequency_type: account.lockinPeriodFrequencyType,
      allow_overdraft: account.allowOverdraft,
      overdraft_limit: account.overdraftLimit,
      charge_withholding_tax: account.chargeWithHoldingTax,
      charge_value_added_tax: account.chargeValueAddedTax,
      charge_stamp_duty: account.chargeStampDuty,
      notification_settings: account.notificationSettings,
      is_sub_account: account.isSubAccount,
      is_deleted: account.isDeleted,
      cba_account_id: account.cbaAccountId,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
      synced_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('safehaven_accounts')
      .insert(accountRecords);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error storing SafeHaven accounts:', error);
    throw error;
  }
}

// Main function handler
serve(async (req) => {
  const startTime = Date.now();
  let auditLogId: string | null = null;
  let user: any = null;

  try {
    // Verify authentication
    user = await verifyAuth(req);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Check if required environment variables are available
    if (!SAFEHAVEN_CLIENT_ID || !SAFEHAVEN_CLIENT_ASSERTION) {
      console.error('SafeHaven API credentials not configured');
      return createJsonResponse({ 
        error: 'SafeHaven service not properly configured. Please contact support.',
        details: 'Missing SafeHaven API credentials'
      }, 500);
    }

    // Parse request body
    const { refresh_token, fetch_accounts = true } = await req.json();

    if (!refresh_token) {
      return createJsonResponse({ 
        error: 'refresh_token is required' 
      }, 400);
    }

    // Create initial audit log
    await createAuditLog(
      user.id,
      'safehaven_token_refresh_initiated',
      {
        hasRefreshToken: !!refresh_token,
        fetchAccounts: fetch_accounts,
        clientId: SAFEHAVEN_CLIENT_ID
      },
      null,
      'pending',
      undefined,
      {
        operation: 'token_refresh',
        timestamp: new Date().toISOString()
      }
    );

    // Refresh the token
    console.log('Refreshing SafeHaven token...');
    const tokenData = await refreshSafeHavenToken(refresh_token);
    
    // Store the token in database
    await storeSafeHavenToken(user.id, tokenData, refresh_token);

    let accountsData = null;
    if (fetch_accounts) {
      // Fetch accounts using the new access token
      console.log('Fetching SafeHaven accounts...');
      const accountsResponse = await getSafeHavenAccounts(tokenData.access_token);
      accountsData = accountsResponse.data;

      // Store accounts in database
      await storeSafeHavenAccounts(user.id, accountsResponse.data);
    }

    // Create success audit log
    await createAuditLog(
      user.id,
      'safehaven_token_refresh_success',
      {
        hasRefreshToken: !!refresh_token,
        fetchAccounts: fetch_accounts,
        clientId: SAFEHAVEN_CLIENT_ID
      },
      {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        ibsClientId: tokenData.ibs_client_id,
        ibsUserId: tokenData.ibs_user_id,
        accountsCount: accountsData ? accountsData.length : 0
      },
      'success',
      'SafeHaven token refreshed successfully',
      {
        operation: 'token_refresh',
        responseTime: Date.now() - startTime,
        accountsFetched: fetch_accounts
      }
    );

    // Return success response
    return createJsonResponse({
      status: 'success',
      message: 'SafeHaven token refreshed successfully',
      data: {
        token: {
          access_token: tokenData.access_token,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          ibs_client_id: tokenData.ibs_client_id,
          ibs_user_id: tokenData.ibs_user_id
        },
        accounts: accountsData ? accountsData.map(account => ({
          id: account._id,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
          accountType: account.accountType,
          currencyCode: account.currencyCode,
          accountBalance: account.accountBalance,
          bookBalance: account.bookBalance,
          status: account.status,
          isDefault: account.isDefault,
          canDebit: account.canDebit,
          canCredit: account.canCredit
        })) : null
      },
      meta: {
        userId: user.id,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in SafeHaven refresh token function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Create error audit log
    if (user) {
      await createAuditLog(
        user.id,
        'safehaven_token_refresh_failed',
        {
          error: errorMessage,
          timestamp: new Date().toISOString()
        },
        null,
        'failed',
        errorMessage,
        {
          operation: 'token_refresh',
          responseTime: Date.now() - startTime
        }
      );
    }

    return createJsonResponse({ 
      error: 'Internal server error during SafeHaven token refresh',
      details: errorMessage,
      meta: {
        userId: user?.id || 'unknown',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    }, 500);
  }
});
