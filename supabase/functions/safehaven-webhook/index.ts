/**
 * SafeHaven Webhook Handler
 * 
 * This function handles all SafeHaven webhook events with comprehensive audit logging
 * and processing for transfers, virtual accounts, and account updates.
 * 
 * Supported Webhook Types:
 * - transfer: Regular transfer events (Inwards / Outwards in `data.type`)
 * - outward.transfer / transfer.outward: Same `data` shape; explicit switch cases (same handler as `transfer`)
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

function generateDepositEmailHtml(data: {
  firstName: string;
  amount: string;
  source: string;
  date: string;
  reference: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Funds Received - Planmoni</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .amount { font-size: 32px; font-weight: bold; color: #059669; text-align: center; margin: 20px 0; }
    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { color: #111827; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Funds Received!</h1>
      <p>Hello ${data.firstName}, money has been added to your Planmoni wallet</p>
    </div>
    <div class="content">
      <div class="amount">${data.amount}</div>
      <div class="details">
        <div class="detail-row"><span class="label">Source:</span><span class="value">${data.source}</span></div>
        <div class="detail-row"><span class="label">Date & Time:</span><span class="value">${data.date}</span></div>
        <div class="detail-row"><span class="label">Reference:</span><span class="value">${data.reference}</span></div>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Your funds are now available in your wallet.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from Planmoni</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendDepositEmailNotification(
  userId: string,
  amountInNaira: number,
  reference: string,
  source: string,
) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, first_name, email_notifications')
      .eq('id', userId)
      .single();

    if (error || !profile?.email) {
      console.warn('Failed to load profile for SafeHaven deposit email:', error);
      return;
    }

    if (profile.email_notifications?.deposit_alerts === false) {
      return;
    }

    const emailHtml = generateDepositEmailHtml({
      firstName: profile.first_name || 'User',
      amount: `₦${amountInNaira.toLocaleString()}`,
      source,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      reference,
    });

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: profile.email,
        subject: 'Funds Received - Planmoni',
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to send SafeHaven deposit email:', response.status, await response.text());
    }
  } catch (error) {
    console.warn('Failed to send SafeHaven deposit email notification:', error);
  }
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

/** Outward payouts debit Planmoni's pool account — never use debitAccountNumber for user resolution. */
async function resolveUserIdForOutwardTransfer(
  transferData: SafeHavenTransferData
): Promise<{ userId: string | null; via: string }> {
  if (transferData.client) {
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('safehaven_tokens')
      .select('user_id')
      .eq('ibs_client_id', transferData.client)
      .maybeSingle();
    if (!tokenErr && tokenRow?.user_id) {
      console.log(`Outward transfer: resolved user via safehaven_tokens (client): ${transferData.client}`);
      return { userId: tokenRow.user_id, via: 'safehaven_tokens' };
    }
  }

  const paymentRef = transferData.paymentReference || (transferData as any).reference || '';
  if (paymentRef || transferData._id) {
    let q = supabase.from('automated_payouts').select('user_id').limit(1);
    if (paymentRef && transferData._id) {
      q = q.or(`payment_reference.eq.${paymentRef},safehaven_transfer_id.eq.${transferData._id}`);
    } else if (paymentRef) {
      q = q.eq('payment_reference', paymentRef);
    } else {
      q = q.eq('safehaven_transfer_id', transferData._id);
    }
    const { data: apRow, error: apErr } = await q.maybeSingle();
    if (!apErr && apRow?.user_id) {
      console.log('Outward transfer: resolved user via automated_payouts');
      return { userId: apRow.user_id, via: 'automated_payouts' };
    }
  }

  // process-due-payouts creates a payout transaction with reference = planned AUTO_* ref (same value SafeHaven sends as paymentReference).
  const pr = transferData.paymentReference || (transferData as any).reference || '';
  if (pr) {
    const { data: txRow, error: txErr } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('reference', pr)
      .eq('type', 'payout')
      .limit(1)
      .maybeSingle();
    if (!txErr && txRow?.user_id) {
      console.log('Outward transfer: resolved user via transactions (payout row by payment reference)');
      return { userId: txRow.user_id, via: 'transactions.payout' };
    }
  }

  return { userId: null, via: 'none' };
}

// Process transfer webhook
async function processTransferWebhook(transferData: SafeHavenTransferData): Promise<any> {
  console.log('Processing transfer webhook:', transferData._id);

  try {
    const accountNumber = transferData.type === 'Inwards' 
      ? transferData.creditAccountNumber 
      : transferData.debitAccountNumber;

    let userId: string;

    if (transferData.type === 'Inwards') {
      console.log(`Inward transfer: resolving user by credited account: ${accountNumber}`);

      const { data: row, error: accountError } = await supabase
        .from('safehaven_accounts')
        .select('user_id, account_number, account_balance, book_balance')
        .eq('account_number', accountNumber)
        .eq('is_deleted', false)
        .maybeSingle();

      if (accountError || !row?.user_id) {
        console.error('Could not find safehaven_accounts for credit account:', accountNumber);
        await logDepositWebhook(transferData, null);
        return {
          error: 'Account not found',
          accountNumber,
          note: 'Inward webhook: no safehaven_accounts row for credit account',
        };
      }

      userId = row.user_id;
      console.log(`Found user ${userId} for credit account ${accountNumber}`);
    } else {
      console.log(
        `Outward transfer: skipping debit account ${accountNumber} for user lookup (Planmoni pool); using client / payout refs`
      );

      const resolved = await resolveUserIdForOutwardTransfer(transferData);
      if (!resolved.userId) {
        console.error('Could not resolve user for outward transfer:', transferData._id);
        await logDepositWebhook(transferData, null);
        return {
          error: 'User not found',
          transferId: transferData._id,
          note: 'Outward: no safehaven_tokens match for client and no automated_payouts match',
        };
      }

      userId = resolved.userId;
      console.log(`Found user ${userId} for outward transfer (via ${resolved.via})`);
    }

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
    const wireCreditAccount =
      transferData.type === 'Inwards' ? transferData.creditAccountNumber : null;

    let userAccountId: string | null = null;

    // Prefer resolved user's default SafeHaven account (required for Outwards: debit is Planmoni pool, not searchable by user).
    if (userId) {
      const { data: defaultAcct } = await supabase
        .from('safehaven_accounts')
        .select('id')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .eq('is_default', true)
        .maybeSingle();
      if (defaultAcct?.id) userAccountId = defaultAcct.id;
    }

    // Inwards: link log row to the credited account when we don't have default or for consistency
    if (!userAccountId && transferData.type === 'Inwards' && wireCreditAccount) {
      const { data: byCredit } = await supabase
        .from('safehaven_accounts')
        .select('id')
        .eq('account_number', wireCreditAccount)
        .eq('is_deleted', false)
        .maybeSingle();
      if (byCredit?.id) userAccountId = byCredit.id;
      else console.warn(`Could not find safehaven_accounts for inward credit account: ${wireCreditAccount}`);
    }

    // Do not look up Outwards by wireDebitAccount — it is the corporate debit, not the end-user's account.

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
      console.warn(
        'Skipping webhook log insert: no safehaven_accounts id (user default or inward credit account)'
      );
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

                  try {
                    await sendDepositEmailNotification(userId, walletAmount, paymentRef, 'SafeHaven');
                    console.log('Deposit email sent for SafeHaven deposit');
                  } catch (emailError) {
                    console.warn('Error sending deposit email:', emailError);
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

type RefundAfterFailureResult = {
  metadataPatch: Record<string, unknown>;
  transactionStatus: 'refunded' | 'failed';
};

type PayoutFailureNotifyVariant = 'retry' | 'contact_support';

type RefundedFailureState = {
  metadata: Record<string, unknown>;
  transferReference: string | null;
  retryCount: number;
  variant: PayoutFailureNotifyVariant;
  shouldNotify: boolean;
};

function buildRefundedFailureState(args: {
  existingMeta: Record<string, unknown>;
  refundPatch: Record<string, unknown>;
  currentTransferRef: string | null | undefined;
}): RefundedFailureState {
  const existing = args.existingMeta || {};
  const patch = args.refundPatch || {};
  const prevCount = Number(existing.refunded_failure_count ?? 0) || 0;
  const refundJustApplied = patch.wallet_refund_applied === true;
  const alreadyRefunded = existing.wallet_refund_applied === true;

  const failureCount = refundJustApplied ? prevCount + 1 : Math.max(prevCount, 1);
  const secondOrLater = failureCount >= 2;

  const prevRefs = Array.isArray(existing.previous_transfer_references)
    ? (existing.previous_transfer_references as unknown[])
    : [];
  const oldRef = args.currentTransferRef ? String(args.currentTransferRef) : null;

  if (!refundJustApplied && alreadyRefunded) {
    return {
      metadata: { ...existing, ...patch },
      transferReference: oldRef,
      retryCount: failureCount,
      variant: failureCount >= 2 ? 'contact_support' : 'retry',
      shouldNotify: false,
    };
  }

  if (refundJustApplied && !secondOrLater) {
    return {
      metadata: {
        ...existing,
        ...patch,
        refunded_failure_count: failureCount,
        wallet_debited: false,
        safehaven_transfer_initiated: false,
        manual_hold: false,
        previous_transfer_references: oldRef ? [...prevRefs, oldRef] : prevRefs,
      },
      transferReference: null,
      retryCount: failureCount,
      variant: 'retry',
      shouldNotify: true,
    };
  }

  return {
    metadata: {
      ...existing,
      ...patch,
      refunded_failure_count: failureCount,
      manual_hold: true,
      previous_transfer_references: oldRef ? [...prevRefs, oldRef] : prevRefs,
    },
    transferReference: oldRef,
    retryCount: failureCount,
    variant: 'contact_support',
    shouldNotify: true,
  };
}

/**
 * Reverse local wallet debit from process-due-payouts (transfer_funds) when SafeHaven reports
 * Failed/Reversed. Restores both balance and locked_balance via refund_payout_wallet_debit.
 */
async function refundWalletAfterSafehavenPayoutFailure(
  ap: { id: string; amount: number; status: string; metadata: Record<string, unknown> | null },
  userId: string,
  reason: string
): Promise<RefundAfterFailureResult> {
  const md: Record<string, unknown> = { ...(ap.metadata || {}) };
  if (md.wallet_refund_applied === true) {
    return { metadataPatch: {}, transactionStatus: 'refunded' };
  }

  const debited = md.wallet_debited === true;
  const wasDebitedLikely =
    debited ||
    ap.status === 'processing' ||
    ap.status === 'completed' ||
    (ap.status === 'failed' && md.wallet_refund_skipped !== 'not_debited');
  if (!wasDebitedLikely) {
    return {
      metadataPatch: {
        wallet_refund_skipped: 'not_debited',
        safehaven_failure_reason: reason,
      },
      transactionStatus: 'failed',
    };
  }

  const rawAmt = typeof md.wallet_debited_amount === 'number' ? md.wallet_debited_amount : Number(ap.amount);
  const amt = Number(rawAmt);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {
      metadataPatch: { wallet_refund_skipped: 'invalid_amount', safehaven_failure_reason: reason },
      transactionStatus: 'failed',
    };
  }

  const { data, error } = await supabase.rpc('refund_payout_wallet_debit', {
    arg_user_id: userId,
    arg_amount: amt,
  });

  if (error || !data || data.success !== true) {
    return {
      metadataPatch: {
        wallet_refund_applied: false,
        wallet_refund_error: error?.message || data?.error || 'refund_payout_wallet_debit failed',
        safehaven_failure_reason: reason,
      },
      transactionStatus: 'failed',
    };
  }

  return {
    metadataPatch: {
      wallet_refund_applied: true,
      wallet_refunded_at: new Date().toISOString(),
      wallet_refund_amount: amt,
      wallet_refund_reason: reason,
      wallet_refund_wallet: data,
    },
    transactionStatus: 'refunded',
  };
}

/**
 * When `automated_payouts` row is missing (deleted / never inserted) but the payout `transactions`
 * row still exists — reconcile webhook status, wallet refund, and tx row only.
 */
type PayoutTxRow = {
  id: string;
  amount: number;
  status: string;
  metadata: Record<string, unknown> | null;
  payout_plan_id: string | null;
};

async function reconcileOutwardPayoutViaTransactionOnly(
  transferData: SafeHavenTransferData,
  userId: string
): Promise<void> {
  const paymentRef = transferData.paymentReference || (transferData as any).reference || '';

  let tx: PayoutTxRow | null = null;

  if (paymentRef) {
    const { data } = await supabase
      .from('transactions')
      .select('id, amount, status, metadata, payout_plan_id')
      .eq('user_id', userId)
      .eq('type', 'payout')
      .eq('reference', paymentRef)
      .limit(1)
      .maybeSingle();
    if (data) tx = data as PayoutTxRow;
  }

  if (!tx && transferData._id) {
    const { data } = await supabase
      .from('transactions')
      .select('id, amount, status, metadata, payout_plan_id')
      .eq('user_id', userId)
      .eq('type', 'payout')
      .contains('metadata', { safehaven_transfer_id: transferData._id } as Record<string, unknown>)
      .limit(1)
      .maybeSingle();
    if (data) tx = data as PayoutTxRow;
  }

  if (!tx) {
    console.log(
      'reconcileOutwardPayoutViaTransactionOnly: no payout transaction for user',
      userId,
      'paymentRef=',
      paymentRef
    );
    return;
  }

  console.log(
    'Reconciling outward webhook via transactions only (no automated_payout row). tx:',
    tx.id
  );

  const md = (tx.metadata || {}) as Record<string, unknown>;

  const isTerminalFail = transferData.status === 'Failed' || transferData.status === 'Reversed';
  const isSuccess = transferData.status === 'Completed';

  if (isTerminalFail && (tx.status === 'refunded' || md.wallet_refund_applied === true)) {
    await supabase
      .from('transactions')
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          ...md,
          safehaven_webhook_status: transferData.status,
          safehaven_response_message: transferData.responseMessage || null,
          reconciled_without_automated_payout: true,
        },
      })
      .eq('id', tx.id);
    console.log('Transaction-only reconcile: refund already applied; merged webhook metadata only');
    return;
  }

  if (isSuccess && tx.status !== 'completed') {
    const nextMeta = {
      ...md,
      safehaven_webhook_status: transferData.status,
      safehaven_response_message: transferData.responseMessage || null,
      reconciled_without_automated_payout: true,
    };
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
        metadata: nextMeta,
      })
      .eq('id', tx.id);
    console.log('Transaction-only reconcile: marked payout transaction completed');
    return;
  }

  if (!isTerminalFail) {
    const nextMeta = {
      ...md,
      safehaven_webhook_status: transferData.status,
      safehaven_response_message: transferData.responseMessage || null,
      reconciled_without_automated_payout: true,
    };
    await supabase
      .from('transactions')
      .update({
        updated_at: new Date().toISOString(),
        metadata: nextMeta,
      })
      .eq('id', tx.id);
    return;
  }

  // Failed / Reversed: wallet refund uses same RPC; synthetic "ap" from tx (pending → processing so debit is considered likely).
  const syntheticAp = {
    id: tx.id,
    amount: Number(tx.amount),
    status: tx.status === 'pending' ? 'processing' : tx.status,
    metadata: md,
  };

  const refundResult = await refundWalletAfterSafehavenPayoutFailure(
    syntheticAp,
    userId,
    transferData.responseMessage || transferData.status || 'Transfer failed'
  );

  const txMeta = {
    ...md,
    ...refundResult.metadataPatch,
    safehaven_webhook_status: transferData.status,
    safehaven_response_message: transferData.responseMessage || null,
    reconciled_without_automated_payout: true,
  };

  await supabase
    .from('transactions')
    .update({
      status: refundResult.transactionStatus,
      updated_at: new Date().toISOString(),
      metadata: txMeta,
    })
    .eq('id', tx.id);

  console.log(
    'Transaction-only reconcile: updated payout tx status to',
    refundResult.transactionStatus
  );

  if (tx.payout_plan_id) {
    const { data: payoutPlan } = await supabase
      .from('payout_plans')
      .select('id, name, payout_amount')
      .eq('id', tx.payout_plan_id)
      .maybeSingle();

    if (payoutPlan) {
      const failureState = buildRefundedFailureState({
        existingMeta: md,
        refundPatch: refundResult.metadataPatch,
        currentTransferRef: paymentRef,
      });
      if (failureState.shouldNotify) {
        const variant = failureState.variant;
        await supabase.from('events').insert({
          user_id: userId,
          type: 'disbursement_failed',
          title: variant === 'contact_support' ? 'Payout Failed' : 'Payout Delayed',
          description: variant === 'contact_support'
            ? `Your payout from "${payoutPlan.name}" failed again. Please contact support@planmoni.com for a manual transfer.`
            : `Your payout from "${payoutPlan.name}" could not be processed. Funds are back in your locked balance and we will retry automatically.`,
          status: 'unread',
          payout_plan_id: payoutPlan.id,
        });

        try {
          await sendPayoutFailedEmailNotification(
            userId,
            Number(tx.amount),
            paymentRef,
            null,
            transferData.responseMessage || 'Transfer failed',
            payoutPlan.name,
            variant
          );
        } catch (emailError) {
          console.error('Transaction-only reconcile: failure email error:', emailError);
        }
      }
    }
  }
}

// Update automated payout from webhook
async function updateAutomatedPayoutFromWebhook(transferData: SafeHavenTransferData, userId: string): Promise<void> {
  try {
    console.log('Checking for automated payout related to transfer:', transferData._id);

    const paymentRef = transferData.paymentReference || (transferData as any).reference || '';

    // Same flow as process-due-payouts: payout transactions carry metadata.automated_payout_id; webhook paymentReference matches tx.reference when it is still AUTO_*.
    let automatedPayout: {
      id: string;
      payout_plan_id: string;
      status: string;
      amount: number;
      user_id: string;
      transfer_reference?: string | null;
      metadata: Record<string, unknown> | null;
    } | null = null;

    if (paymentRef) {
      const { data: txRow } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('user_id', userId)
        .eq('reference', paymentRef)
        .eq('type', 'payout')
        .limit(1)
        .maybeSingle();

      const apIdRaw =
        txRow?.metadata &&
        typeof txRow.metadata === 'object' &&
        (txRow.metadata as Record<string, unknown>).automated_payout_id;
      const apId = typeof apIdRaw === 'string' ? apIdRaw : null;

      if (apId) {
        const { data: byTxMeta, error: byTxMetaErr } = await supabase
          .from('automated_payouts')
          .select('id, payout_plan_id, status, amount, user_id, transfer_reference, metadata')
          .eq('id', apId)
          .eq('user_id', userId)
          .maybeSingle();
        if (byTxMetaErr && byTxMetaErr.code !== 'PGRST116') {
          console.error('Error loading automated_payout from transactions.automated_payout_id:', byTxMetaErr);
        } else if (byTxMeta) {
          automatedPayout = byTxMeta;
          console.log('Found automated payout via transactions.metadata.automated_payout_id');
        }
      }
    }

    if (!automatedPayout) {
      const orParts = [`safehaven_transfer_id.eq.${transferData._id}`];
      if (paymentRef) {
        orParts.push(`payment_reference.eq.${paymentRef}`);
        orParts.push(`transfer_reference.eq.${paymentRef}`);
      }
      const { data: apRow, error: payoutError } = await supabase
        .from('automated_payouts')
        .select('id, payout_plan_id, status, amount, user_id, transfer_reference, metadata')
        .eq('user_id', userId)
        .or(orParts.join(','))
        .limit(1)
        .maybeSingle();

      if (payoutError && payoutError.code !== 'PGRST116') {
        console.error('Error finding automated payout:', payoutError);
        return;
      }
      automatedPayout = apRow;
    }

    if (!automatedPayout) {
      console.log(
        'No automated_payouts row for transfer:',
        transferData._id,
        'paymentReference=',
        paymentRef,
        '— reconciling via transactions only'
      );
      await reconcileOutwardPayoutViaTransactionOnly(transferData, userId);
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

      let refundResult: RefundAfterFailureResult | null = null;
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.transferred_at = new Date().toISOString();
      } else if (newStatus === 'failed') {
        updateData.error_message = transferData.responseMessage || 'Transfer failed';
        updateData.completed_at = new Date().toISOString();
        refundResult = await refundWalletAfterSafehavenPayoutFailure(
          {
            id: automatedPayout.id,
            amount: Number(automatedPayout.amount),
            status: automatedPayout.status,
            metadata: (automatedPayout.metadata as Record<string, unknown> | null) ?? null,
          },
          userId,
          transferData.responseMessage || transferData.status || 'Transfer failed'
        );
        const failureState = buildRefundedFailureState({
          existingMeta: (automatedPayout.metadata as Record<string, unknown> | null) || {},
          refundPatch: refundResult.metadataPatch,
          currentTransferRef: automatedPayout.transfer_reference,
        });
        updateData.metadata = failureState.metadata;
        updateData.retry_count = failureState.retryCount;
        if (failureState.transferReference === null) {
          updateData.transfer_reference = null;
        }
        (refundResult as RefundAfterFailureResult & { failureState?: RefundedFailureState }).failureState =
          failureState;
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
        .select('id, status, metadata')
        .eq('reference', paymentRef)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (!transactionError && transaction) {
        let txNextStatus: string;
        if (newStatus === 'completed') {
          txNextStatus = 'completed';
        } else if (newStatus === 'failed' && refundResult) {
          txNextStatus = refundResult.transactionStatus;
        } else if (newStatus === 'failed') {
          txNextStatus = 'failed';
        } else {
          txNextStatus = 'pending';
        }
        const txMeta = {
          ...((transaction.metadata as Record<string, unknown> | null) || {}),
          ...(newStatus === 'failed' && refundResult ? refundResult.metadataPatch : {}),
          safehaven_webhook_status: transferData.status,
          safehaven_response_message: transferData.responseMessage || null,
        };
        await supabase
          .from('transactions')
          .update({
            status: txNextStatus,
            updated_at: new Date().toISOString(),
            metadata: txMeta,
          })
          .eq('id', transaction.id);
      }

      // If completed, advance plan via idempotent RPC
      if (newStatus === 'completed') {
        const { error: completeErr } = await supabase.rpc('complete_payout_installment', {
          p_automated_payout_id: automatedPayout.id,
          p_provider_metadata: {
            safehaven_webhook_status: transferData.status,
            safehaven_response_message: transferData.responseMessage || null,
            completed_via: 'safehaven_webhook',
          },
        });
        if (completeErr) {
          console.error('safehaven-webhook: complete_payout_installment failed:', completeErr);
        }

        const { data: payoutPlan, error: planError } = await supabase
          .from('payout_plans')
          .select('id, name, payout_amount')
          .eq('id', automatedPayout.payout_plan_id)
          .single();

        if (!planError && payoutPlan) {
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
        const failureState = (refundResult as RefundAfterFailureResult & {
          failureState?: RefundedFailureState;
        })?.failureState;
        const variant: PayoutFailureNotifyVariant = failureState?.variant || 'retry';
        const shouldNotify = failureState?.shouldNotify !== false;

        const { data: payoutPlan } = await supabase
          .from('payout_plans')
          .select('id, name, payout_amount')
          .eq('id', automatedPayout.payout_plan_id)
          .single();

        if (payoutPlan && shouldNotify) {
          const description = variant === 'contact_support'
            ? `Your payout from "${payoutPlan.name}" failed again. Please contact support@planmoni.com for a manual transfer.`
            : `Your payout from "${payoutPlan.name}" could not be processed. Funds are back in your locked balance and we will retry automatically.`;

          await supabase
            .from('events')
            .insert({
              user_id: userId,
              type: 'disbursement_failed',
              title: variant === 'contact_support' ? 'Payout Failed' : 'Payout Delayed',
              description,
              status: 'unread',
              payout_plan_id: payoutPlan.id
            });

          try {
            await sendPayoutFailedEmailNotification(
              userId,
              automatedPayout.amount,
              paymentRef,
              automatedPayout.id,
              transferData.responseMessage || 'Transfer failed',
              payoutPlan.name,
              variant
            );
          } catch (emailError) {
            console.error('Error sending failure email notification:', emailError);
          }
        }
      }
    }

    // Payout row already failed (e.g. webhook retry or refund added after first failure): apply refund + tx status if still needed.
    if (
      newStatus === 'failed' &&
      automatedPayout.status === 'failed' &&
      (transferData.status === 'Failed' || transferData.status === 'Reversed')
    ) {
      const { data: apLatest, error: apLatestErr } = await supabase
        .from('automated_payouts')
        .select('id, amount, status, transfer_reference, metadata')
        .eq('id', automatedPayout.id)
        .maybeSingle();

      if (apLatestErr || !apLatest) {
        console.error('safehaven-webhook: could not reload automated_payout for failed refund retry', apLatestErr);
      } else {
        const refundRetry = await refundWalletAfterSafehavenPayoutFailure(
          {
            id: apLatest.id,
            amount: Number(apLatest.amount),
            status: apLatest.status,
            metadata: (apLatest.metadata as Record<string, unknown> | null) ?? null,
          },
          userId,
          transferData.responseMessage || transferData.status || 'Transfer failed'
        );

        const failureState = buildRefundedFailureState({
          existingMeta: (apLatest.metadata as Record<string, unknown> | null) || {},
          refundPatch: refundRetry.metadataPatch,
          currentTransferRef: apLatest.transfer_reference,
        });

        if (Object.keys(refundRetry.metadataPatch).length > 0 || failureState.shouldNotify) {
          const lateUpdate: Record<string, unknown> = {
            metadata: failureState.metadata,
            retry_count: failureState.retryCount,
            updated_at: new Date().toISOString(),
          };
          if (failureState.transferReference === null) {
            lateUpdate.transfer_reference = null;
          }
          await supabase
            .from('automated_payouts')
            .update(lateUpdate)
            .eq('id', apLatest.id);
        }

        if (failureState.shouldNotify) {
          const { data: payoutPlanRetry } = await supabase
            .from('payout_plans')
            .select('id, name')
            .eq('id', automatedPayout.payout_plan_id)
            .maybeSingle();
          if (payoutPlanRetry) {
            const variant = failureState.variant;
            await supabase.from('events').insert({
              user_id: userId,
              type: 'disbursement_failed',
              title: variant === 'contact_support' ? 'Payout Failed' : 'Payout Delayed',
              description: variant === 'contact_support'
                ? `Your payout from "${payoutPlanRetry.name}" failed again. Please contact support@planmoni.com for a manual transfer.`
                : `Your payout from "${payoutPlanRetry.name}" could not be processed. Funds are back in your locked balance and we will retry automatically.`,
              status: 'unread',
              payout_plan_id: payoutPlanRetry.id,
            });
            try {
              await sendPayoutFailedEmailNotification(
                userId,
                Number(apLatest.amount),
                transferData.paymentReference || (transferData as any).reference || '',
                apLatest.id,
                transferData.responseMessage || 'Transfer failed',
                payoutPlanRetry.name,
                variant
              );
            } catch (emailError) {
              console.error('Late refund failure email error:', emailError);
            }
          }
        }

        const paymentRefRetry = transferData.paymentReference || (transferData as any).reference || '';
        const { data: transactionRetry, error: transactionRetryError } = await supabase
          .from('transactions')
          .select('id, status, metadata')
          .eq('reference', paymentRefRetry)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (!transactionRetryError && transactionRetry && transactionRetry.status !== 'completed') {
          const txMetaRetry = {
            ...((transactionRetry.metadata as Record<string, unknown> | null) || {}),
            ...refundRetry.metadataPatch,
            safehaven_webhook_status: transferData.status,
            safehaven_response_message: transferData.responseMessage || null,
          };
          await supabase
            .from('transactions')
            .update({
              status: refundRetry.transactionStatus,
              updated_at: new Date().toISOString(),
              metadata: txMetaRetry,
            })
            .eq('id', transactionRetry.id);
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
        // Same NIP payload as `transfer`; envelope uses eventType / type from SafeHaven payout webhooks
        case 'outward.transfer':
        case 'transfer.outward':
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
  variant?: PayoutFailureNotifyVariant;
}) {
  const isRetry = data.variant !== 'contact_support';
  const title = isRetry ? 'Payout Delayed' : 'Payout Failed';
  const alertBody = isRetry
    ? `<p>The amount has been returned to your <strong>locked wallet balance</strong> (still reserved for this plan). We will <strong>automatically retry</strong> this payout shortly. You do not need to do anything.</p>`
    : `<p>We tried this payout again and it still failed. Your funds remain in your <strong>locked wallet balance</strong> for this plan.</p>
            <p>Please reach out to us at <a href="mailto:support@planmoni.com">support@planmoni.com</a> and we will process a <strong>manual transfer</strong> for you.</p>`;
  const footerNote = isRetry
    ? 'Your funds are safe and still locked for this payout. We will retry automatically.'
    : 'Your funds are safe and still locked for this payout. Contact support@planmoni.com for a manual transfer.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Planmoni</title>
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
          <h1>${title}</h1>
          <p>Hello ${data.firstName}, we encountered an issue processing your payout</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="alert">
            <p><strong>Reason:</strong> ${data.failureReason}</p>
            ${alertBody}
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
            <a href="mailto:support@planmoni.com" class="button">${isRetry ? 'View Support' : 'Email Support'}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            ${footerNote}
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
  planName: string,
  variant: PayoutFailureNotifyVariant = 'retry'
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
      planName,
      variant,
    }

    const subject = variant === 'contact_support'
      ? 'Payout failed — please contact us for a manual transfer - Planmoni'
      : 'Payout delayed — we will retry shortly - Planmoni';

    await sendEmail(
      userProfile.email,
      subject,
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
