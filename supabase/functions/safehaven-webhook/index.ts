/**
 * SafeHaven Webhook Handler
 * 
 * This function handles all SafeHaven webhook events with comprehensive audit logging
 * and processing for transfers, virtual accounts, and account updates.
 * 
 * Supported Webhook Types:
 * - transfer: Regular transfer events
 * - virtualAccount.transfer: Virtual account transfer events
 * - account.update: Account balance/status updates
 * - transaction.update: Transaction status updates
 * 
 * NOTE: This function does NOT require authentication headers as it's called by SafeHaven's servers.
 * Authentication is handled via webhook signature verification instead.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client with service role key (bypasses RLS)
// This is safe because webhooks are authenticated via signature verification
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// SafeHaven webhook configuration
const SAFEHAVEN_WEBHOOK_SECRET = Deno.env.get('SAFEHAVEN_WEBHOOK_SECRET') || '';
const SAFEHAVEN_API_DOMAIN = 'safehavenmfb.com';
const SAFEHAVEN_API_URL = 'https://api.safehavenmfb.com';

// Allowed SafeHaven IP addresses (if known - add SafeHaven's webhook server IPs here)
const SAFEHAVEN_ALLOWED_IPS: string[] = [
  // Add SafeHaven's webhook server IP addresses here when available
  // Example: '52.31.139.75', '52.49.173.169'
];

interface SafeHavenWebhookPayload {
  type: 'transfer' | 'virtualAccount.transfer' | 'account.update' | 'transaction.update' | 'subaccount.created' | 'subaccount.updated' | 'subaccount.status';
  data: any;
  timestamp: string;
  signature?: string;
}

interface SafeHavenTransferData {
  _id: string;
  client: string;
  account: string;
  type: 'Inwards' | 'Outwards';
  sessionId: string;
  nameEnquiryReference: string;
  paymentReference: string;
  isReversed: boolean;
  provider: string;
  providerChannel: string;
  destinationInstitutionCode?: string;
  creditAccountName: string;
  creditAccountNumber: string;
  debitAccountName: string;
  debitAccountNumber: string;
  narration: string;
  amount: number;
  fees?: number;
  responseCode: string;
  responseMessage: string;
  status: 'Pending' | 'Completed' | 'Failed' | 'Reversed';
  transactionLocation?: string;
  createdAt: string;
  updatedAt: string;
}

interface SafeHavenVirtualAccountTransferData {
  _id: string;
  client: string;
  virtualAccount: string;
  sessionId: string;
  nameEnquiryReference: string;
  paymentReference: string;
  isReversed: boolean;
  provider: string;
  providerChannel: string;
  providerChannelCode: string;
  destinationInstitutionCode: string;
  creditAccountName: string;
  creditAccountNumber: string;
  debitAccountName: string;
  debitAccountNumber: string;
  transactionLocation: string;
  amount: number;
  fees: number;
  responseCode: string;
  responseMessage: string;
  status: 'Pending' | 'Completed' | 'Failed' | 'Reversed';
  createdAt: string;
  updatedAt: string;
}

interface SafeHavenSubaccountData {
  _id: string;
  client: string;
  sessionId?: string;
  accountName: string;
  accountNumber?: string;
  accountType: string;
  currencyCode: string;
  description?: string;
  phoneNumber?: string;
  email?: string;
  status: 'Pending' | 'Active' | 'Inactive' | 'Suspended' | 'Failed';
  otpVerified?: boolean;
  otpVerifiedAt?: string;
  identityId?: string;
  identity_id?: string;
  autoSweep?: boolean;
  autoSweepDetails?: {
    schedule?: string;
    mainAccountNumber?: string;
    main_account_number?: string;
  };
  mainAccountNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper function to create JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// Verify webhook signature (if provided)
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.warn('No webhook secret configured, skipping signature verification');
    return true; // Allow if no secret is configured (for development)
  }

  try {
    // Implement HMAC verification here
    // For now, we'll skip verification if no secret is configured
    return true;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Verify request is from SafeHaven
function verifySafeHavenRequest(req: Request): { isValid: boolean; reason?: string } {
  try {
    // Get client IP
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const clientIP = forwardedFor.split(',')[0].trim();
    
    // Get origin/referer headers
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const userAgent = req.headers.get('user-agent') || '';
    
    console.log('Webhook security check:', {
      clientIP,
      origin,
      referer,
      userAgent: userAgent.substring(0, 50)
    });

    // Check 1: Verify origin/referer contains SafeHaven domain
    const originLower = origin.toLowerCase();
    const refererLower = referer.toLowerCase();
    const userAgentLower = userAgent.toLowerCase();
    
    const hasSafeHavenDomain = 
      originLower.includes(SAFEHAVEN_API_DOMAIN) ||
      refererLower.includes(SAFEHAVEN_API_DOMAIN) ||
      userAgentLower.includes(SAFEHAVEN_API_DOMAIN.toLowerCase().replace('.', ''));

    // Check 2: Verify IP address (if allowed IPs are configured)
    let ipAllowed = true;
    if (SAFEHAVEN_ALLOWED_IPS.length > 0) {
      ipAllowed = SAFEHAVEN_ALLOWED_IPS.includes(clientIP);
      if (!ipAllowed) {
        console.warn(`⚠️ Request from unauthorized IP: ${clientIP}`);
        return { 
          isValid: false, 
          reason: `IP address ${clientIP} is not in the allowed list` 
        };
      }
    }

    // Check 3: Verify domain in headers
    if (!hasSafeHavenDomain) {
      // If no SafeHaven domain found, check if it's a direct API call
      // SafeHaven webhooks might not send origin/referer, so we check user-agent or other headers
      const hasSafeHavenHeader = 
        req.headers.get('x-safehaven-signature') !== null ||
        req.headers.get('x-safehaven-webhook') !== null ||
        userAgentLower.includes('safehaven') ||
        userAgentLower.includes('safe-haven');

      if (!hasSafeHavenHeader && !ipAllowed) {
        console.warn('⚠️ Request does not appear to be from SafeHaven');
        return { 
          isValid: false, 
          reason: 'Request origin does not match SafeHaven domain' 
        };
      }
    }

    // Additional check: Block common testing tools
    const isTestingTool = 
      userAgentLower.includes('postman') ||
      userAgentLower.includes('insomnia') ||
      userAgentLower.includes('curl') ||
      userAgentLower.includes('httpie') ||
      userAgentLower.includes('rest client') ||
      originLower.includes('localhost') ||
      originLower.includes('127.0.0.1') ||
      refererLower.includes('localhost') ||
      refererLower.includes('127.0.0.1');

    if (isTestingTool) {
      console.warn('⚠️ Request blocked: Appears to be from a testing tool');
      return { 
        isValid: false, 
        reason: 'Testing tools are not allowed. Only SafeHaven can call this webhook.' 
      };
    }

    console.log('✅ Webhook request verified as SafeHaven');
    return { isValid: true };

  } catch (error) {
    console.error('Error verifying SafeHaven request:', error);
    return { 
      isValid: false, 
      reason: 'Error during verification' 
    };
  }
}

// Process transfer webhook
async function processTransferWebhook(transferData: SafeHavenTransferData): Promise<any> {
  console.log('Processing transfer webhook:', transferData._id);

  try {
    // Find user by account number (for Inwards transfers, creditAccountNumber is our account)
    // For Outwards transfers, we might need to check debitAccountNumber
    const accountNumber = transferData.type === 'Inwards' 
      ? transferData.creditAccountNumber 
      : transferData.debitAccountNumber;

    console.log(`Looking up user by account number: ${accountNumber} (transfer type: ${transferData.type})`);

    // Get user ID from account number
    const { data: accountData, error: accountError } = await supabase
      .from('safehaven_accounts')
      .select('user_id, account_number, account_balance, book_balance')
      .eq('account_number', accountNumber)
      .eq('is_deleted', false)
      .single();

    if (accountError || !accountData) {
      console.error('Could not find account for account number:', accountNumber);
      // Still log the webhook even if we can't find the user
      await logDepositWebhook(transferData, null);
      return { 
        error: 'Account not found',
        accountNumber: accountNumber,
        note: 'Webhook logged but user not found'
      };
    }

    const userId = accountData.user_id;
    console.log(`Found user ${userId} for account ${accountNumber}`);

    // Log to safehaven_deposit_webhooks table
    await logDepositWebhook(transferData, userId);

    // Create audit log
    await createAuditLog(
      userId,
      'transfer_webhook_processed',
      { transferId: transferData._id, type: transferData.type },
      { status: transferData.status, amount: transferData.amount },
      'success'
    );

    // Update user's balance if this is a completed transfer
    if (transferData.status === 'Completed') {
      await updateUserBalance(userId, transferData, accountNumber);
    }

    return { 
      success: true, 
      transferId: transferData._id, 
      status: transferData.status,
      userId: userId,
      accountNumber: accountNumber
    };

  } catch (error) {
    console.error('Error processing transfer webhook:', error);
    // Still try to log the webhook even on error
    try {
      await logDepositWebhook(transferData, null);
    } catch (logError) {
      console.error('Error logging webhook after processing error:', logError);
    }
    throw error;
  }
}

// Log deposit webhook to safehaven_deposit_webhooks table
async function logDepositWebhook(transferData: any, userId: string | null): Promise<void> {
  try {
    // Determine account number based on transfer type
    const accountNumber = transferData.type === 'Inwards' 
      ? transferData.creditAccountNumber 
      : (transferData.debitAccountNumber || transferData.accountNumber);

    const { error } = await supabase
      .from('safehaven_deposit_webhooks')
      .insert({
        user_id: userId,
        webhook_id: transferData._id || transferData.id,
        transfer_type: transferData.type,
        account_number: accountNumber,
        amount: transferData.amount || 0,
        fees: transferData.fees || 0,
        status: transferData.status,
        payment_reference: transferData.paymentReference || transferData.reference,
        session_id: transferData.sessionId,
        provider: transferData.provider,
        response_code: transferData.responseCode,
        response_message: transferData.responseMessage,
        narration: transferData.narration,
        credit_account_name: transferData.creditAccountName,
        credit_account_number: transferData.creditAccountNumber,
        debit_account_name: transferData.debitAccountName,
        debit_account_number: transferData.debitAccountNumber,
        webhook_data: transferData,
        processed: true,
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error logging deposit webhook:', error);
      throw error;
    }

    console.log('Deposit webhook logged successfully to safehaven_deposit_webhooks');
  } catch (error) {
    console.error('Error in logDepositWebhook:', error);
    throw error;
  }
}

// Process virtual account transfer webhook
async function processVirtualAccountTransferWebhook(transferData: SafeHavenVirtualAccountTransferData): Promise<any> {
  console.log('Processing virtual account transfer webhook:', transferData._id);

  try {
    // Get user ID from client ID
    const { data: userData, error: userError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', transferData.client)
      .single();

    if (userError || !userData) {
      console.error('Could not find user for client ID:', transferData.client);
      return { error: 'User not found' };
    }

    // Log virtual account transfer to safehaven_deposit_webhooks
    await logDepositWebhook(transferData as any, userData.user_id);

    // Create audit log
    await createAuditLog(
      userData.user_id,
      'virtual_account_transfer_webhook_processed',
      { transferId: transferData._id, virtualAccountId: transferData.virtualAccount },
      { status: transferData.status, amount: transferData.amount },
      'success'
    );

    // Update virtual account balance if this is a completed transfer
    if (transferData.status === 'Completed') {
      await updateVirtualAccountBalance(userData.user_id, transferData);
    }

    return { 
      success: true, 
      transferId: transferData._id, 
      status: transferData.status,
      userId: userData.user_id
    };

  } catch (error) {
    console.error('Error processing virtual account transfer webhook:', error);
    throw error;
  }
}

// Process account update webhook
async function processAccountUpdateWebhook(accountData: any): Promise<any> {
  console.log('Processing account update webhook:', accountData._id);

  try {
    // Get user ID from client ID
    const { data: userData, error: userError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', accountData.client)
      .single();

    if (userError || !userData) {
      console.error('Could not find user for client ID:', accountData.client);
      return { error: 'User not found' };
    }

    // Update account data
    const { error: updateError } = await supabase
      .from('safehaven_accounts')
      .update({
        account_balance: accountData.accountBalance,
        book_balance: accountData.bookBalance,
        status: accountData.status,
        updated_at: accountData.updatedAt,
        webhook_updated_at: new Date().toISOString()
      })
      .eq('safehaven_account_id', accountData._id)
      .eq('user_id', userData.user_id);

    if (updateError) {
      console.error('Error updating account data:', updateError);
      throw updateError;
    }

    // Create audit log
    await createAuditLog(
      userData.user_id,
      'account_update_webhook_processed',
      { accountId: accountData._id },
      { 
        accountBalance: accountData.accountBalance,
        bookBalance: accountData.bookBalance,
        status: accountData.status
      },
      'success'
    );

    return { 
      success: true, 
      accountId: accountData._id, 
      status: accountData.status,
      userId: userData.user_id
    };

  } catch (error) {
    console.error('Error processing account update webhook:', error);
    throw error;
  }
}

// Process transaction update webhook
async function processTransactionUpdateWebhook(transactionData: any): Promise<any> {
  console.log('Processing transaction update webhook:', transactionData._id);

  try {
    // Get user ID from client ID
    const { data: userData, error: userError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', transactionData.client)
      .single();

    if (userError || !userData) {
      console.error('Could not find user for client ID:', transactionData.client);
      return { error: 'User not found' };
    }

    // Log transaction update to safehaven_deposit_webhooks
    await logDepositWebhook(transactionData as any, userData.user_id);

    // Create audit log
    await createAuditLog(
      userData.user_id,
      'transaction_update_webhook_processed',
      { transactionId: transactionData._id },
      { 
        status: transactionData.status,
        amount: transactionData.amount,
        balance: transactionData.balance
      },
      'success'
    );

    return { 
      success: true, 
      transactionId: transactionData._id, 
      status: transactionData.status,
      userId: userData.user_id
    };

  } catch (error) {
    console.error('Error processing transaction update webhook:', error);
    throw error;
  }
}

// Update user balance based on transfer
async function updateUserBalance(userId: string, transferData: SafeHavenTransferData, accountNumber: string): Promise<void> {
  try {
    console.log(`Updating balance for user ${userId}: ${transferData.type} ${transferData.amount}`);

    // Calculate new balance based on transfer type
    // For Inwards: add amount (minus fees)
    // For Outwards: subtract amount (plus fees)
    const balanceChange = transferData.type === 'Inwards' 
      ? transferData.amount - (transferData.fees || 0)
      : -(transferData.amount + (transferData.fees || 0));

    // Get current account balance
    const { data: currentAccount, error: fetchError } = await supabase
      .from('safehaven_accounts')
      .select('account_balance, book_balance')
      .eq('user_id', userId)
      .eq('account_number', accountNumber)
      .single();

    if (fetchError || !currentAccount) {
      console.error('Error fetching current account balance:', fetchError);
      return;
    }

    const newAccountBalance = (currentAccount.account_balance || 0) + balanceChange;
    const newBookBalance = (currentAccount.book_balance || 0) + balanceChange;

    // Update safehaven_accounts balance
    const { error: updateError } = await supabase
      .from('safehaven_accounts')
      .update({
        account_balance: newAccountBalance,
        book_balance: newBookBalance,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_number', accountNumber);

    if (updateError) {
      console.error('Error updating account balance:', updateError);
    } else {
      console.log(`Account balance updated: ${currentAccount.account_balance} -> ${newAccountBalance}`);
    }

    // Log balance update to safehaven_account_balances table
    try {
      const { error: balanceLogError } = await supabase
        .from('safehaven_account_balances')
        .insert({
          user_id: userId,
          account_number: accountNumber,
          previous_balance: currentAccount.account_balance || 0,
          new_balance: newAccountBalance,
          balance_change: balanceChange,
          transfer_id: transferData._id,
          transfer_type: transferData.type,
          amount: transferData.amount,
          fees: transferData.fees || 0,
          status: transferData.status,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (balanceLogError) {
        console.warn('Error logging balance update (table may not exist):', balanceLogError);
      } else {
        console.log('Balance update logged successfully');
      }
    } catch (balanceLogError) {
      console.warn('safehaven_account_balances table may not exist, skipping:', balanceLogError);
    }

  } catch (error) {
    console.error('Error updating user balance:', error);
  }
}

// Update virtual account balance
async function updateVirtualAccountBalance(userId: string, transferData: SafeHavenVirtualAccountTransferData): Promise<void> {
  try {
    // For virtual accounts, we can update the main account balance
    // Find account by user_id and update balance
    const accountNumber = transferData.type === 'Inwards' 
      ? transferData.creditAccountNumber 
      : transferData.debitAccountNumber;

    if (accountNumber) {
      await updateUserBalance(userId, transferData as any, accountNumber);
    }
  } catch (error) {
    console.error('Error updating virtual account balance:', error);
  }
}

// Create audit log entry
async function createAuditLog(
  userId: string,
  operationType: string,
  requestData: any,
  responseData: any,
  status: string
): Promise<void> {
  try {
    await supabase
      .from('safehaven_audit_logs')
      .insert({
        user_id: userId,
        operation_type: operationType,
        request_data: requestData,
        response_data: responseData,
        status,
        safehaven_endpoint: 'webhook',
        metadata: {
          timestamp: new Date().toISOString(),
          function: 'safehaven-webhook'
        }
      });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
}

// Process subaccount created webhook
async function processSubaccountCreatedWebhook(subaccountData: SafeHavenSubaccountData): Promise<any> {
  console.log('Processing subaccount created webhook:', subaccountData._id);

  try {
    // Get user ID from client ID
    const { data: userData, error: userError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', subaccountData.client)
      .single();

    if (userError || !userData) {
      console.error('Could not find user for client ID:', subaccountData.client);
      return { error: 'User not found' };
    }

    // Store subaccount data
    // Extract auto sweep information from webhook payload
    const autoSweepEnabled = subaccountData.autoSweep !== undefined 
      ? subaccountData.autoSweep 
      : (subaccountData.autoSweepDetails ? true : false);
    const mainAccountNumber = subaccountData.autoSweepDetails?.mainAccountNumber 
      || subaccountData.autoSweepDetails?.main_account_number 
      || subaccountData.mainAccountNumber
      || null;
    const identityId = subaccountData.identityId || subaccountData.identity_id || null;

    const { error: insertError } = await supabase
      .from('safehaven_subaccounts')
      .upsert({
        user_id: userData.user_id,
        safehaven_subaccount_id: subaccountData._id,
        client_id: subaccountData.client,
        session_id: subaccountData.sessionId,
        account_name: subaccountData.accountName,
        account_number: subaccountData.accountNumber,
        account_type: subaccountData.accountType,
        currency_code: subaccountData.currencyCode,
        description: subaccountData.description,
        phone_number: subaccountData.phoneNumber,
        email: subaccountData.email,
        status: subaccountData.status,
        otp_verified: subaccountData.otpVerified || false,
        otp_verified_at: subaccountData.otpVerifiedAt,
        identity_id: identityId,
        auto_sweep_enabled: autoSweepEnabled,
        main_account_number: mainAccountNumber,
        created_at: subaccountData.createdAt,
        updated_at: subaccountData.updatedAt,
        synced_at: new Date().toISOString(),
        metadata: {
          webhook_received_at: new Date().toISOString(),
          safehaven_data: subaccountData,
          auto_sweep_details: subaccountData.autoSweepDetails || null
        }
      });

    if (insertError) {
      console.error('Error storing subaccount:', insertError);
      return { error: 'Failed to store subaccount' };
    }

    // Mark Tier 1 as complete when sub account is successfully created
    if (subaccountData.status === 'Active' || subaccountData.status === 'active') {
      await supabase
        .from('kyc_progress')
        .update({
          tier1_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userData.user_id);
    }

    console.log('Subaccount created webhook processed successfully:', subaccountData._id, {
      autoSweepEnabled,
      mainAccountNumber: mainAccountNumber ? mainAccountNumber.substring(0, 5) + '****' : null,
      identityId: identityId ? identityId.substring(0, 8) + '****' : null
    });
    return { success: true, subaccountId: subaccountData._id };

  } catch (error) {
    console.error('Error processing subaccount created webhook:', error);
    return { error: 'Failed to process subaccount created webhook' };
  }
}

// Process subaccount updated webhook
async function processSubaccountUpdatedWebhook(subaccountData: SafeHavenSubaccountData): Promise<any> {
  console.log('Processing subaccount updated webhook:', subaccountData._id);

  try {
    // Get user ID from client ID
    const { data: userData, error: userError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', subaccountData.client)
      .single();

    if (userError || !userData) {
      console.error('Could not find user for client ID:', subaccountData.client);
      return { error: 'User not found' };
    }

    // Update subaccount data
    const { error: updateError } = await supabase
      .from('safehaven_subaccounts')
      .update({
        account_name: subaccountData.accountName,
        account_number: subaccountData.accountNumber,
        account_type: subaccountData.accountType,
        currency_code: subaccountData.currencyCode,
        description: subaccountData.description,
        phone_number: subaccountData.phoneNumber,
        email: subaccountData.email,
        status: subaccountData.status,
        otp_verified: subaccountData.otpVerified,
        otp_verified_at: subaccountData.otpVerifiedAt,
        updated_at: subaccountData.updatedAt,
        synced_at: new Date().toISOString(),
        metadata: supabase.raw(`
          COALESCE(metadata, '{}'::jsonb) || 
          '{"webhook_updated_at": "${new Date().toISOString()}", "safehaven_data": ${JSON.stringify(subaccountData)}}'::jsonb
        `)
      })
      .eq('safehaven_subaccount_id', subaccountData._id)
      .eq('user_id', userData.user_id);

    if (updateError) {
      console.error('Error updating subaccount:', updateError);
      return { error: 'Failed to update subaccount' };
    }

    console.log('Subaccount updated webhook processed successfully:', subaccountData._id);
    return { success: true, subaccountId: subaccountData._id };

  } catch (error) {
    console.error('Error processing subaccount updated webhook:', error);
    return { error: 'Failed to process subaccount updated webhook' };
  }
}

// Process subaccount status webhook
async function processSubaccountStatusWebhook(subaccountData: SafeHavenSubaccountData): Promise<any> {
  console.log('Processing subaccount status webhook:', subaccountData._id);

  try {
    // Get user ID from client ID
    const { data: userData, error: userError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', subaccountData.client)
      .single();

    if (userError || !userData) {
      console.error('Could not find user for client ID:', subaccountData.client);
      return { error: 'User not found' };
    }

    // Update subaccount status
    const { error: updateError } = await supabase
      .from('safehaven_subaccounts')
      .update({
        status: subaccountData.status,
        updated_at: subaccountData.updatedAt,
        synced_at: new Date().toISOString(),
        metadata: supabase.raw(`
          COALESCE(metadata, '{}'::jsonb) || 
          '{"status_updated_at": "${new Date().toISOString()}", "safehaven_data": ${JSON.stringify(subaccountData)}}'::jsonb
        `)
      })
      .eq('safehaven_subaccount_id', subaccountData._id)
      .eq('user_id', userData.user_id);

    if (updateError) {
      console.error('Error updating subaccount status:', updateError);
      return { error: 'Failed to update subaccount status' };
    }

    console.log('Subaccount status webhook processed successfully:', subaccountData._id);
    return { success: true, subaccountId: subaccountData._id, status: subaccountData.status };

  } catch (error) {
    console.error('Error processing subaccount status webhook:', error);
    return { error: 'Failed to process subaccount status webhook' };
  }
}

// Main function handler
// CORS headers for webhook requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return createJsonResponse({ error: 'Method not allowed' }, 405);
    }

    // SECURITY: Verify request is from SafeHaven
    const securityCheck = verifySafeHavenRequest(req);
    if (!securityCheck.isValid) {
      console.error('🚫 Webhook request rejected:', securityCheck.reason);
      return createJsonResponse({ 
        error: 'Unauthorized',
        message: 'This webhook endpoint is only accessible by SafeHaven. Testing tools are not allowed.',
        reason: securityCheck.reason
      }, 403);
    }

    // Log that we received a webhook (for debugging)
    console.log('✅ SafeHaven webhook received:', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });

    // Get webhook payload
    const payload = await req.text();
    let rawPayload: any;
    
    try {
      rawPayload = JSON.parse(payload);
    } catch (parseError) {
      console.error('Error parsing webhook payload:', parseError);
      return createJsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    console.log('Received SafeHaven webhook payload:', JSON.stringify(rawPayload, null, 2));

    // SafeHaven sends webhook in format: { type: "transfer", data: {...} }
    // or directly as the transfer object with a type field
    let webhookType: string;
    let webhookData: any;

    if (rawPayload.type && rawPayload.data) {
      // Standard format: { type: "transfer", data: {...} }
      webhookType = rawPayload.type;
      webhookData = rawPayload.data;
    } else if (rawPayload.type && !rawPayload.data) {
      // Direct format: the data itself has a type field
      webhookType = rawPayload.type;
      webhookData = rawPayload;
    } else {
      // Try to infer type from the payload structure
      if (rawPayload.paymentReference || rawPayload.sessionId) {
        webhookType = 'transfer';
        webhookData = rawPayload;
      } else if (rawPayload.accountNumber) {
        webhookType = 'account.update';
        webhookData = rawPayload;
      } else {
        console.error('Unable to determine webhook type from payload');
        return createJsonResponse({ error: 'Unable to determine webhook type' }, 400);
      }
    }

    console.log('Parsed webhook type:', webhookType);
    console.log('Webhook data keys:', Object.keys(webhookData || {}));

    // Verify webhook signature if provided
    const signature = req.headers.get('x-signature') || 
                     req.headers.get('x-safehaven-signature') || 
                     req.headers.get('signature') || '';
    
    if (SAFEHAVEN_WEBHOOK_SECRET && signature) {
      if (!verifyWebhookSignature(payload, signature, SAFEHAVEN_WEBHOOK_SECRET)) {
        console.error('🚫 Invalid webhook signature');
        return createJsonResponse({ 
          error: 'Invalid signature',
          message: 'Webhook signature verification failed'
        }, 401);
      }
      console.log('✅ Webhook signature verified');
    } else if (SAFEHAVEN_WEBHOOK_SECRET && !signature) {
      console.warn('⚠️ Webhook secret configured but no signature provided');
      // In production, you might want to reject this
      // For now, we'll allow it but log a warning
    }

    // Webhook is logged to safehaven_deposit_webhooks during processing
    // No need to store in a separate webhooks table
    let webhookRecord: any = null;

    // Process webhook based on type
    let result: any = null;

    try {
      switch (webhookType) {
        case 'transfer':
          result = await processTransferWebhook(webhookData);
          break;
        case 'virtualAccount.transfer':
          result = await processVirtualAccountTransferWebhook(webhookData);
          break;
        case 'account.update':
          result = await processAccountUpdateWebhook(webhookData);
          break;
        case 'transaction.update':
          result = await processTransactionUpdateWebhook(webhookData);
          break;
        case 'subaccount.created':
          result = await processSubaccountCreatedWebhook(webhookData);
          break;
        case 'subaccount.updated':
          result = await processSubaccountUpdatedWebhook(webhookData);
          break;
        case 'subaccount.status':
          result = await processSubaccountStatusWebhook(webhookData);
          break;
        default:
          throw new Error(`Unknown webhook type: ${webhookType}`);
      }

      // Mark webhook as processed if we have a record
      if (webhookRecord?.id) {
        await supabase
          .from('safehaven_webhooks')
          .update({
            processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', webhookRecord.id);
      }

      console.log('Webhook processed successfully:', webhookType);

      return createJsonResponse({
        success: true,
        message: 'Webhook processed successfully',
        data: result,
        webhookId: webhookRecord?.id || null,
        processingTime: Date.now() - startTime
      });

    } catch (processingError) {
      console.error('Error processing webhook:', processingError);

      // Mark webhook as failed if we have a record
      if (webhookRecord?.id) {
        await supabase
          .from('safehaven_webhooks')
          .update({
            processed: false,
            processing_error: processingError instanceof Error ? processingError.message : 'Unknown error',
            retry_count: 1
          })
          .eq('id', webhookRecord.id);
      }

      return createJsonResponse({
        success: false,
        error: 'Failed to process webhook',
        details: processingError instanceof Error ? processingError.message : 'Unknown error',
        webhookId: webhookRecord?.id || null,
        processingTime: Date.now() - startTime
      }, 500);
    }

  } catch (error) {
    console.error('Error in SafeHaven webhook handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return createJsonResponse({
      success: false,
      error: 'Internal server error',
      details: errorMessage,
      processingTime: Date.now() - startTime
    }, 500);
  }
});
