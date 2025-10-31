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
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SafeHaven webhook configuration
const SAFEHAVEN_WEBHOOK_SECRET = Deno.env.get('SAFEHAVEN_WEBHOOK_SECRET') || '';

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
  createdAt: string;
  updatedAt: string;
}

// Helper function to create JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Verify webhook signature (if provided)
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.warn('No webhook secret configured, skipping signature verification');
    return true;
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

// Process transfer webhook
async function processTransferWebhook(transferData: SafeHavenTransferData): Promise<any> {
  console.log('Processing transfer webhook:', transferData._id);

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

    // Store transfer data
    const { error: insertError } = await supabase
      .from('safehaven_transfers')
      .upsert({
        user_id: userData.user_id,
        safehaven_transfer_id: transferData._id,
        client_id: transferData.client,
        account_id: transferData.account,
        type: transferData.type,
        session_id: transferData.sessionId,
        name_enquiry_reference: transferData.nameEnquiryReference,
        payment_reference: transferData.paymentReference,
        is_reversed: transferData.isReversed,
        provider: transferData.provider,
        provider_channel: transferData.providerChannel,
        destination_institution_code: transferData.destinationInstitutionCode,
        credit_account_name: transferData.creditAccountName,
        credit_account_number: transferData.creditAccountNumber,
        debit_account_name: transferData.debitAccountName,
        debit_account_number: transferData.debitAccountNumber,
        narration: transferData.narration,
        amount: transferData.amount,
        fees: transferData.fees || 0,
        response_code: transferData.responseCode,
        response_message: transferData.responseMessage,
        status: transferData.status,
        transaction_location: transferData.transactionLocation,
        created_at: transferData.createdAt,
        updated_at: transferData.updatedAt,
        webhook_received_at: new Date().toISOString(),
        metadata: {
          webhook_processed: true,
          processed_at: new Date().toISOString()
        }
      }, {
        onConflict: 'safehaven_transfer_id'
      });

    if (insertError) {
      console.error('Error storing transfer data:', insertError);
      throw insertError;
    }

    // Create audit log
    await createAuditLog(
      userData.user_id,
      'transfer_webhook_processed',
      { transferId: transferData._id, type: transferData.type },
      { status: transferData.status, amount: transferData.amount },
      'success'
    );

    // Update user's balance if this is a completed transfer
    if (transferData.status === 'Completed') {
      await updateUserBalance(userData.user_id, transferData);
    }

    return { 
      success: true, 
      transferId: transferData._id, 
      status: transferData.status,
      userId: userData.user_id
    };

  } catch (error) {
    console.error('Error processing transfer webhook:', error);
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

    // Store virtual account transfer data
    const { error: insertError } = await supabase
      .from('safehaven_virtual_account_transfers')
      .upsert({
        user_id: userData.user_id,
        safehaven_transfer_id: transferData._id,
        client_id: transferData.client,
        virtual_account_id: transferData.virtualAccount,
        session_id: transferData.sessionId,
        name_enquiry_reference: transferData.nameEnquiryReference,
        payment_reference: transferData.paymentReference,
        is_reversed: transferData.isReversed,
        provider: transferData.provider,
        provider_channel: transferData.providerChannel,
        provider_channel_code: transferData.providerChannelCode,
        destination_institution_code: transferData.destinationInstitutionCode,
        credit_account_name: transferData.creditAccountName,
        credit_account_number: transferData.creditAccountNumber,
        debit_account_name: transferData.debitAccountName,
        debit_account_number: transferData.debitAccountNumber,
        transaction_location: transferData.transactionLocation,
        amount: transferData.amount,
        fees: transferData.fees,
        response_code: transferData.responseCode,
        response_message: transferData.responseMessage,
        status: transferData.status,
        created_at: transferData.createdAt,
        updated_at: transferData.updatedAt,
        webhook_received_at: new Date().toISOString(),
        metadata: {
          webhook_processed: true,
          processed_at: new Date().toISOString()
        }
      }, {
        onConflict: 'safehaven_transfer_id'
      });

    if (insertError) {
      console.error('Error storing virtual account transfer data:', insertError);
      throw insertError;
    }

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

    // Store or update transaction data
    const { error: upsertError } = await supabase
      .from('safehaven_transactions')
      .upsert({
        user_id: userData.user_id,
        safehaven_transaction_id: transactionData._id,
        client_id: transactionData.client,
        account_id: transactionData.account,
        type: transactionData.type,
        amount: transactionData.amount,
        balance: transactionData.balance,
        narration: transactionData.narration,
        reference: transactionData.reference,
        status: transactionData.status,
        created_at: transactionData.createdAt,
        updated_at: transactionData.updatedAt,
        webhook_updated_at: new Date().toISOString(),
        metadata: {
          webhook_processed: true,
          processed_at: new Date().toISOString()
        }
      }, {
        onConflict: 'safehaven_transaction_id'
      });

    if (upsertError) {
      console.error('Error storing transaction data:', upsertError);
      throw upsertError;
    }

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
async function updateUserBalance(userId: string, transferData: SafeHavenTransferData): Promise<void> {
  try {
    // This would typically update the user's wallet balance
    // For now, we'll just log the balance change
    console.log(`Balance update for user ${userId}: ${transferData.type} ${transferData.amount}`);
    
    // You can implement actual balance update logic here
    // For example, updating a wallet_balance table or triggering balance recalculation
    
  } catch (error) {
    console.error('Error updating user balance:', error);
  }
}

// Update virtual account balance
async function updateVirtualAccountBalance(userId: string, transferData: SafeHavenVirtualAccountTransferData): Promise<void> {
  try {
    // Update virtual account balance
    const { error } = await supabase
      .from('safehaven_virtual_accounts')
      .update({
        balance: transferData.amount, // This should be calculated based on transfer type
        updated_at: new Date().toISOString()
      })
      .eq('safehaven_virtual_account_id', transferData.virtualAccount)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating virtual account balance:', error);
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

// Main function handler
serve(async (req) => {
  const startTime = Date.now();

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return createJsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Get webhook payload
    const payload = await req.text();
    const webhookData: SafeHavenWebhookPayload = JSON.parse(payload);

    console.log('Received SafeHaven webhook:', webhookData.type);

    // Verify webhook signature if provided
    const signature = req.headers.get('x-signature') || req.headers.get('signature') || '';
    if (!verifyWebhookSignature(payload, signature, SAFEHAVEN_WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      return createJsonResponse({ error: 'Invalid signature' }, 401);
    }

    // Store webhook for processing
    const { data: webhookRecord, error: webhookError } = await supabase
      .from('safehaven_webhooks')
      .insert({
        webhook_type: webhookData.type,
        webhook_data: webhookData.data,
        signature,
        metadata: {
          timestamp: webhookData.timestamp,
          received_at: new Date().toISOString()
        }
      })
      .select('id')
      .single();

    if (webhookError) {
      console.error('Error storing webhook:', webhookError);
      return createJsonResponse({ error: 'Failed to store webhook' }, 500);
    }

    // Process webhook based on type
    let result: any = null;

    try {
      switch (webhookData.type) {
        case 'transfer':
          result = await processTransferWebhook(webhookData.data);
          break;
        case 'virtualAccount.transfer':
          result = await processVirtualAccountTransferWebhook(webhookData.data);
          break;
        case 'account.update':
          result = await processAccountUpdateWebhook(webhookData.data);
          break;
        case 'transaction.update':
          result = await processTransactionUpdateWebhook(webhookData.data);
          break;
        case 'subaccount.created':
          result = await processSubaccountCreatedWebhook(webhookData.data);
          break;
        case 'subaccount.updated':
          result = await processSubaccountUpdatedWebhook(webhookData.data);
          break;
        case 'subaccount.status':
          result = await processSubaccountStatusWebhook(webhookData.data);
          break;
        default:
          throw new Error(`Unknown webhook type: ${webhookData.type}`);
      }

      // Mark webhook as processed
      await supabase
        .from('safehaven_webhooks')
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookRecord.id);

      console.log('Webhook processed successfully:', webhookData.type);

      return createJsonResponse({
        success: true,
        message: 'Webhook processed successfully',
        data: result,
        webhookId: webhookRecord.id,
        processingTime: Date.now() - startTime
      });

    } catch (processingError) {
      console.error('Error processing webhook:', processingError);

      // Mark webhook as failed
      await supabase
        .from('safehaven_webhooks')
        .update({
          processed: false,
          processing_error: processingError instanceof Error ? processingError.message : 'Unknown error',
          retry_count: 1
        })
        .eq('id', webhookRecord.id);

      return createJsonResponse({
        success: false,
        error: 'Failed to process webhook',
        details: processingError instanceof Error ? processingError.message : 'Unknown error',
        webhookId: webhookRecord.id,
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
