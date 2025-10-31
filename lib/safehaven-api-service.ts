/**
 * SafeHaven API Service
 * 
 * Comprehensive service for all SafeHaven API operations including:
 * - Account management
 * - Transfer operations
 * - Virtual account management
 * - Transaction history
 * - Webhook handling
 * - Comprehensive audit logging
 */

import { supabase } from './supabase';

export interface SafeHavenTransfer {
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

export interface SafeHavenVirtualAccount {
  _id: string;
  client: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafeHavenTransaction {
  _id: string;
  client: string;
  account: string;
  type: string;
  amount: number;
  balance: number;
  narration: string;
  reference: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafeHavenWebhookPayload {
  type: 'transfer' | 'virtualAccount.transfer' | 'account.update' | 'transaction.update';
  data: any;
  timestamp: string;
  signature?: string;
}

export interface SafeHavenApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  message?: string;
  auditLogId?: string;
  responseTime?: number;
}

class SafeHavenApiService {
  private static instance: SafeHavenApiService;
  private readonly API_URL = 'https://api.safehavenmfb.com';
  private readonly CLIENT_ID = process.env.EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID || '';

  public static getInstance(): SafeHavenApiService {
    if (!SafeHavenApiService.instance) {
      SafeHavenApiService.instance = new SafeHavenApiService();
    }
    return SafeHavenApiService.instance;
  }

  /**
   * Gets a valid access token for API calls
   */
  private async getValidToken(userId: string): Promise<string | null> {
    try {
      const { data: token, error } = await supabase
        .from('safehaven_tokens')
        .select('access_token, expires_at')
        .eq('user_id', userId)
        .single();

      if (error || !token) {
        return null;
      }

      // Check if token is expired
      if (new Date(token.expires_at) <= new Date()) {
        return null;
      }

      return token.access_token;
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  }

  /**
   * Makes an authenticated API request to SafeHaven
   */
  private async makeApiRequest<T>(
    userId: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    operationType: string = 'api_request'
  ): Promise<SafeHavenApiResponse<T>> {
    const startTime = Date.now();
    let auditLogId: string | null = null;

    try {
      const accessToken = await this.getValidToken(userId);
      if (!accessToken) {
        return {
          success: false,
          error: 'No valid SafeHaven token found. Please refresh your token first.'
        };
      }

      // Create audit log entry
      auditLogId = await this.logOperation(
        userId,
        operationType,
        { endpoint, method, hasBody: !!body },
        null,
        'pending'
      );

      const response = await fetch(`${this.API_URL}${endpoint}`, {
        method,
        headers: {
          'ClientID': this.CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const responseTime = Date.now() - startTime;
      const responseData = await response.json();

      if (!response.ok) {
        // Update audit log with error
        await this.updateAuditLog(auditLogId, 'failed', null, {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        }, responseTime);

        return {
          success: false,
          error: `API request failed: ${response.status} ${response.statusText}`,
          statusCode: response.status,
          auditLogId,
          responseTime
        };
      }

      // Update audit log with success
      await this.updateAuditLog(
        auditLogId,
        'success',
        responseData,
        null,
        responseTime
      );

      return {
        success: true,
        data: responseData,
        statusCode: response.status,
        auditLogId,
        responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Update audit log with error
      if (auditLogId) {
        await this.updateAuditLog(auditLogId, 'failed', null, { error: errorMessage }, responseTime);
      }

      return {
        success: false,
        error: errorMessage,
        auditLogId,
        responseTime
      };
    }
  }

  /**
   * Gets all accounts for a user
   */
  async getAccounts(userId: string): Promise<SafeHavenApiResponse<any[]>> {
    return this.makeApiRequest(userId, '/accounts/', 'GET', null, 'accounts_fetch');
  }

  /**
   * Gets account details by account ID
   */
  async getAccountDetails(userId: string, accountId: string): Promise<SafeHavenApiResponse<any>> {
    return this.makeApiRequest(userId, `/accounts/${accountId}`, 'GET', null, 'account_details_fetch');
  }

  /**
   * Gets account balance
   */
  async getAccountBalance(userId: string, accountId: string): Promise<SafeHavenApiResponse<any>> {
    return this.makeApiRequest(userId, `/accounts/${accountId}/balance`, 'GET', null, 'account_balance_fetch');
  }

  /**
   * Gets transaction history for an account
   */
  async getTransactionHistory(
    userId: string,
    accountId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SafeHavenApiResponse<SafeHavenTransaction[]>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `/accounts/${accountId}/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeApiRequest(userId, endpoint, 'GET', null, 'transaction_history_fetch');
  }

  /**
   * Initiates a transfer
   */
  async initiateTransfer(
    userId: string,
    transferData: {
      fromAccount: string;
      toAccount: string;
      amount: number;
      narration: string;
      beneficiaryName?: string;
      beneficiaryBank?: string;
    }
  ): Promise<SafeHavenApiResponse<SafeHavenTransfer>> {
    const body = {
      fromAccount: transferData.fromAccount,
      toAccount: transferData.toAccount,
      amount: transferData.amount,
      narration: transferData.narration,
      beneficiaryName: transferData.beneficiaryName,
      beneficiaryBank: transferData.beneficiaryBank
    };

    return this.makeApiRequest(userId, '/transfers/', 'POST', body, 'transfer_initiate');
  }

  /**
   * Gets transfer status
   */
  async getTransferStatus(userId: string, transferId: string): Promise<SafeHavenApiResponse<SafeHavenTransfer>> {
    return this.makeApiRequest(userId, `/transfers/${transferId}`, 'GET', null, 'transfer_status_fetch');
  }

  /**
   * Gets all transfers for a user
   */
  async getTransfers(
    userId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SafeHavenApiResponse<SafeHavenTransfer[]>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `/transfers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeApiRequest(userId, endpoint, 'GET', null, 'transfers_fetch');
  }

  /**
   * Creates a virtual account
   */
  async createVirtualAccount(
    userId: string,
    virtualAccountData: {
      accountName: string;
      bankCode?: string;
      description?: string;
    }
  ): Promise<SafeHavenApiResponse<SafeHavenVirtualAccount>> {
    return this.makeApiRequest(userId, '/virtual-accounts/', 'POST', virtualAccountData, 'virtual_account_create');
  }

  /**
   * Gets virtual accounts for a user
   */
  async getVirtualAccounts(userId: string): Promise<SafeHavenApiResponse<SafeHavenVirtualAccount[]>> {
    return this.makeApiRequest(userId, '/virtual-accounts/', 'GET', null, 'virtual_accounts_fetch');
  }

  /**
   * Gets virtual account details
   */
  async getVirtualAccountDetails(userId: string, virtualAccountId: string): Promise<SafeHavenApiResponse<SafeHavenVirtualAccount>> {
    return this.makeApiRequest(userId, `/virtual-accounts/${virtualAccountId}`, 'GET', null, 'virtual_account_details_fetch');
  }

  /**
   * Gets virtual account transactions
   */
  async getVirtualAccountTransactions(
    userId: string,
    virtualAccountId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SafeHavenApiResponse<SafeHavenTransfer[]>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `/virtual-accounts/${virtualAccountId}/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeApiRequest(userId, endpoint, 'GET', null, 'virtual_account_transactions_fetch');
  }

  /**
   * Updates virtual account status
   */
  async updateVirtualAccountStatus(
    userId: string,
    virtualAccountId: string,
    status: 'Active' | 'Inactive' | 'Suspended'
  ): Promise<SafeHavenApiResponse<SafeHavenVirtualAccount>> {
    return this.makeApiRequest(
      userId,
      `/virtual-accounts/${virtualAccountId}`,
      'PUT',
      { status },
      'virtual_account_status_update'
    );
  }

  /**
   * Gets name enquiry for an account
   */
  async getNameEnquiry(
    userId: string,
    accountNumber: string,
    bankCode: string
  ): Promise<SafeHavenApiResponse<{ accountName: string; accountNumber: string; bankCode: string }>> {
    const body = {
      accountNumber,
      bankCode
    };

    return this.makeApiRequest(userId, '/name-enquiry/', 'POST', body, 'name_enquiry');
  }

  /**
   * Gets bank list
   */
  async getBankList(userId: string): Promise<SafeHavenApiResponse<any[]>> {
    return this.makeApiRequest(userId, '/banks/', 'GET', null, 'bank_list_fetch');
  }

  /**
   * Gets transaction fees
   */
  async getTransactionFees(
    userId: string,
    amount: number,
    transactionType: string
  ): Promise<SafeHavenApiResponse<{ fee: number; totalAmount: number }>> {
    const body = {
      amount,
      transactionType
    };

    return this.makeApiRequest(userId, '/fees/', 'POST', body, 'transaction_fees_fetch');
  }

  /**
   * Initiates subaccount creation with OTP verification
   */
  async initiateSubaccountCreation(
    userId: string,
    subaccountData: {
      accountName: string;
      accountType: string;
      currencyCode?: string;
      description?: string;
      phoneNumber?: string;
      email?: string;
    }
  ): Promise<SafeHavenApiResponse<{ sessionId: string; otpRequired: boolean }>> {
    const body = {
      accountName: subaccountData.accountName,
      accountType: subaccountData.accountType,
      currencyCode: subaccountData.currencyCode || 'NGN',
      description: subaccountData.description,
      phoneNumber: subaccountData.phoneNumber,
      email: subaccountData.email
    };

    return this.makeApiRequest(userId, '/subaccounts/initiate', 'POST', body, 'subaccount_creation_initiate');
  }

  /**
   * Verifies OTP and completes subaccount creation
   */
  async verifySubaccountOTP(
    userId: string,
    sessionId: string,
    otp: string
  ): Promise<SafeHavenApiResponse<any>> {
    const body = {
      sessionId,
      otp
    };

    return this.makeApiRequest(userId, '/subaccounts/verify-otp', 'POST', body, 'subaccount_otp_verify');
  }

  /**
   * Gets subaccounts for a user
   */
  async getSubaccounts(userId: string): Promise<SafeHavenApiResponse<any[]>> {
    return this.makeApiRequest(userId, '/subaccounts/', 'GET', null, 'subaccounts_fetch');
  }

  /**
   * Gets subaccount details
   */
  async getSubaccountDetails(userId: string, subaccountId: string): Promise<SafeHavenApiResponse<any>> {
    return this.makeApiRequest(userId, `/subaccounts/${subaccountId}`, 'GET', null, 'subaccount_details_fetch');
  }

  /**
   * Updates subaccount status
   */
  async updateSubaccountStatus(
    userId: string,
    subaccountId: string,
    status: 'Active' | 'Inactive' | 'Suspended'
  ): Promise<SafeHavenApiResponse<any>> {
    return this.makeApiRequest(
      userId,
      `/subaccounts/${subaccountId}`,
      'PUT',
      { status },
      'subaccount_status_update'
    );
  }

  /**
   * Gets subaccount transactions
   */
  async getSubaccountTransactions(
    userId: string,
    subaccountId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SafeHavenApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `/subaccounts/${subaccountId}/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeApiRequest(userId, endpoint, 'GET', null, 'subaccount_transactions_fetch');
  }

  /**
   * Processes webhook payload
   */
  async processWebhook(
    webhookPayload: SafeHavenWebhookPayload,
    signature?: string
  ): Promise<SafeHavenApiResponse<any>> {
    const startTime = Date.now();
    let auditLogId: string | null = null;

    try {
      // Create audit log entry for webhook
      auditLogId = await this.logWebhookOperation(
        webhookPayload.type,
        webhookPayload.data,
        'pending',
        { signature, timestamp: webhookPayload.timestamp }
      );

      // Process based on webhook type
      let result: any = null;

      switch (webhookPayload.type) {
        case 'transfer':
          result = await this.processTransferWebhook(webhookPayload.data);
          break;
        case 'virtualAccount.transfer':
          result = await this.processVirtualAccountTransferWebhook(webhookPayload.data);
          break;
        case 'account.update':
          result = await this.processAccountUpdateWebhook(webhookPayload.data);
          break;
        case 'transaction.update':
          result = await this.processTransactionUpdateWebhook(webhookPayload.data);
          break;
        default:
          throw new Error(`Unknown webhook type: ${webhookPayload.type}`);
      }

      // Update audit log with success
      await this.updateAuditLog(
        auditLogId,
        'success',
        result,
        null,
        Date.now() - startTime
      );

      return {
        success: true,
        data: result,
        auditLogId,
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Update audit log with error
      if (auditLogId) {
        await this.updateAuditLog(auditLogId, 'failed', null, { error: errorMessage }, responseTime);
      }

      return {
        success: false,
        error: errorMessage,
        auditLogId,
        responseTime
      };
    }
  }

  /**
   * Processes transfer webhook
   */
  private async processTransferWebhook(transferData: SafeHavenTransfer): Promise<any> {
    // Store transfer data
    const { error } = await supabase
      .from('safehaven_transfers')
      .upsert({
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
        webhook_received_at: new Date().toISOString()
      }, {
        onConflict: 'safehaven_transfer_id'
      });

    if (error) {
      throw new Error(`Failed to store transfer data: ${error.message}`);
    }

    return { transferId: transferData._id, status: transferData.status };
  }

  /**
   * Processes virtual account transfer webhook
   */
  private async processVirtualAccountTransferWebhook(transferData: any): Promise<any> {
    // Store virtual account transfer data
    const { error } = await supabase
      .from('safehaven_virtual_account_transfers')
      .upsert({
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
        fees: transferData.fees || 0,
        response_code: transferData.responseCode,
        response_message: transferData.responseMessage,
        status: transferData.status,
        created_at: transferData.createdAt,
        updated_at: transferData.updatedAt,
        webhook_received_at: new Date().toISOString()
      }, {
        onConflict: 'safehaven_transfer_id'
      });

    if (error) {
      throw new Error(`Failed to store virtual account transfer data: ${error.message}`);
    }

    return { transferId: transferData._id, status: transferData.status };
  }

  /**
   * Processes account update webhook
   */
  private async processAccountUpdateWebhook(accountData: any): Promise<any> {
    // Update account data
    const { error } = await supabase
      .from('safehaven_accounts')
      .update({
        account_balance: accountData.accountBalance,
        book_balance: accountData.bookBalance,
        status: accountData.status,
        updated_at: accountData.updatedAt,
        webhook_updated_at: new Date().toISOString()
      })
      .eq('safehaven_account_id', accountData._id);

    if (error) {
      throw new Error(`Failed to update account data: ${error.message}`);
    }

    return { accountId: accountData._id, status: accountData.status };
  }

  /**
   * Processes transaction update webhook
   */
  private async processTransactionUpdateWebhook(transactionData: any): Promise<any> {
    // Store or update transaction data
    const { error } = await supabase
      .from('safehaven_transactions')
      .upsert({
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
        webhook_updated_at: new Date().toISOString()
      }, {
        onConflict: 'safehaven_transaction_id'
      });

    if (error) {
      throw new Error(`Failed to store transaction data: ${error.message}`);
    }

    return { transactionId: transactionData._id, status: transactionData.status };
  }

  /**
   * Logs an API operation
   */
  private async logOperation(
    userId: string,
    operationType: string,
    requestData?: any,
    responseData?: any,
    status: string = 'pending'
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('log_safehaven_operation', {
        p_user_id: userId,
        p_operation_type: operationType,
        p_request_data: requestData,
        p_response_data: responseData,
        p_status: status,
        p_safehaven_endpoint: this.API_URL,
        p_safehaven_client_id: this.CLIENT_ID,
        p_metadata: {
          timestamp: new Date().toISOString(),
          service: 'safehaven-api-service'
        }
      });

      if (error) {
        console.error('Error logging SafeHaven operation:', error);
        return '';
      }

      return data || '';
    } catch (error) {
      console.error('Error in SafeHaven operation logging:', error);
      return '';
    }
  }

  /**
   * Logs a webhook operation
   */
  private async logWebhookOperation(
    webhookType: string,
    webhookData: any,
    status: string,
    metadata?: any
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('safehaven_audit_logs')
        .insert({
          user_id: webhookData.client || '00000000-0000-0000-0000-000000000000',
          operation_type: 'webhook_received',
          status,
          request_data: { webhook_type: webhookType },
          response_data: webhookData,
          safehaven_endpoint: 'webhook',
          safehaven_client_id: this.CLIENT_ID,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            service: 'safehaven-api-service'
          }
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error logging SafeHaven webhook:', error);
        return '';
      }

      return data.id;
    } catch (error) {
      console.error('Error in SafeHaven webhook logging:', error);
      return '';
    }
  }

  /**
   * Updates an audit log entry
   */
  private async updateAuditLog(
    auditLogId: string,
    status: string,
    responseData?: any,
    errorData?: any,
    responseTimeMs?: number
  ): Promise<void> {
    if (!auditLogId) return;

    try {
      const { error } = await supabase
        .from('safehaven_audit_logs')
        .update({
          status,
          response_data: responseData,
          error_data: errorData,
          response_time_ms: responseTimeMs,
          updated_at: new Date().toISOString()
        })
        .eq('id', auditLogId);

      if (error) {
        console.error('Error updating SafeHaven audit log:', error);
      }
    } catch (error) {
      console.error('Error in SafeHaven audit log update:', error);
    }
  }

  /**
   * Gets API service status
   */
  getServiceStatus(): {
    isConfigured: boolean;
    hasClientId: boolean;
    apiUrl: string;
  } {
    return {
      isConfigured: !!this.CLIENT_ID,
      hasClientId: !!this.CLIENT_ID,
      apiUrl: this.API_URL
    };
  }
}

// Export singleton instance
export const safeHavenApiService = SafeHavenApiService.getInstance();

// Export types
export type {
  SafeHavenTransfer,
  SafeHavenVirtualAccount,
  SafeHavenTransaction,
  SafeHavenWebhookPayload,
  SafeHavenApiResponse
};
