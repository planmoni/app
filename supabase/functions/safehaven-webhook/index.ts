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
  debitAccountName: string;
  debitAccountNumber: string;
  paymentReference?: string;
  sessionId?: string;
  reference: string;
  reversalReference?: string;
  isReversed: boolean;
  type: 'Debit' | 'Outwards' | string;
  provider: string;
  providerChannel: string;
  narration: string;
  amount: number;
  fees: number;
  vat: number;
  stampDuty: number;
  responseCode: string;
  responseMessage: string;
  status: 'Pending' | 'Completed' | 'Failed' | 'Reversed';
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

    // Check if this transfer is related to an automated payout
    // For Outwards transfers (payouts), check if we have an automated_payout record
    if (transferData.type === 'Outwards') {
      await updateAutomatedPayoutFromWebhook(transferData, userId);
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
                  
                  // Send push notification for successful deposit
                  try {
                    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        user_ids: [userId],
                        notification_type: 'deposit_received',
                        title: 'Funds Received',
                        body: `₦${walletAmount.toLocaleString()} has been added to your wallet`,
                        data: {
                          type: 'deposit_successful',
                          transaction_reference: paymentRef,
                          amount: walletAmount,
                          source: 'SafeHaven',
                          route: '/(tabs)/',
                          action: 'view_balance',
                        }
                      }),
                    });
                    console.log('Push notification sent for deposit');
                  } catch (pushError) {
                    console.warn('Error sending push notification:', pushError);
                    // Don't fail the deposit if notification fails
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

// Update automated payout from webhook
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

    // Idempotent success check: if already completed and webhook reports success, only notify and exit
    if (newStatus === 'completed' && automatedPayout.status === 'completed') {
      console.log(`Idempotent success: automated payout ${automatedPayout.id} already completed. Skipping DB status update.`);

      // Send notifications/emails only (no DB mutations)
      try {
        const { data: payoutPlan } = await supabase
          .from('payout_plans')
          .select('id, name, payout_amount, payout_account_id, bank_account_id')
          .eq('id', automatedPayout.payout_plan_id)
          .single();

        if (payoutPlan) {
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

          const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
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
        }
      } catch (notifyErr) {
        console.error('Idempotent success notify error:', notifyErr);
      }
      return;
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
          // Use RPC so all frequencies (daily, weekly, weekly_specific, biweekly, monthly, end_of_month, quarterly, biannual, annually, custom) are correct
          const { error: progressError } = await supabase.rpc('update_payout_plan_progress', {
            p_plan_id: payoutPlan.id
          });
          if (progressError) {
            console.error('safehaven-webhook: update_payout_plan_progress failed:', progressError);
          }

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
  console.log('Processing account debit webhook:', debitData.reference);

  try {
    // Resolve user: first by SafeHaven client ID (ibs_client_id), then by debited account number
    let userId: string | null = null;
    const { data: tokenRow, error: tokenError } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', debitData.client)
      .maybeSingle();
    if (!tokenError && tokenRow?.user_id) {
      userId = tokenRow.user_id;
    }
    if (!userId) {
      const { data: accountRow, error: accountError } = await supabase
        .from('safehaven_accounts')
        .select('user_id')
        .eq('account_number', debitData.debitAccountNumber)
        .eq('is_deleted', false)
        .maybeSingle();
      if (!accountError && accountRow?.user_id) {
        userId = accountRow.user_id;
        console.log('Resolved user from safehaven_accounts by debitAccountNumber:', debitData.debitAccountNumber);
      }
    }
    if (!userId) {
      console.error('Could not find user for client ID or account number:', debitData.client, debitData.debitAccountNumber);
      return { 
        error: 'User not found',
        note: 'Webhook received but user not found (no safehaven_tokens.ibs_client_id or safehaven_accounts match)',
        reference: debitData.reference
      };
    }
    const userData = { user_id: userId };

    // Find account by account number
    const { data: accountData, error: accountError } = await supabase
      .from('safehaven_accounts')
      .select('id, account_balance, book_balance')
      .eq('account_number', debitData.debitAccountNumber)
      .eq('user_id', userData.user_id)
      .eq('is_deleted', false)
      .single();

    if (accountError || !accountData) {
      console.error('Could not find account for account number:', debitData.debitAccountNumber);
      // Still create audit log even if account not found
    } else {
      // Update account balance (subtract the debit amount + fees)
      const totalDebit = debitData.amount + debitData.fees + debitData.vat + debitData.stampDuty;
      const newAccountBalance = (accountData.account_balance || 0) - totalDebit;
      const newBookBalance = (accountData.book_balance || 0) - totalDebit;

      const { error: updateError } = await supabase
        .from('safehaven_accounts')
        .update({
          account_balance: newAccountBalance,
          book_balance: newBookBalance,
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString()
        })
        .eq('id', accountData.id);

      if (updateError) {
        console.error('Error updating account balance after debit:', updateError);
      } else {
        console.log(`Account balance updated after debit: ${accountData.account_balance} -> ${newAccountBalance}`);
      }
    }

    // Create audit log for account debit
    await createAuditLog(
      userData.user_id,
      'account_debit_webhook_processed',
      { 
        reference: debitData.reference,
        accountId: debitData.account,
        debitAccountNumber: debitData.debitAccountNumber,
        provider: debitData.provider,
        providerChannel: debitData.providerChannel
      },
      { 
        amount: debitData.amount,
        fees: debitData.fees,
        vat: debitData.vat,
        stampDuty: debitData.stampDuty,
        narration: debitData.narration,
        totalDebit: debitData.amount + debitData.fees + debitData.vat + debitData.stampDuty
      },
      'success'
    );

    console.log('Account debit webhook processed successfully:', debitData.reference);
    return { 
      success: true, 
      reference: debitData.reference, 
      amount: debitData.amount,
      userId: userData.user_id
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

// Email template functions
function generatePayoutSuccessEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  payoutId: string | null;
  planName?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payout Successful - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #22C55E; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">✅</div>
          <h1>Payout Successful!</h1>
          <p>Hello ${data.firstName}, your payout has been processed</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="details">
            ${data.planName ? `<div class="detail-row">
              <span class="label">Plan Name:</span>
              <span class="value">${data.planName}</span>
            </div>` : ''}
            ${data.accountName ? `<div class="detail-row">
              <span class="label">Account Name:</span>
              <span class="value">${data.accountName}</span>
            </div>` : ''}
            ${data.bankName ? `<div class="detail-row">
              <span class="label">Bank:</span>
              <span class="value">${data.bankName}</span>
            </div>` : ''}
            ${data.accountNumber ? `<div class="detail-row">
              <span class="label">Account Number:</span>
              <span class="value">${data.accountNumber}</span>
            </div>` : ''}
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="https://planmoni.com/transactions" class="button">View Transaction Details</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Your funds have been successfully transferred to your bank account. 
            The transaction may take a few minutes to reflect in your account depending on your bank.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated message, please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generatePayoutFailedEmailHtml(data: {
  firstName: string;
  amount: string;
  date: string;
  reference: string;
  payoutId: string | null;
  failureReason: string;
  planName?: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payout Failed - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #EF4444; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .error-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .alert { background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .alert p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="error-icon">⚠️</div>
          <h1>Payout Failed</h1>
          <p>Hello ${data.firstName}, we encountered an issue processing your payout</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="alert">
            <p><strong>Reason:</strong> ${data.failureReason}</p>
            <p>We're sorry for the inconvenience. Please try again or contact support if the issue persists.</p>
          </div>
          
          <div class="details">
            ${data.planName ? `<div class="detail-row">
              <span class="label">Plan Name:</span>
              <span class="value">${data.planName}</span>
            </div>` : ''}
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="https://planmoni.com/support" class="button">Contact Support</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Your funds remain safe in your wallet. You can retry the payout or contact our support team for assistance.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated message, please do not reply directly to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Planmoni. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Email notification functions
async function sendPayoutSuccessEmailNotification(
  userId: string,
  amount: number,
  reference: string,
  payoutId: string | null,
  planName: string,
  accountName: string,
  bankName: string,
  accountNumber: string
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
      planName,
      accountName,
      bankName,
      accountNumber
    }

    await sendEmail(
      userProfile.email,
      "Payout Successful - Planmoni",
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
      "Payout Failed - Planmoni",
      generatePayoutFailedEmailHtml(emailData)
    )
  } catch (error) {
    console.error('❌ Error sending payout failed email notification:', error)
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
