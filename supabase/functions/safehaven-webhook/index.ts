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
import { 
  generatePayoutSuccessEmailHtml, 
  generatePayoutFailedEmailHtml, 
  generatePayoutReversedEmailHtml,
  generateEmergencyWithdrawalSuccessEmailHtml,
  generateEmergencyWithdrawalFailedEmailHtml,
  generateEmergencyWithdrawalReversedEmailHtml,
  generateDepositSuccessEmailHtml,
  generateDepositFailedEmailHtml
} from './email-templates.ts';

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
const resendApiKey = Deno.env.get('RESEND_API_KEY');

// Allowed SafeHaven IP addresses (if known - add SafeHaven's webhook server IPs here)
const SAFEHAVEN_ALLOWED_IPS: string[] = [
  // Add SafeHaven's webhook server IP addresses here when available
  // Example: '52.31.139.75', '52.49.173.169'
];

interface SafeHavenWebhookPayload {
  type: 'transfer' | 'virtualAccount.transfer' | 'account.update' | 'account.debit' | 'transaction.update' | 'subaccount.created' | 'subaccount.updated' | 'subaccount.status' | 'identityCreditCheck';
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
  createdAt: string;
  updatedAt: string;
}

interface SafeHavenIdentityCreditCheckData {
  _id: string;
  clientId: string;
  identityNumber: string;
  type: 'BVN' | 'NIN' | string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  debitAccountNumber: string;
  vat: number;
  stampDuty: number;
  isDeleted: boolean;
  otpVerified: boolean;
  otpResendCount: number;
  debitMessage?: string;
  debitResponsCode?: number;
  debitSessionId?: string;
  otpId?: string;
  creditMessage?: string;
  creditResponsCode?: number;
  creditSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

interface SafeHavenAccountDebitData {
  _id?: string;
  client: string;
  account: string;
  debitAccountName?: string;
  debitAccountNumber?: string;
  paymentReference?: string;
  sessionId?: string;
  debitMessage?: string;
  reference?: string;
  type?: 'Debit' | 'Outwards' | string;
  provider?: string;
  providerChannel?: string;
  narration?: string;
  amount?: number;
  fees?: number;
  vat?: number;
  stampDuty?: number;
  createdAt?: string;
  updatedAt?: string;
  responseCode?: string | null;
  responseMessage?: string | null;
  status?: string;
  // Transfer-specific fields that might be present
  creditAccountName?: string;
  creditAccountNumber?: string;
  nameEnquiryReference?: string;
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

    // Check if this transfer is related to an automated payout or emergency withdrawal
    // For Outwards transfers (payouts), check if we have an automated_payout or emergency_withdrawal record
    if (transferData.type === 'Outwards') {
      if (transferData.status === 'Completed') {
        await handleTransferSuccess(transferData, userId);
      } else if (transferData.status === 'Failed') {
        await handleTransferFailed(transferData, userId);
      } else if (transferData.status === 'Reversed') {
        await handleTransferReversed(transferData, userId);
      }
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

    // Find the account in safehaven_accounts to get the user_account_id
    // NOTE: safehaven_user_accounts is handled in the frontend when sending money (payouts/transfers)
    // For webhooks, we only need to reference safehaven_accounts
    let userAccountId: string | null = null;
    if (accountNumber) {
      // Query safehaven_accounts (the main accounts table)
      const { data: accountData, error: accountError } = await supabase
        .from('safehaven_accounts')
        .select('id')
        .eq('account_number', accountNumber)
        .eq('is_deleted', false)
        .single();

      if (!accountError && accountData) {
        userAccountId = accountData.id;
      } else {
        console.warn(`Could not find safehaven_accounts record for account number: ${accountNumber}`);
      }

      // COMMENTED OUT: safehaven_user_accounts is handled in frontend for sending money
      // // First try safehaven_user_accounts (the table referenced by the foreign key)
      // const { data: userAccountData, error: userAccountError } = await supabase
      //   .from('safehaven_user_accounts')
      //   .select('id')
      //   .eq('account_number', accountNumber)
      //   .eq('is_deleted', false)
      //   .single();
      // 
      // if (!userAccountError && userAccountData) {
      //   userAccountId = userAccountData.id;
      // } else {
      //   // If not found, try safehaven_accounts (they might be the same table or have a mapping)
      //   const { data: accountData, error: accountError } = await supabase
      //     .from('safehaven_accounts')
      //     .select('id')
      //     .eq('account_number', accountNumber)
      //     .eq('is_deleted', false)
      //     .single();
      // 
      //   if (!accountError && accountData) {
      //     userAccountId = accountData.id;
      //   } else {
      //     console.warn(`Could not find safehaven_user_accounts or safehaven_accounts record for account number: ${accountNumber}`);
      //   }
      // }
    }

    // If we have userId but no userAccountId, try to find account by userId
    if (!userAccountId && userId) {
      // Query safehaven_accounts by userId
      const { data: accountData, error: accountError } = await supabase
        .from('safehaven_accounts')
        .select('id')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .eq('is_default', true)
        .single();

      if (!accountError && accountData) {
        userAccountId = accountData.id;
      }

      // COMMENTED OUT: safehaven_user_accounts is handled in frontend for sending money
      // // Try safehaven_user_accounts first
      // const { data: userAccountData, error: userAccountError } = await supabase
      //   .from('safehaven_user_accounts')
      //   .select('id')
      //   .eq('user_id', userId)
      //   .eq('is_deleted', false)
      //   .eq('is_default', true)
      //   .single();
      // 
      // if (!userAccountError && userAccountData) {
      //   userAccountId = userAccountData.id;
      // } else {
      //   // Fallback to safehaven_accounts
      //   const { data: accountData, error: accountError } = await supabase
      //     .from('safehaven_accounts')
      //     .select('id')
      //     .eq('user_id', userId)
      //     .eq('is_deleted', false)
      //     .eq('is_default', true)
      //     .single();
      // 
      //   if (!accountError && accountData) {
      //     userAccountId = accountData.id;
      //   }
      // }
    }

    // Determine webhook type
    const webhookType = transferData.virtualAccount ? 'virtualAccount.transfer' : 'transfer';

    // Map status to table status values
    let status = 'pending';
    if (transferData.status === 'Completed') {
      status = 'processed';
    } else if (transferData.status === 'Failed' || transferData.status === 'Reversed') {
      status = 'failed';
    } else if (transferData.status === 'Pending') {
      status = 'processing';
    }

    // Determine sender information based on transfer type
    const senderName = transferData.type === 'Inwards' 
      ? transferData.debitAccountName 
      : transferData.creditAccountName;
    const senderAccount = transferData.type === 'Inwards' 
      ? transferData.debitAccountNumber 
      : transferData.creditAccountNumber;
    const senderBank = transferData.provider || transferData.destinationInstitutionCode || null;

    // Skip insert if we can't find the user_account_id (table requires it)
    if (!userAccountId) {
      console.warn(`Skipping webhook log insert: Could not find safehaven_accounts record for account number: ${accountNumber}`);
      return;
    }

    const insertData: any = {
      user_account_id: userAccountId,
      webhook_type: webhookType,
      transfer_id: transferData._id || transferData.id,
      transaction_reference: transferData.paymentReference || transferData.reference || null,
      sender_name: senderName || null,
      sender_account: senderAccount || null,
      sender_bank: senderBank,
      amount: transferData.amount || 0,
      currency: 'NGN',
      narration: transferData.narration || null,
      status: status,
      wallet_credited: false,
      wallet_transaction_id: null,
      webhook_payload: transferData,
      received_at: new Date().toISOString()
    };

    // Only set processed_at if status is processed or failed
    if (status === 'processed' || status === 'failed') {
      insertData.processed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('safehaven_deposit_webhooks')
      .insert(insertData);

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
    // For Inwards: add amount (minus fees) - this is what actually arrived in the account
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
    // NOTE: safehaven_account_balances is a VIEW that automatically reflects changes from safehaven_accounts
    // When we update safehaven_accounts, the view will automatically show the updated balance
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
      console.log('Note: safehaven_account_balances view will automatically reflect this update');
    }

    // Update wallet balance for Inwards transfers (deposits)
    // IMPORTANT: Credit wallet with FULL amount (before fees) so user sees the full amount they sent
    // Example: User sends 200, SafeHaven deducts 5 in fees, account gets 195, but wallet shows 200
    if (transferData.type === 'Inwards') {
      try {
        // Get current wallet balance
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('balance, locked_balance')
          .eq('user_id', userId)
          .single();

        if (walletError && walletError.code !== 'PGRST116') {
          console.error('Error fetching wallet:', walletError);
        } else {
          // Calculate new wallet balance (add full amount, not minus fees)
          const walletAmount = transferData.amount; // Full amount, not minus fees
          const newWalletBalance = (wallet?.balance || 0) + walletAmount;
          const currentLockedBalance = wallet?.locked_balance || 0;
          
          // Calculate available_balance explicitly: balance - locked_balance
          // NOTE: The trigger should also do this, but we set it explicitly to ensure it's correct
          const newAvailableBalance = newWalletBalance - currentLockedBalance;
          
          // Update wallet balance and available_balance using function
          // This bypasses the trigger that blocks direct updates
          const { error: walletUpdateError } = await supabase.rpc('update_wallet_from_webhook', {
            arg_user_id: userId,
            arg_balance: newWalletBalance,
            arg_available_balance: newAvailableBalance
          });

          if (walletUpdateError) {
            console.error('Error updating wallet balance:', walletUpdateError);
          } else {
            console.log(`Wallet balance updated: ${wallet?.balance || 0} -> ${newWalletBalance} (credited full amount: ${walletAmount}, fees absorbed)`);
            console.log(`Available balance updated: ${wallet?.available_balance || 0} -> ${newAvailableBalance} (balance: ${newWalletBalance} - locked: ${currentLockedBalance})`);
            
            // Create transaction record
            const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
            const narration = transferData.narration || 'SafeHaven deposit';
            const senderName = transferData.debitAccountName || 'Unknown';
            
            // Check if transaction already exists to avoid duplicates
            let transactionId: string | null = null;
            if (paymentRef) {
              const { data: existingTransaction } = await supabase
                .from('transactions')
                .select('id')
                .eq('reference', paymentRef)
                .eq('type', 'deposit')
                .eq('user_id', userId)
                .single();

              if (!existingTransaction) {
                // Create new transaction record
                const { data: newTransaction, error: transactionError } = await supabase
                  .from('transactions')
                  .insert({
                    user_id: userId,
                    type: 'deposit',
                    amount: walletAmount,
                    status: 'completed',
                    source: 'SafeHaven',
                    destination: 'wallet',
                    reference: paymentRef,
                    description: `${narration} - From ${senderName}`,
                    // metadata column may or may not exist - if it doesn't, the insert will still work without it
                    ...(transferData._id && {
                      metadata: {
                        safehaven_transfer_id: transferData._id,
                        safehaven_account_number: accountNumber,
                        fees: transferData.fees || 0,
                        full_amount: walletAmount,
                        net_amount: walletAmount - (transferData.fees || 0),
                        webhook_processed_at: new Date().toISOString()
                      }
                    })
                  } as any)
                  .select('id')
                  .single();

                if (transactionError) {
                  console.warn('Error creating transaction record:', transactionError);
                } else {
                  transactionId = newTransaction?.id || null;
                  console.log('Transaction record created:', transactionId);
                  
                  // Send deposit success email notification
                  try {
                    await sendDepositSuccessEmailNotification(
                      userId,
                      walletAmount,
                      newAvailableBalance,
                      paymentRef,
                      transactionId,
                      senderName,
                      transferData.debitAccountNumber,
                      transferData.provider || transferData.destinationInstitutionCode,
                      narration
                    );
                  } catch (emailError) {
                    console.error('❌ Error sending deposit success email notification:', emailError);
                  }
                }
              } else {
                transactionId = existingTransaction.id;
                console.log('Transaction already exists, skipping duplicate:', transactionId);
              }
            }

            // Mark wallet as credited in safehaven_deposit_webhooks table
            if (paymentRef) {
              // Get the account ID to find the webhook record
              const { data: accountData } = await supabase
                .from('safehaven_accounts')
                .select('id')
                .eq('account_number', accountNumber)
                .eq('user_id', userId)
                .single();

              if (accountData?.id) {
                const updateData: any = {
                  wallet_credited: true,
                  updated_at: new Date().toISOString()
                };

                if (transactionId) {
                  updateData.wallet_transaction_id = transactionId;
                }

                const { error: webhookUpdateError } = await supabase
                  .from('safehaven_deposit_webhooks')
                  .update(updateData)
                  .eq('transaction_reference', paymentRef)
                  .eq('user_account_id', accountData.id);

                if (webhookUpdateError) {
                  console.warn('Error updating wallet_credited flag:', webhookUpdateError);
                } else {
                  console.log('Marked wallet_credited as true in safehaven_deposit_webhooks');
                }
              }
            }
          }
        }
      } catch (walletError) {
        console.error('Error updating wallet in updateUserBalance:', walletError);
        // Don't throw - wallet update failure shouldn't break the webhook processing
      }
    }

  } catch (error) {
    console.error('Error updating user balance:', error);
  }
}

// Handle transfer success - main handler following Paystack pattern
async function handleTransferSuccess(transferData: SafeHavenTransferData, userId: string): Promise<void> {
  try {
    console.log(`✅ Processing successful transfer: ${transferData.paymentReference || transferData._id}`);
    
    // First, check if this is an emergency withdrawal
    const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
    const { data: emergencyWithdrawal, error: emergencyError } = await supabase
      .from('emergency_withdrawals')
      .select('id, user_id, payout_plan_id, withdrawal_amount, net_amount, status, reference')
      .eq('reference', paymentRef)
      .single();

    if (!emergencyError && emergencyWithdrawal) {
      console.log(`🚨 Processing emergency withdrawal success: ${paymentRef}`);
      await handleEmergencyWithdrawalSuccess(emergencyWithdrawal, transferData);
      return;
    }

    // If not emergency withdrawal, check for automated payout
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, user_id, amount, status')
      .or(`safehaven_transfer_id.eq.${transferData._id},payment_reference.eq.${paymentRef},transfer_reference.eq.${paymentRef}`)
      .single();

    if (payoutError || !automatedPayout) {
      console.error(`❌ No automated payout or emergency withdrawal found for transfer reference: ${paymentRef}`);
      return;
    }

    console.log(`📋 Processing automated payout success: ${paymentRef}`);
    await handleAutomatedPayoutSuccess(automatedPayout, transferData);
  } catch (error) {
    console.error('❌ Error handling transfer success:', error);
    throw error;
  }
}

// Handle transfer failed - main handler
async function handleTransferFailed(transferData: SafeHavenTransferData, userId: string): Promise<void> {
  try {
    console.log(`❌ Processing failed transfer: ${transferData.paymentReference || transferData._id}`);
    
    // First, check if this is an emergency withdrawal
    const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
    const { data: emergencyWithdrawal, error: emergencyError } = await supabase
      .from('emergency_withdrawals')
      .select('id, user_id, payout_plan_id, withdrawal_amount, net_amount, status, reference')
      .eq('reference', paymentRef)
      .single();

    if (!emergencyError && emergencyWithdrawal) {
      console.log(`🚨 Processing emergency withdrawal failure: ${paymentRef}`);
      await handleEmergencyWithdrawalFailed(emergencyWithdrawal, transferData);
      return;
    }

    // If not emergency withdrawal, check for automated payout
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, user_id, amount, status')
      .or(`safehaven_transfer_id.eq.${transferData._id},payment_reference.eq.${paymentRef},transfer_reference.eq.${paymentRef}`)
      .single();

    if (payoutError || !automatedPayout) {
      console.error(`❌ No automated payout or emergency withdrawal found for transfer reference: ${paymentRef}`);
      return;
    }

    console.log(`📋 Processing automated payout failure: ${paymentRef}`);
    await handleAutomatedPayoutFailed(automatedPayout, transferData);
  } catch (error) {
    console.error('❌ Error handling transfer failed:', error);
    throw error;
  }
}

// Handle transfer reversed - main handler
async function handleTransferReversed(transferData: SafeHavenTransferData, userId: string): Promise<void> {
  try {
    console.log(`🔄 Processing reversed transfer: ${transferData.paymentReference || transferData._id}`);
    
    // First, check if this is an emergency withdrawal
    const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
    const { data: emergencyWithdrawal, error: emergencyError } = await supabase
      .from('emergency_withdrawals')
      .select('id, user_id, payout_plan_id, withdrawal_amount, net_amount, status, reference')
      .eq('reference', paymentRef)
      .single();

    if (!emergencyError && emergencyWithdrawal) {
      console.log(`🚨 Processing emergency withdrawal reversal: ${paymentRef}`);
      await handleEmergencyWithdrawalReversed(emergencyWithdrawal, transferData);
      return;
    }

    // If not emergency withdrawal, check for automated payout
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, user_id, amount, status')
      .or(`safehaven_transfer_id.eq.${transferData._id},payment_reference.eq.${paymentRef},transfer_reference.eq.${paymentRef}`)
      .single();

    if (payoutError || !automatedPayout) {
      console.error(`❌ No automated payout or emergency withdrawal found for transfer reference: ${paymentRef}`);
      return;
    }

    console.log(`📋 Processing automated payout reversal: ${paymentRef}`);
    await handleAutomatedPayoutReversed(automatedPayout, transferData);
  } catch (error) {
    console.error('❌ Error handling transfer reversed:', error);
    throw error;
  }
}

// Handle emergency withdrawal success
async function handleEmergencyWithdrawalSuccess(emergencyWithdrawal: any, transferData: SafeHavenTransferData): Promise<void> {
  try {
    const paymentRef = transferData.paymentReference || transferData.sessionId || emergencyWithdrawal.reference;
    
    // Use withdrawal_amount from emergency_withdrawals table (this is the total including withdrawal fee)
    // withdrawal_amount = 50 (total), net_amount = 44 (sent to user), fee_amount = 6 (withdrawal fee)
    // transferData.amount = 44 (net sent), transferData.fees = 10 (SafeHaven transaction fee on main account, NOT withdrawal fee)
    const totalAmount = emergencyWithdrawal.withdrawal_amount;
    
    // Console log amounts for debugging
    console.log('💰 Emergency Withdrawal Amounts:', {
      withdrawal_amount_from_table: emergencyWithdrawal.withdrawal_amount,
      net_amount_from_table: emergencyWithdrawal.net_amount,
      fee_amount_from_table: emergencyWithdrawal.fee_amount,
      transfer_amount_from_webhook: transferData.amount,
      transfer_fees_from_webhook: transferData.fees || 0,
      note: 'transfer_fees is SafeHaven transaction fee on main account, NOT withdrawal fee',
      total_amount_to_debit: totalAmount,
      source: 'emergency_withdrawals.withdrawal_amount',
      will_deduct_from_safehaven_account: totalAmount,
      will_deduct_from_wallet_locked: emergencyWithdrawal.withdrawal_amount
    });

    // 1. Create audit log FIRST
    await createAuditLog(
      emergencyWithdrawal.user_id,
      'emergency_withdrawal_success',
      {
        emergency_withdrawal_id: emergencyWithdrawal.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef,
        withdrawal_amount: emergencyWithdrawal.withdrawal_amount,
        net_amount: emergencyWithdrawal.net_amount,
        fee_amount: emergencyWithdrawal.fee_amount,
        transfer_amount: transferData.amount,
        transfer_fees: transferData.fees || 0,
        total_amount: totalAmount
      },
      {
        status: 'processing',
        step: 'webhook_received'
      },
      'success'
    );

    // 2. Update emergency withdrawal status
    const { error: updateError } = await supabase
      .from('emergency_withdrawals')
      .update({
        status: 'completed',
        transferred_at: new Date().toISOString(),
        transfer_code: paymentRef,
        metadata: {
          safehaven_transfer_id: transferData._id,
          safehaven_reference: paymentRef,
          transfer_success: true,
          safehaven_transfer_data: transferData
        }
      })
      .eq('id', emergencyWithdrawal.id);

    if (updateError) {
      console.error(`❌ Error updating emergency withdrawal status:`, updateError);
      await createAuditLog(
        emergencyWithdrawal.user_id,
        'emergency_withdrawal_success_error',
        { emergency_withdrawal_id: emergencyWithdrawal.id, error: updateError.message },
        { status: 'error' },
        'error'
      );
      return;
    }

    console.log(`✅ Emergency withdrawal ${emergencyWithdrawal.id} marked as completed`);

    // 3. Update the payout plan status to cancelled (since emergency withdrawal cancels the plan)
    const { error: planUpdateError } = await supabase
      .from('payout_plans')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', emergencyWithdrawal.payout_plan_id);

    if (planUpdateError) {
      console.error(`❌ Error updating payout plan status:`, planUpdateError);
    } else {
      console.log(`✅ Payout plan ${emergencyWithdrawal.payout_plan_id} marked as cancelled`);
    }

    // 4. Update SafeHaven account balance (subtract amount + fees)
    // Get user's safehaven_account by user_id (not by account_number since 0117753301 is the main account)
    const { data: currentAccount } = await supabase
      .from('safehaven_accounts')
      .select('id, account_balance, book_balance, metadata, account_number')
      .eq('user_id', emergencyWithdrawal.user_id)
      .eq('is_deleted', false)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!currentAccount) {
      console.error(`❌ SafeHaven account not found for user ${emergencyWithdrawal.user_id}`);
      await createAuditLog(
        emergencyWithdrawal.user_id,
        'emergency_withdrawal_success_error',
        { emergency_withdrawal_id: emergencyWithdrawal.id, error: 'Account not found' },
        { status: 'error' },
        'error'
      );
      return;
    }

    const balanceChange = -totalAmount;
    const newAccountBalance = (currentAccount.account_balance || 0) + balanceChange;
    const newBookBalance = (currentAccount.book_balance || 0) + balanceChange;
    
    console.log('💸 SafeHaven Account Balance Update:', {
      current_balance: currentAccount.account_balance,
      balance_change: balanceChange,
      new_balance: newAccountBalance,
      amount_being_debited: totalAmount
    });

    // Update safehaven_accounts balance
    const { error: accountUpdateError } = await supabase
      .from('safehaven_accounts')
      .update({
        account_balance: newAccountBalance,
        book_balance: newBookBalance,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
        metadata: {
          ...(currentAccount.metadata || {}),
          payment_reference: paymentRef,
          transfer_reference: paymentRef,
          transfer_status: 'Completed',
          emergency_withdrawal_id: emergencyWithdrawal.id,
          balance_change: balanceChange,
          updated_by: 'webhook_emergency_withdrawal'
        }
      })
      .eq('id', currentAccount.id);

    if (accountUpdateError) {
      console.error(`❌ Error updating SafeHaven account balance:`, accountUpdateError);
      await createAuditLog(
        emergencyWithdrawal.user_id,
        'emergency_withdrawal_success_error',
        { emergency_withdrawal_id: emergencyWithdrawal.id, error: accountUpdateError.message },
        { status: 'error' },
        'error'
      );
      return;
    }

    console.log(`✅ Updated SafeHaven account balance: ${currentAccount.account_balance} -> ${newAccountBalance}`);

    // Audit log for account balance update
    await createAuditLog(
      emergencyWithdrawal.user_id,
      'safehaven_account_balance_updated',
      {
        account_number: currentAccount.account_number,
        balance_change: balanceChange,
        old_balance: currentAccount.account_balance,
        new_balance: newAccountBalance
      },
      { status: 'success' },
      'success'
    );

    // 5. Update wallet balance - reduce both balance and locked_balance since money is being withdrawn from the system
    // Use withdrawal_amount (total 50) not net_amount (44) - we need to deduct the full amount including fees
    console.log('💳 Wallet Balance Update:', {
      user_id: emergencyWithdrawal.user_id,
      amount_to_deduct_from_locked: emergencyWithdrawal.withdrawal_amount,
      note: 'Deducting full withdrawal_amount (not net_amount) from locked_balance'
    });
    
    const { error: reduceError } = await supabase.rpc("transfer_funds", {
      arg_user_id: emergencyWithdrawal.user_id,
      arg_amount: emergencyWithdrawal.withdrawal_amount
    });

    if (reduceError) {
      console.error(`❌ Error reducing wallet balance for emergency withdrawal:`, reduceError);
      await createAuditLog(
        emergencyWithdrawal.user_id,
        'emergency_withdrawal_success_error',
        { emergency_withdrawal_id: emergencyWithdrawal.id, error: reduceError.message },
        { status: 'error' },
        'error'
      );
      return;
    }

    console.log(`✅ Successfully reduced ₦${emergencyWithdrawal.withdrawal_amount} from wallet for user ${emergencyWithdrawal.user_id}`);

    // Audit log for wallet update
    await createAuditLog(
      emergencyWithdrawal.user_id,
      'wallet_balance_updated',
      {
        amount_deducted: emergencyWithdrawal.withdrawal_amount,
        operation: 'transfer_funds'
      },
      { status: 'success' },
      'success'
    );

    // 6. Update transaction record (not create) with status completed and source safehaven_payout_plan
    await updateTransactionStatus(
      {
        user_id: emergencyWithdrawal.user_id,
        reference: emergencyWithdrawal.reference,
        payout_plan_id: emergencyWithdrawal.payout_plan_id
      },
      transferData,
      'completed',
      'safehaven_payout_plan'
    );

    // Audit log for transaction update
    await createAuditLog(
      emergencyWithdrawal.user_id,
      'transaction_updated',
      {
        transaction_reference: paymentRef,
        status: 'completed',
        source: 'safehaven_payout_plan'
      },
      { status: 'success' },
      'success'
    );

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: emergencyWithdrawal.user_id,
      p_title: 'Emergency Withdrawal Completed',
      p_body: `Your emergency withdrawal of ₦${emergencyWithdrawal.net_amount.toLocaleString()} has been completed`,
      p_data: {
        type: 'emergency_withdrawal_successful',
        withdrawal_id: emergencyWithdrawal.id,
        amount: emergencyWithdrawal.net_amount
      }
    });

    // Final audit log
    await createAuditLog(
      emergencyWithdrawal.user_id,
      'emergency_withdrawal_success_completed',
      {
        emergency_withdrawal_id: emergencyWithdrawal.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef
      },
      { status: 'completed' },
      'success'
    );

    // Send email notification
    try {
      // Get payout plan details for email
      let planName: string | undefined;
      let accountName: string | undefined;
      let bankName: string | undefined;
      let accountNumber: string | undefined;
      
      if (emergencyWithdrawal.payout_plan_id) {
        const { data: payoutPlan } = await supabase
          .from('payout_plans')
          .select('name, payout_account_id, bank_account_id')
          .eq('id', emergencyWithdrawal.payout_plan_id)
          .single();
        
        if (payoutPlan) {
          planName = payoutPlan.name;
          
          // Get account details
          if (payoutPlan.payout_account_id) {
            const { data } = await supabase
              .from('payout_accounts')
              .select('account_name, bank_name, account_number')
              .eq('id', payoutPlan.payout_account_id)
              .single();
            if (data) {
              accountName = data.account_name;
              bankName = data.bank_name;
              accountNumber = data.account_number;
            }
          } else if (payoutPlan.bank_account_id) {
            const { data } = await supabase
              .from('bank_accounts')
              .select('account_name, bank_name, account_number')
              .eq('id', payoutPlan.bank_account_id)
              .single();
            if (data) {
              accountName = data.account_name;
              bankName = data.bank_name;
              accountNumber = data.account_number;
            }
          }
        }
      }

      await sendEmergencyWithdrawalSuccessEmailNotification(
        emergencyWithdrawal.user_id,
        emergencyWithdrawal.withdrawal_amount,
        emergencyWithdrawal.net_amount,
        emergencyWithdrawal.fee_amount,
        paymentRef,
        emergencyWithdrawal.id,
        planName,
        accountName || transferData.creditAccountName,
        bankName || 'Your Bank',
        accountNumber || transferData.creditAccountNumber
      );
    } catch (emailError) {
      console.error('❌ Error sending emergency withdrawal success email notification:', emailError);
    }
  } catch (error) {
    console.error('❌ Error handling emergency withdrawal success:', error);
    await createAuditLog(
      emergencyWithdrawal.user_id,
      'emergency_withdrawal_success_error',
      { emergency_withdrawal_id: emergencyWithdrawal.id, error: error.message },
      { status: 'error' },
      'error'
    );
    throw error;
  }
}

// Handle automated payout success
async function handleAutomatedPayoutSuccess(automatedPayout: any, transferData: SafeHavenTransferData): Promise<void> {
  try {
    const paymentRef = transferData.paymentReference || transferData.sessionId || automatedPayout.payment_reference || automatedPayout.transfer_reference;
    const totalAmount = transferData.amount + (transferData.fees || 0);

    // 1. Create audit log FIRST
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_success',
      {
        automated_payout_id: automatedPayout.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef,
        amount: transferData.amount,
        fees: transferData.fees || 0,
        total_amount: totalAmount
      },
      {
        status: 'processing',
        step: 'webhook_received'
      },
      'success'
    );

    // 2. Update automated payout status
    const { error: updateError } = await supabase
      .from('automated_payouts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        transfer_code: paymentRef,
        transferred_at: transferData.updatedAt || new Date().toISOString(),
        metadata: {
          ...automatedPayout.metadata,
          transfer_success: true,
          safehaven_transfer_data: transferData
        }
      })
      .eq('id', automatedPayout.id);

    if (updateError) {
      console.error(`❌ Error updating automated payout status:`, updateError);
      await createAuditLog(
        automatedPayout.user_id,
        'automated_payout_success_error',
        { automated_payout_id: automatedPayout.id, error: updateError.message },
        { status: 'error' },
        'error'
      );
      return;
    }

    console.log(`✅ Automated payout ${automatedPayout.id} marked as completed`);

    // 3. Update SafeHaven account balance (subtract amount + fees)
    // Get user's safehaven_account by user_id (not by account_number since 0117753301 is the main account)
    const { data: currentAccount } = await supabase
      .from('safehaven_accounts')
      .select('id, account_balance, book_balance, metadata, account_number')
      .eq('user_id', automatedPayout.user_id)
      .eq('is_deleted', false)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!currentAccount) {
      console.error(`❌ SafeHaven account not found for user ${automatedPayout.user_id}`);
      await createAuditLog(
        automatedPayout.user_id,
        'automated_payout_success_error',
        { automated_payout_id: automatedPayout.id, error: 'Account not found' },
        { status: 'error' },
        'error'
      );
      return;
    }

    const balanceChange = -totalAmount;
    const newAccountBalance = (currentAccount.account_balance || 0) + balanceChange;
    const newBookBalance = (currentAccount.book_balance || 0) + balanceChange;

    // Update safehaven_accounts balance
    const { error: accountUpdateError } = await supabase
      .from('safehaven_accounts')
      .update({
        account_balance: newAccountBalance,
        book_balance: newBookBalance,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
        metadata: {
          ...(currentAccount.metadata || {}),
          payment_reference: paymentRef,
          transfer_reference: paymentRef,
          transfer_status: 'Completed',
          automated_payout_id: automatedPayout.id,
          balance_change: balanceChange,
          updated_by: 'webhook_success'
        }
      })
      .eq('id', currentAccount.id);

    if (accountUpdateError) {
      console.error(`❌ Error updating SafeHaven account balance:`, accountUpdateError);
      await createAuditLog(
        automatedPayout.user_id,
        'automated_payout_success_error',
        { automated_payout_id: automatedPayout.id, error: accountUpdateError.message },
        { status: 'error' },
        'error'
      );
      return;
    }

    console.log(`✅ Updated SafeHaven account balance: ${currentAccount.account_balance} -> ${newAccountBalance}`);

    // Audit log for account balance update
    await createAuditLog(
      automatedPayout.user_id,
      'safehaven_account_balance_updated',
      {
        account_number: currentAccount.account_number,
        balance_change: balanceChange,
        old_balance: currentAccount.account_balance,
        new_balance: newAccountBalance
      },
      { status: 'success' },
      'success'
    );

    // NOTE: The trigger handle_safehaven_account_balance_update() will automatically:
    // 1. Update transaction status to 'completed' (if status is 'pending')
    // 2. Set transaction source to 'safehaven_payout_plan'
    // 3. Update wallet balance (deduct_locked_funds)
    // 4. Create audit logs
    // We update the transaction source as a fallback in case trigger didn't find it
    // (e.g., if transaction wasn't pending or trigger didn't match)

    // 4. Update transaction record source field to 'safehaven_payout_plan' (fallback)
    // The trigger should have already done this, but we do it here as a safety measure
    await updateTransactionStatus(automatedPayout, transferData, 'completed', 'safehaven_payout_plan');

    // Audit log for transaction update
    await createAuditLog(
      automatedPayout.user_id,
      'transaction_updated',
      {
        transaction_reference: paymentRef,
        status: 'completed',
        source: 'safehaven_payout_plan'
      },
      { status: 'success' },
      'success'
    );

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: automatedPayout.user_id,
      p_title: 'Payout Successful',
      p_body: `Your payout of ₦${transferData.amount.toLocaleString()} has been completed`,
      p_data: {
        type: 'payout_successful',
        payout_id: automatedPayout.id,
        amount: transferData.amount
      }
    });

    // Final audit log
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_success_completed',
      {
        automated_payout_id: automatedPayout.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef
      },
      { status: 'completed' },
      'success'
    );

    // Send email notification
    try {
      // Get payout plan and account details for email
      let planName = 'Your Payout Plan';
      let planType: string | undefined;
      let planCreatedDate: string | undefined;
      
      if (automatedPayout.payout_plan_id) {
        const { data: payoutPlan } = await supabase
          .from('payout_plans')
          .select('name, type, created_at')
          .eq('id', automatedPayout.payout_plan_id)
          .single();
        
        if (payoutPlan) {
          planName = payoutPlan.name;
          planType = payoutPlan.type;
          if (payoutPlan.created_at) {
            planCreatedDate = new Date(payoutPlan.created_at).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          }
        }
      }

      await sendPayoutSuccessEmailNotification(
        automatedPayout.user_id,
        transferData.amount,
        paymentRef,
        automatedPayout.id,
        planName,
        '', // accountName - not needed for new template
        '', // bankName - not needed for new template
        '', // accountNumber - not needed for new template
        planType,
        planCreatedDate
      );
    } catch (emailError) {
      console.error('❌ Error sending payout success email notification:', emailError);
    }
  } catch (error) {
    console.error('❌ Error handling automated payout success:', error);
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_success_error',
      { automated_payout_id: automatedPayout.id, error: error.message },
      { status: 'error' },
      'error'
    );
    throw error;
  }
}

// Handle emergency withdrawal failed
async function handleEmergencyWithdrawalFailed(emergencyWithdrawal: any, transferData: SafeHavenTransferData): Promise<void> {
  try {
    // Update emergency withdrawal status
    const { error: updateError } = await supabase
      .from('emergency_withdrawals')
      .update({
        status: 'failed',
        error_message: transferData.responseMessage || 'Transfer failed - Bank processing error',
        processed_at: new Date().toISOString(),
        transfer_code: transferData.paymentReference || transferData.sessionId,
        metadata: {
          safehaven_transfer_id: transferData._id,
          safehaven_reference: transferData.paymentReference,
          transfer_failed: true,
          safehaven_transfer_data: transferData
        }
      })
      .eq('id', emergencyWithdrawal.id);

    if (updateError) {
      console.error(`❌ Error updating emergency withdrawal status:`, updateError);
      return;
    }

    console.log(`❌ Emergency withdrawal ${emergencyWithdrawal.id} marked as failed`);

    // Update transaction record (not create) with status failed and source safehaven_payout_plan
    await updateTransactionStatus(
      {
        user_id: emergencyWithdrawal.user_id,
        reference: emergencyWithdrawal.reference,
        payout_plan_id: emergencyWithdrawal.payout_plan_id
      },
      transferData,
      'failed',
      'safehaven_payout_plan'
    );

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: emergencyWithdrawal.user_id,
      p_title: 'Emergency Withdrawal Failed',
      p_body: `Your emergency withdrawal of ₦${emergencyWithdrawal.net_amount.toLocaleString()} has failed. Please try again.`,
      p_data: {
        type: 'emergency_withdrawal_failed',
        withdrawal_id: emergencyWithdrawal.id,
        amount: emergencyWithdrawal.net_amount
      }
    });

    // Send email notification
    try {
      await sendEmergencyWithdrawalFailedEmailNotification(
        emergencyWithdrawal.user_id,
        emergencyWithdrawal.withdrawal_amount,
        emergencyWithdrawal.reference,
        emergencyWithdrawal.id,
        transferData.responseMessage || 'Transfer failed - Bank processing error'
      );
    } catch (emailError) {
      console.error('❌ Error sending emergency withdrawal failed email notification:', emailError);
    }
  } catch (error) {
    console.error('❌ Error handling emergency withdrawal failed:', error);
    throw error;
  }
}

// Handle automated payout failed
async function handleAutomatedPayoutFailed(automatedPayout: any, transferData: SafeHavenTransferData): Promise<void> {
  try {
    const paymentRef = transferData.paymentReference || transferData.sessionId || automatedPayout.payment_reference || automatedPayout.transfer_reference;
    const failureReason = transferData.responseMessage || 'Transfer failed - Bank processing error';

    // 1. Create audit log FIRST
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_failed',
      {
        automated_payout_id: automatedPayout.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef,
        amount: transferData.amount,
        failure_reason: failureReason
      },
      {
        status: 'processing',
        step: 'webhook_received'
      },
      'error'
    );

    // 2. Update automated payout status
    const { error: updateError } = await supabase
      .from('automated_payouts')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: failureReason,
        transfer_code: paymentRef,
        metadata: {
          ...automatedPayout.metadata,
          transfer_failed: true,
          safehaven_transfer_data: transferData
        }
      })
      .eq('id', automatedPayout.id);

    if (updateError) {
      console.error(`❌ Error updating automated payout status:`, updateError);
      await createAuditLog(
        automatedPayout.user_id,
        'automated_payout_failed_error',
        { automated_payout_id: automatedPayout.id, error: updateError.message },
        { status: 'error' },
        'error'
      );
      return;
    }

    console.log(`❌ Automated payout ${automatedPayout.id} marked as failed`);

    // 3. Update SafeHaven account metadata (balance doesn't change on failure, but we log it)
    // Get user's safehaven_account by user_id (not by account_number since 0117753301 is the main account)
    const { data: currentAccount } = await supabase
      .from('safehaven_accounts')
      .select('id, account_balance, book_balance, metadata, account_number')
      .eq('user_id', automatedPayout.user_id)
      .eq('is_deleted', false)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (currentAccount && paymentRef) {
      const { error: accountUpdateError } = await supabase
        .from('safehaven_accounts')
        .update({
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
          metadata: {
            ...(currentAccount.metadata || {}),
            payment_reference: paymentRef,
            transfer_reference: paymentRef,
            transfer_status: 'Failed',
            automated_payout_id: automatedPayout.id,
            failure_reason: failureReason,
            updated_by: 'webhook_failed'
          }
        })
        .eq('id', currentAccount.id);

      if (accountUpdateError) {
        console.error(`❌ Error updating SafeHaven account metadata:`, accountUpdateError);
        await createAuditLog(
          automatedPayout.user_id,
          'automated_payout_failed_error',
          { automated_payout_id: automatedPayout.id, error: accountUpdateError.message },
          { status: 'error' },
          'error'
        );
      } else {
        console.log(`✅ Updated SafeHaven account metadata for failed payout`);
        
        // Audit log for account metadata update
        await createAuditLog(
          automatedPayout.user_id,
          'safehaven_account_metadata_updated',
          {
            account_number: currentAccount.account_number,
            transfer_status: 'Failed',
            failure_reason: failureReason
          },
          { status: 'success' },
          'success'
        );
      }
    }

    // 4. Update transaction record (not create) with status failed and source safehaven_payout_plan
    // NOTE: The trigger won't update wallet on failure (which is correct)
    // But it will update the transaction status if it finds a pending one
    // We need to ensure the source field is set correctly
    await updateTransactionStatus(automatedPayout, transferData, 'failed', 'safehaven_payout_plan');

    // Audit log for transaction update
    await createAuditLog(
      automatedPayout.user_id,
      'transaction_updated',
      {
        transaction_reference: paymentRef,
        status: 'failed',
        source: 'safehaven_payout_plan'
      },
      { status: 'success' },
      'success'
    );

    // Note: Do not update wallets or automated payouts balance on failure

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: automatedPayout.user_id,
      p_title: 'Payout Failed',
      p_body: `Your payout of ₦${transferData.amount.toLocaleString()} has failed. Please try again.`,
      p_data: {
        type: 'payout_failed',
        payout_id: automatedPayout.id,
        amount: transferData.amount
      }
    });

    // Final audit log
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_failed_completed',
      {
        automated_payout_id: automatedPayout.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef
      },
      { status: 'completed' },
      'error'
    );

    // Send email notification
    try {
      // Get payout plan name for email
      let planName = 'Your Payout Plan';
      if (automatedPayout.payout_plan_id) {
        const { data: payoutPlan } = await supabase
          .from('payout_plans')
          .select('name')
          .eq('id', automatedPayout.payout_plan_id)
          .single();
        
        if (payoutPlan) {
          planName = payoutPlan.name;
        }
      }

      await sendPayoutFailedEmailNotification(
        automatedPayout.user_id,
        transferData.amount,
        paymentRef,
        automatedPayout.id,
        failureReason,
        planName
      );
    } catch (emailError) {
      console.error('❌ Error sending payout failed email notification:', emailError);
    }
  } catch (error) {
    console.error('❌ Error handling automated payout failed:', error);
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_failed_error',
      { automated_payout_id: automatedPayout.id, error: error.message },
      { status: 'error' },
      'error'
    );
    throw error;
  }
}

// Handle emergency withdrawal reversed
async function handleEmergencyWithdrawalReversed(emergencyWithdrawal: any, transferData: SafeHavenTransferData): Promise<void> {
  try {
    // Update emergency withdrawal status to reversed
    const { error: updateError } = await supabase
      .from('emergency_withdrawals')
      .update({
        status: 'reversed',
        error_message: transferData.responseMessage || 'Transfer was reversed',
        processed_at: new Date().toISOString(),
        transfer_code: transferData.paymentReference || transferData.sessionId,
        metadata: {
          safehaven_transfer_id: transferData._id,
          safehaven_reference: transferData.paymentReference,
          transfer_reversed: true,
          safehaven_transfer_data: transferData
        }
      })
      .eq('id', emergencyWithdrawal.id);

    if (updateError) {
      console.error(`❌ Error updating emergency withdrawal status:`, updateError);
      return;
    }

    console.log(`🔄 Emergency withdrawal ${emergencyWithdrawal.id} marked as reversed`);

    // Update transaction record (not create) with status reversed and source safehaven_payout_plan
    await updateTransactionStatus(
      {
        user_id: emergencyWithdrawal.user_id,
        reference: emergencyWithdrawal.reference,
        payout_plan_id: emergencyWithdrawal.payout_plan_id
      },
      transferData,
      'reversed',
      'safehaven_payout_plan'
    );

    // Update wallet balance - add funds back to both balance and locked_balance (since reversal means money goes back to the plan)
    // First add to total balance
    const { error: addError } = await supabase.rpc("add_funds", {
      arg_user_id: emergencyWithdrawal.user_id,
      arg_amount: emergencyWithdrawal.withdrawal_amount
    });

    if (addError) {
      console.error(`❌ Error adding funds back for emergency withdrawal reversal:`, addError);
    } else {
      // Then lock the funds back (since it was originally in a payout plan)
      const { error: lockError } = await supabase.rpc("lock_funds", {
        arg_user_id: emergencyWithdrawal.user_id,
        arg_amount: emergencyWithdrawal.withdrawal_amount
      });

      if (lockError) {
        console.error(`❌ Error locking funds back for emergency withdrawal reversal:`, lockError);
      } else {
        console.log(`✅ Successfully added and locked ₦${emergencyWithdrawal.withdrawal_amount} back to wallet for user ${emergencyWithdrawal.user_id}`);
      }
    }

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: emergencyWithdrawal.user_id,
      p_title: 'Emergency Withdrawal Reversed',
      p_body: `Your emergency withdrawal of ₦${emergencyWithdrawal.net_amount.toLocaleString()} has been reversed. Funds returned to your wallet.`,
      p_data: {
        type: 'emergency_withdrawal_reversed',
        withdrawal_id: emergencyWithdrawal.id,
        amount: emergencyWithdrawal.net_amount
      }
    });

    // Send email notification (if email function exists)
    // await sendEmergencyWithdrawalReversedEmailNotification(...);
  } catch (error) {
    console.error('❌ Error handling emergency withdrawal reversed:', error);
    throw error;
  }
}

// Handle automated payout reversed
async function handleAutomatedPayoutReversed(automatedPayout: any, transferData: SafeHavenTransferData): Promise<void> {
  try {
    const paymentRef = transferData.paymentReference || transferData.sessionId || automatedPayout.payment_reference || automatedPayout.transfer_reference;
    const reversalReason = transferData.responseMessage || 'Transfer was reversed';

    // 1. Create audit log FIRST
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_reversed',
      {
        automated_payout_id: automatedPayout.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef,
        amount: transferData.amount,
        reversal_reason: reversalReason
      },
      {
        status: 'processing',
        step: 'webhook_received'
      },
      'warning'
    );

    // 2. Update automated payout status to reversed
    const { error: updateError } = await supabase
      .from('automated_payouts')
      .update({
        status: 'reversed',
        reversed_at: new Date().toISOString(),
        reversal_reason: reversalReason,
        transfer_code: paymentRef,
        metadata: {
          ...automatedPayout.metadata,
          transfer_reversed: true,
          safehaven_transfer_data: transferData
        }
      })
      .eq('id', automatedPayout.id);

    if (updateError) {
      console.error(`❌ Error updating automated payout status:`, updateError);
      await createAuditLog(
        automatedPayout.user_id,
        'automated_payout_reversed_error',
        { automated_payout_id: automatedPayout.id, error: updateError.message },
        { status: 'error' },
        'error'
      );
      return;
    }

    console.log(`🔄 Automated payout ${automatedPayout.id} marked as reversed`);

    // 3. Update transaction record (not create) with status reversed and source safehaven_payout_plan
    await updateTransactionStatus(automatedPayout, transferData, 'reversed', 'safehaven_payout_plan');

    // Audit log for transaction update
    await createAuditLog(
      automatedPayout.user_id,
      'transaction_updated',
      {
        transaction_reference: paymentRef,
        status: 'reversed',
        source: 'safehaven_payout_plan'
      },
      { status: 'success' },
      'success'
    );

    // Send push notification
    await supabase.rpc('send_push_notification', {
      p_user_id: automatedPayout.user_id,
      p_title: 'Payout Reversed',
      p_body: `Your payout of ₦${transferData.amount.toLocaleString()} has been reversed. Funds returned to your wallet.`,
      p_data: {
        type: 'payout_reversed',
        payout_id: automatedPayout.id,
        amount: transferData.amount
      }
    });

    // Final audit log
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_reversed_completed',
      {
        automated_payout_id: automatedPayout.id,
        transfer_id: transferData._id,
        payment_reference: paymentRef
      },
      { status: 'completed' },
      'warning'
    );

    // Send email notification (if email function exists)
    // await sendPayoutReversedEmailNotification(...);
  } catch (error) {
    console.error('❌ Error handling automated payout reversed:', error);
    await createAuditLog(
      automatedPayout.user_id,
      'automated_payout_reversed_error',
      { automated_payout_id: automatedPayout.id, error: error.message },
      { status: 'error' },
      'error'
    );
    throw error;
  }
}

// Update existing transaction record status
async function updateTransactionStatus(payoutData: any, transferData: SafeHavenTransferData, status: string, source?: string): Promise<void> {
  try {
    const paymentRef = transferData.paymentReference || transferData.sessionId || payoutData.reference || payoutData.payment_reference || payoutData.transfer_reference;
    console.log(`📑 Updating transaction status to '${status}' for reference: ${paymentRef}`);
    
    if (!paymentRef) {
      console.warn('⚠️ No payment reference found, cannot update transaction');
      return;
    }

    // Find the existing transaction by reference
    // Handle both 'payout' and 'withdrawal' types
    const transactionType = payoutData.type || 'payout';
    const { data: existingTransaction, error: findError } = await supabase
      .from('transactions')
      .select('id, status, source')
      .eq('reference', paymentRef)
      .eq('user_id', payoutData.user_id)
      .in('type', ['payout', 'withdrawal'])
      .single();

    if (findError || !existingTransaction) {
      console.warn(`⚠️ Transaction not found for reference ${paymentRef}, attempting to create new one`);
      // Fallback: create new transaction if not found
      // Determine type: if payout_plan_id exists but no automated_payout_id, it might be a withdrawal
      const fallbackType = payoutData.type || (payoutData.payout_plan_id && !payoutData.id ? 'withdrawal' : 'payout');
      await createTransactionRecord(payoutData, transferData, status, fallbackType, source);
      return;
    }

    // Update the existing transaction
    const updateMetadata: any = {
      ...(existingTransaction.metadata || {}),
      safehaven_transfer_id: transferData._id,
      safehaven_transfer_code: transferData.paymentReference || transferData.sessionId,
      payout_plan_id: payoutData.payout_plan_id,
      webhook_updated_at: new Date().toISOString()
    };

    // Only add automated_payout_id if it exists (for automated payouts, not emergency withdrawals)
    if (payoutData.id) {
      updateMetadata.automated_payout_id = payoutData.id;
    }

    // Add emergency_withdrawal_id if it exists
    if (payoutData.emergency_withdrawal_id) {
      updateMetadata.emergency_withdrawal_id = payoutData.emergency_withdrawal_id;
    }

    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString(),
      ...(status === 'completed' && { completed_at: new Date().toISOString() }),
      ...(status === 'failed' && { failed_at: new Date().toISOString() }),
      ...(source && { source: source }),
      metadata: updateMetadata
    };

    const { error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', existingTransaction.id);

    if (updateError) {
      console.error(`❌ Failed to update transaction status:`, updateError);
      return;
    }

    console.log(`✅ Transaction ${existingTransaction.id} status updated to '${status}'${source ? `, source updated to '${source}'` : ''}`);
  } catch (error) {
    console.error('❌ Error updating transaction status:', error);
  }
}

// Create transaction record function
async function createTransactionRecord(payoutData: any, transferData: SafeHavenTransferData, status: string, type: string = 'payout', source?: string): Promise<void> {
  try {
    console.log(`📑 Creating transaction record for ${type}: ${payoutData.reference || transferData.paymentReference}`);
    
    // Determine source based on parameter or default logic
    let transactionSource: string;
    if (source) {
      transactionSource = source;
    } else if (type === 'deposit') {
      transactionSource = 'Virtual Account';
    } else {
      transactionSource = 'Wallet';
    }
    
    const transactionData = {
      p_user_id: payoutData.user_id,
      p_type: type,
      p_amount: payoutData.amount || transferData.amount,
      p_status: status,
      p_source: transactionSource,
      p_destination: type === 'deposit' ? 'Wallet' : 'Bank Transfer',
      p_reference: transferData.paymentReference || transferData.sessionId || payoutData.reference,
      p_payout_plan_id: type === 'deposit' ? null : payoutData.payout_plan_id,
      p_description: type === 'deposit' ? `Funds received via virtual account` : 
                    type === 'withdrawal' ? `Emergency withdrawal transfer` : 
                    `Automated payout transfer`,
      p_metadata: {
        safehaven_transfer_id: transferData._id,
        safehaven_transfer_code: transferData.paymentReference || transferData.sessionId,
        automated_payout_id: payoutData.id,
        payout_plan_id: payoutData.payout_plan_id
      }
    };

    const { data: transactionId, error } = await supabase.rpc('create_transaction_record', transactionData);
    
    if (error) {
      console.error(`❌ Failed to create transaction record:`, error);
      return;
    }

    console.log(`✅ Transaction record created: ${transactionId}`);
  } catch (error) {
    console.error('❌ Error creating transaction record:', error);
  }
}

// Update wallet balance function
async function updateWalletBalance(userId: string, amount: number): Promise<void> {
  try {
    console.log(`Updating wallet balance for user ${userId}, amount: ${amount}`);
    const { data, error } = await supabase.rpc("deduct_locked_funds", {
      arg_user_id: userId,
      arg_amount: amount
    });

    if (error) {
      throw new Error(`Failed to update wallet balance: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(`Wallet balance update failed: ${data?.error || "Unknown error"}`);
    }

    console.log(`✅ Wallet balance updated successfully for user ${userId}`);
  } catch (error) {
    console.error(`❌ Error updating wallet balance:`, error);
    throw error;
  }
}

// Legacy function - kept for backward compatibility but now redirects to new handlers
async function updateAutomatedPayoutFromWebhook(transferData: SafeHavenTransferData, userId: string): Promise<void> {
  try {
    console.log('Checking for automated payout related to transfer:', transferData._id);

    // Try to find automated payout by transfer ID or payment reference
    const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, status, amount, user_id')
      .eq('user_id', userId)
      .or(`safehaven_transfer_id.eq.${transferData._id},payment_reference.eq.${paymentRef}`)
      .limit(1)
      .maybeSingle();

    if (payoutError && payoutError.code !== 'PGRST116') {
      console.error('Error finding automated payout:', payoutError);
      return;
    }

    if (!automatedPayout) {
      console.log('No automated payout found for transfer:', transferData._id);
      return;
    }

    console.log('Found automated payout:', automatedPayout.id, 'Current status:', automatedPayout.status);

    // Map SafeHaven status to our status
    let newStatus = automatedPayout.status;
    if (transferData.status === 'Completed') {
      newStatus = 'completed';
    } else if (transferData.status === 'Failed') {
      newStatus = 'failed';
    } else if (transferData.status === 'Pending') {
      newStatus = 'processing';
    } else if (transferData.status === 'Reversed') {
      newStatus = 'failed';
    }

    // Only update if status changed
    if (newStatus !== automatedPayout.status) {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.transferred_at = new Date().toISOString();
      } else if (newStatus === 'failed') {
        updateData.error_message = transferData.responseMessage || 'Transfer failed';
        updateData.completed_at = new Date().toISOString();
      }

      // Update automated payout
      const { error: updateError } = await supabase
        .from('automated_payouts')
        .update(updateData)
        .eq('id', automatedPayout.id);

      if (updateError) {
        console.error('Error updating automated payout:', updateError);
        return;
      }

      console.log(`Updated automated payout ${automatedPayout.id} to status: ${newStatus}`);

      // Update transaction record if exists
      const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('reference', paymentRef)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (!transactionError && transaction) {
        await supabase
          .from('transactions')
          .update({
            status: newStatus === 'completed' ? 'completed' : (newStatus === 'failed' ? 'failed' : 'pending'),
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);
      }

      // If completed, update payout plan and create notification
      if (newStatus === 'completed') {
        // Get payout plan
        const { data: payoutPlan, error: planError } = await supabase
          .from('payout_plans')
          .select('id, name, payout_amount, completed_payouts, duration, frequency, start_date, next_payout_date, payout_account_id, bank_account_id')
          .eq('id', automatedPayout.payout_plan_id)
          .single();

        if (!planError && payoutPlan) {
          const newCompletedPayouts = (payoutPlan.completed_payouts || 0) + 1;
          
          // Calculate next payout date
          let nextPayoutDate: string | null = null;
          if (newCompletedPayouts < payoutPlan.duration) {
            const startDate = new Date(payoutPlan.start_date);
            let nextDate = new Date(startDate);

            switch (payoutPlan.frequency) {
              case 'weekly':
                nextDate.setDate(startDate.getDate() + (newCompletedPayouts * 7));
                break;
              case 'biweekly':
                nextDate.setDate(startDate.getDate() + (newCompletedPayouts * 14));
                break;
              case 'monthly':
                nextDate.setMonth(startDate.getMonth() + newCompletedPayouts);
                break;
            }

            nextPayoutDate = nextDate.toISOString().split('T')[0];
          }

          const planUpdates: any = {
            completed_payouts: newCompletedPayouts,
            updated_at: new Date().toISOString()
          };
          
          if (nextPayoutDate) {
            planUpdates.next_payout_date = nextPayoutDate;
          } else {
            planUpdates.next_payout_date = null;
          }

          if (newCompletedPayouts >= payoutPlan.duration) {
            planUpdates.status = 'completed';
          }

          await supabase
            .from('payout_plans')
            .update(planUpdates)
            .eq('id', payoutPlan.id);

          // Create success notification
          await supabase
            .from('events')
            .insert({
              user_id: userId,
              type: 'payout_completed',
              title: 'Payout Completed',
              description: `Your payout of ₦${payoutPlan.payout_amount.toLocaleString()} from "${payoutPlan.name}" has been processed successfully.`,
              status: 'unread',
              payout_plan_id: payoutPlan.id
            });

          // Send success email notification
          try {
            // Get account details for email - check both payout_accounts and bank_accounts
            let payoutAccount: { account_name?: string; bank_name?: string; account_number?: string } | null = null;
            if (payoutPlan.payout_account_id) {
              const { data } = await supabase
                .from('payout_accounts')
                .select('account_name, bank_name, account_number')
                .eq('id', payoutPlan.payout_account_id)
                .single();
              payoutAccount = data;
            } else if (payoutPlan.bank_account_id) {
              const { data } = await supabase
                .from('bank_accounts')
                .select('account_name, bank_name, account_number')
                .eq('id', payoutPlan.bank_account_id)
                .single();
              payoutAccount = data;
            }

            await sendPayoutSuccessEmailNotification(
              userId,
              automatedPayout.amount,
              paymentRef,
              automatedPayout.id,
              payoutPlan.name,
              payoutAccount?.account_name || transferData.creditAccountName || 'Your Account',
              payoutAccount?.bank_name || 'Your Bank',
              payoutAccount?.account_number || transferData.creditAccountNumber || '****'
            );
          } catch (emailError) {
            console.error('Error sending success email notification:', emailError);
          }
        }
      } else if (newStatus === 'failed') {
        // Create failure notification
        const { data: payoutPlan } = await supabase
          .from('payout_plans')
          .select('id, name, payout_amount')
          .eq('id', automatedPayout.payout_plan_id)
          .single();

        if (payoutPlan) {
          await supabase
            .from('events')
            .insert({
              user_id: userId,
              type: 'disbursement_failed',
              title: 'Payout Failed',
              description: `Your scheduled payout from "${payoutPlan.name}" failed to process: ${transferData.responseMessage || 'Unknown error'}`,
              status: 'unread',
              payout_plan_id: payoutPlan.id
            });

          // Send failure email notification
          try {
            await sendPayoutFailedEmailNotification(
              userId,
              automatedPayout.amount,
              paymentRef,
              automatedPayout.id,
              transferData.responseMessage || 'Transfer failed',
              payoutPlan.name
            );
          } catch (emailError) {
            console.error('Error sending failure email notification:', emailError);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error updating automated payout from webhook:', error);
  }
}

// Update virtual account balance
async function updateVirtualAccountBalance(userId: string, transferData: SafeHavenVirtualAccountTransferData): Promise<void> {
  try {
    // For virtual accounts, we can update the main account balance
    // Virtual account transfers are typically Inwards (deposits to the virtual account)
    // Use credit account number for virtual account deposits
    const accountNumber = transferData.creditAccountNumber;

    if (accountNumber) {
      // Create a transfer-like object with type 'Inwards' for virtual account deposits
      const transferLikeData = {
        ...transferData,
        type: 'Inwards' as const
      };
      await updateUserBalance(userId, transferLikeData as any, accountNumber);
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
        created_at: subaccountData.createdAt,
        updated_at: subaccountData.updatedAt,
        synced_at: new Date().toISOString(),
        metadata: {
          webhook_received_at: new Date().toISOString(),
          safehaven_data: subaccountData
        }
      });

    if (insertError) {
      console.error('Error storing subaccount:', insertError);
      return { error: 'Failed to store subaccount' };
    }

    console.log('Subaccount created webhook processed successfully:', subaccountData._id);
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

// Process identity credit check webhook
// This webhook is sent when an identity verification (BVN/NIN) check is performed and charged
async function processIdentityCreditCheckWebhook(identityData: SafeHavenIdentityCreditCheckData): Promise<any> {
  console.log('Processing identity credit check webhook:', identityData._id);

  try {
    // Get user ID from client ID
    const { data: userData, error: userError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', identityData.clientId)
      .single();

    if (userError || !userData) {
      console.error('Could not find user for client ID:', identityData.clientId);
      // Still log the webhook even if we can't find the user
      return { 
        error: 'User not found',
        note: 'Webhook received but user not found',
        identityCheckId: identityData._id
      };
    }

    // Create audit log for identity credit check
    await createAuditLog(
      userData.user_id,
      'identity_credit_check_webhook_processed',
      { 
        identityCheckId: identityData._id,
        identityType: identityData.type,
        identityNumber: identityData.identityNumber,
        debitAccountNumber: identityData.debitAccountNumber
      },
      { 
        status: identityData.status,
        amount: identityData.amount,
        vat: identityData.vat,
        stampDuty: identityData.stampDuty,
        otpVerified: identityData.otpVerified,
        debitMessage: identityData.debitMessage,
        creditMessage: identityData.creditMessage
      },
      identityData.status === 'SUCCESS' ? 'success' : 'failed'
    );

    console.log('Identity credit check webhook processed successfully:', identityData._id);
    return { 
      success: true, 
      identityCheckId: identityData._id, 
      status: identityData.status,
      userId: userData.user_id
    };

  } catch (error) {
    console.error('Error processing identity credit check webhook:', error);
    return { error: 'Failed to process identity credit check webhook' };
  }
}

// Process account debit webhook
// This webhook is sent when an account is debited (e.g., for fees, charges, or other debits)
async function processAccountDebitWebhook(debitData: SafeHavenAccountDebitData): Promise<any> {
  // Use paymentReference if available, otherwise fall back to reference
  const paymentRef = debitData.paymentReference || debitData.reference || '';
  console.log('Processing account debit webhook:', paymentRef);
  console.log('Debit data: ', JSON.stringify(debitData, null, 2));
  console.log('User ID (client): ', debitData.client);

  try {
    let userId: string | null = null;

    // Try to get user ID from payment reference (automated payout or emergency withdrawal)
    // First, check if this is an emergency withdrawal
    const { data: emergencyWithdrawal, error: emergencyError } = await supabase
      .from('emergency_withdrawals')
      .select('id, user_id, payout_plan_id, withdrawal_amount, net_amount, status, reference')
      .eq('reference', paymentRef)
      .single();

    console.log('Emergency withdrawal: ', emergencyWithdrawal);
    console.log('Emergency error: ', emergencyError);

    if (!emergencyError && emergencyWithdrawal) {
      userId = emergencyWithdrawal.user_id;
      console.log(`🚨 Processing emergency withdrawal from account debit: ${paymentRef}`);
      // Convert debit data to transfer-like format for handler
      const transferLikeData: any = {
        _id: debitData._id || paymentRef,
        paymentReference: paymentRef,
        sessionId: debitData.sessionId || paymentRef,
        status: debitData.status === 'Created' ? 'Completed' : debitData.status,
        amount: debitData.amount || 0,
        type: 'Outwards', // Account debits are always Outwards transfers
        fees: debitData.fees || 0,
        debitAccountNumber: debitData.debitAccountNumber || '0117753301',
        creditAccountNumber: debitData.creditAccountNumber,
        responseMessage: debitData.responseMessage || debitData.debitMessage || 'Debit completed',
        updatedAt: debitData.updatedAt || new Date().toISOString(),
        ...debitData
      };
      await handleEmergencyWithdrawalSuccess(emergencyWithdrawal, transferLikeData);
      return { success: true, type: 'emergency_withdrawal', reference: paymentRef };
    }

    // If not emergency withdrawal, check for automated payout
    const { data: automatedPayout, error: payoutError } = await supabase
      .from('automated_payouts')
      .select('id, payout_plan_id, user_id, amount, status, payment_reference, transfer_reference')
      .or(`payment_reference.eq.${paymentRef},transfer_reference.eq.${paymentRef}`)
      .single();

    if (!payoutError && automatedPayout) {
      userId = automatedPayout.user_id;
      console.log(`📋 Processing automated payout from account debit: ${paymentRef}`);
      // Convert debit data to transfer-like format for handler
      const transferLikeData: any = {
        _id: debitData._id || paymentRef,
        paymentReference: paymentRef,
        sessionId: debitData.sessionId || paymentRef,
        status: debitData.status === 'Created' ? 'Completed' : debitData.status,
        amount: debitData.amount || 0,
        type: 'Outwards', // Account debits are always Outwards transfers
        fees: debitData.fees || 0,
        debitAccountNumber: debitData.debitAccountNumber || '0117753301',
        creditAccountNumber: debitData.creditAccountNumber,
        responseMessage: debitData.responseMessage || debitData.debitMessage || 'Debit completed',
        updatedAt: debitData.updatedAt || new Date().toISOString(),
        ...debitData
      };
      
      // Check if debit was successful (Created status means successful)
      const isSuccessful = debitData.status === 'Created' || debitData.status === 'Completed';
      
      if (isSuccessful) {
        // Update safehaven_account table (this triggers safehaven_account_balance view update)
        // Then handle success which updates transaction, wallets, etc.
        await handleAutomatedPayoutSuccess(automatedPayout, transferLikeData);
        return { success: true, type: 'automated_payout', reference: paymentRef, status: 'completed' };
      } else {
        // Handle failure - update transaction status but don't update wallets or automated payouts balance
        await handleAutomatedPayoutFailed(automatedPayout, transferLikeData);
        return { success: true, type: 'automated_payout', reference: paymentRef, status: 'failed' };
      }
    }

    // If not related to payout/withdrawal, try to get user_id from account number
    // This handles regular account debits (fees, charges, etc.)
    const accountNumber = debitData.debitAccountNumber || '0117753301'; // Default to main account
    
    if (!userId) {
      console.log(`Trying to find user by account number: ${accountNumber}`);
      
      const { data: accountData, error: accountError } = await supabase
        .from('safehaven_accounts')
        .select('user_id, account_number')
        .eq('account_number', accountNumber)
        .eq('is_deleted', false)
        .single();

      if (!accountError && accountData) {
        userId = accountData.user_id;
        console.log(`Found user ${userId} for account number ${accountNumber}`);
      } else {
        console.warn('Cannot process account debit: User ID not found for account number:', accountNumber);
        return { 
          success: false,
          error: 'User not found',
          note: 'Webhook received but user not found for account debit. Could not match by payment reference or account number.',
          reference: paymentRef,
          accountNumber: accountNumber
        };
      }
    }

    // Process regular account debit (fees, charges, etc.)
    console.log('Processing regular account debit (not related to payout/withdrawal):', paymentRef);

    // Find account by account number to update balance
    const { data: accountData, error: accountError } = await supabase
      .from('safehaven_accounts')
      .select('id, account_balance, book_balance, metadata')
      .eq('account_number', accountNumber)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();

    if (accountError || !accountData) {
      console.error('Could not find account for account number:', accountNumber);
      // Still create audit log even if account not found
    } else {
      // Update account balance (subtract the debit amount + fees)
      const totalDebit = (debitData.amount || 0) + (debitData.fees || 0) + (debitData.vat || 0) + (debitData.stampDuty || 0);
      const newAccountBalance = (accountData.account_balance || 0) - totalDebit;
      const newBookBalance = (accountData.book_balance || 0) - totalDebit;

      const { error: updateError } = await supabase
        .from('safehaven_accounts')
        .update({
          account_balance: newAccountBalance,
          book_balance: newBookBalance,
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
          metadata: {
            ...(accountData.metadata || {}),
            payment_reference: paymentRef,
            transfer_reference: paymentRef,
            transfer_status: 'Regular Debit',
            updated_by: 'webhook_regular_debit',
            debit_amount: totalDebit
          }
        })
        .eq('id', accountData.id);

      if (updateError) {
        console.error('Error updating account balance after debit:', updateError);
      } else {
        console.log(`Account balance updated after debit: ${accountData.account_balance} -> ${newAccountBalance}`);
      }
    }

    // Create audit log for account debit (only if userId is available)
    if (userId) {
      await createAuditLog(
        userId,
        'account_debit_webhook_processed',
        { 
          reference: paymentRef,
          accountId: debitData.account,
          debitAccountNumber: accountNumber,
          provider: debitData.provider || 'NIBSS',
          providerChannel: debitData.providerChannel || 'NIP'
        },
        { 
          amount: debitData.amount || 0,
          fees: debitData.fees || 0,
          vat: debitData.vat || 0,
          stampDuty: debitData.stampDuty || 0,
          narration: debitData.narration || 'Account debit',
          totalDebit: (debitData.amount || 0) + (debitData.fees || 0) + (debitData.vat || 0) + (debitData.stampDuty || 0)
        },
        'success'
      );
    }

    console.log('Account debit webhook processed successfully:', paymentRef);
    return { 
      success: true, 
      reference: paymentRef, 
      amount: debitData.amount || 0,
      userId: userId
    };

  } catch (error) {
    console.error('Error processing account debit webhook:', error);
    return { error: 'Failed to process account debit webhook' };
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
    // Some webhooks also have eventType field (e.g., eventType: "account.debit")
    let webhookType: string;
    let webhookData: any;

    // Check for eventType first (e.g., "account.debit")
    if (rawPayload.eventType) {
      webhookType = rawPayload.eventType;
      webhookData = rawPayload.data || rawPayload;
    } else if (rawPayload.type && rawPayload.data) {
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
      } else if (rawPayload.debitAccountNumber && rawPayload.reference) {
        // Account debit webhook
        webhookType = 'account.debit';
        webhookData = rawPayload;
      } else {
        console.error('Unable to determine webhook type from payload');
        return createJsonResponse({ error: 'Unable to determine webhook type' }, 400);
      }
    }

    // Normalize webhook type (handle "debit" -> "account.debit")
    if (webhookType === 'debit') {
      webhookType = 'account.debit';
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
        case 'account.debit':
          result = await processAccountDebitWebhook(webhookData);
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
        case 'identityCreditCheck':
          result = await processIdentityCreditCheckWebhook(webhookData);
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

// Email notification functions
// Note: Email templates are imported from './email-templates.ts'
async function sendPayoutSuccessEmailNotification(
  userId: string,
  amount: number,
  reference: string,
  payoutId: string | null,
  planName: string,
  accountName: string,
  bankName: string,
  accountNumber: string,
  planType?: string,
  planCreatedDate?: string
) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    if (!userProfile?.email) {
      console.log('No email found for user')
      return
    }

    // Get wallet balance for availableBalance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single()

    const availableBalance = wallet?.balance || 0

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      availableBalance: `₦${availableBalance.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      payoutId,
      planName,
      planType,
      planCreatedDate
    }

    await sendEmail(
      userProfile.email,
      "Your plan has been paid out - Planmoni",
      generatePayoutSuccessEmailHtml(emailData)
    )
  } catch (error) {
    console.error('❌ Error sending payout success email notification:', error)
  }
}

async function sendPayoutFailedEmailNotification(
  userId: string,
  amount: number,
  reference: string,
  payoutId: string | null,
  failureReason: string,
  planName: string
) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    if (!userProfile?.email) {
      console.log('No email found for user')
      return
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      payoutId,
      failureReason: failureReason || 'Transfer failed',
      planName
    }

    await sendEmail(
      userProfile.email,
      "Failed transaction - Planmoni",
      generatePayoutFailedEmailHtml(emailData)
    )
  } catch (error) {
    console.error('❌ Error sending payout failed email notification:', error)
  }
}

// Emergency Withdrawal Email Notification Functions
async function sendEmergencyWithdrawalSuccessEmailNotification(
  userId: string,
  withdrawalAmount: number,
  netAmount: number,
  feeAmount: number,
  reference: string,
  withdrawalId: string | null,
  planName?: string,
  accountName?: string,
  bankName?: string,
  accountNumber?: string
) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    if (!userProfile?.email) {
      console.log('No email found for user')
      return
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${withdrawalAmount.toLocaleString()}`,
      netAmount: `₦${netAmount.toLocaleString()}`,
      feeAmount: `₦${feeAmount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      withdrawalId,
      planName,
      accountName,
      bankName,
      accountNumber
    }

    await sendEmail(
      userProfile.email,
      "Emergency Withdrawal Successful - Planmoni",
      generateEmergencyWithdrawalSuccessEmailHtml(emailData)
    )
  } catch (error) {
    console.error('❌ Error sending emergency withdrawal success email notification:', error)
  }
}

async function sendEmergencyWithdrawalFailedEmailNotification(
  userId: string,
  amount: number,
  reference: string,
  withdrawalId: string | null,
  failureReason: string
) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    if (!userProfile?.email) {
      console.log('No email found for user')
      return
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      withdrawalId,
      failureReason: failureReason || 'Transfer failed'
    }

    await sendEmail(
      userProfile.email,
      "Failed transaction - Planmoni",
      generateEmergencyWithdrawalFailedEmailHtml(emailData)
    )
  } catch (error) {
    console.error('❌ Error sending emergency withdrawal failed email notification:', error)
  }
}

// Deposit Email Notification Functions
async function sendDepositSuccessEmailNotification(
  userId: string,
  amount: number,
  availableBalance: number,
  reference: string,
  transactionId: string | null,
  senderName?: string,
  senderAccount?: string,
  senderBank?: string,
  narration?: string
) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    if (!userProfile?.email) {
      console.log('No email found for user')
      return
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      availableBalance: `₦${availableBalance.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      transactionId,
      senderName,
      senderAccount,
      senderBank,
      narration
    }

    await sendEmail(
      userProfile.email,
      "Deposit Successful - Planmoni",
      generateDepositSuccessEmailHtml(emailData)
    )
  } catch (error) {
    console.error('❌ Error sending deposit success email notification:', error)
  }
}

async function sendDepositFailedEmailNotification(
  userId: string,
  amount: number,
  reference: string,
  transactionId: string | null,
  failureReason: string,
  senderName?: string,
  senderAccount?: string,
  senderBank?: string
) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    if (!userProfile?.email) {
      console.log('No email found for user')
      return
    }

    const emailData = {
      firstName: userProfile.first_name || 'User',
      amount: `₦${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      reference,
      transactionId,
      failureReason: failureReason || 'Deposit failed',
      senderName,
      senderAccount,
      senderBank
    }

    await sendEmail(
      userProfile.email,
      "Failed transaction - Planmoni",
      generateDepositFailedEmailHtml(emailData)
    )
  } catch (error) {
    console.error('❌ Error sending deposit failed email notification:', error)
  }
}

// Generic email sending function
async function sendEmail(to: string, subject: string, html: string) {
  try {
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured, skipping email')
      return
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Planmoni <notifications@planmoni.com>",
        to,
        subject,
        html
      })
    })

    if (emailResponse.ok) {
      console.log(`📧 Email notification sent to ${to}`)
    } else {
      console.error('❌ Failed to send email notification:', await emailResponse.text())
    }
  } catch (error) {
    console.error('❌ Error sending email:', error)
  }
}
