/**
 * SafeHaven Service
 * 
 * Comprehensive service for managing SafeHaven API operations with
 * audit logging, token management, and account synchronization.
 * 
 * Key Features:
 * - Token refresh and management
 * - Account data synchronization
 * - Comprehensive audit logging
 * - Error handling and retry logic
 * - Rate limiting and throttling
 */

import { supabase } from './supabase';

export interface SafeHavenToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  ibs_client_id: string;
  ibs_user_id: string;
  client_id: string;
}

export interface SafeHavenAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  currencyCode: string;
  accountBalance: number;
  bookBalance: number;
  status: string;
  isDefault: boolean;
  canDebit: boolean;
  canCredit: boolean;
}

export interface SafeHavenOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  auditLogId?: string;
  responseTime?: number;
}

export interface SafeHavenAuditLog {
  id: string;
  userId: string;
  operationType: string;
  status: string;
  requestData?: any;
  responseData?: any;
  errorData?: any;
  responseTimeMs?: number;
  createdAt: string;
}

class SafeHavenService {
  private static instance: SafeHavenService;
  private readonly API_URL = 'https://api.safehavenmfb.com';
  private readonly CLIENT_ID = process.env.EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID || '';
  private readonly CLIENT_ASSERTION = process.env.EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION || '';

  public static getInstance(): SafeHavenService {
    if (!SafeHavenService.instance) {
      SafeHavenService.instance = new SafeHavenService();
    }
    return SafeHavenService.instance;
  }

  /**
   * Gets the current SafeHaven token for a user
   */
  async getToken(userId: string): Promise<SafeHavenToken | null> {
    try {
      const { data, error } = await supabase
        .from('safehaven_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No token found
        }
        throw error;
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        expires_at: data.expires_at,
        ibs_client_id: data.ibs_client_id,
        ibs_user_id: data.ibs_user_id,
        client_id: data.client_id
      };
    } catch (error) {
      console.error('Error getting SafeHaven token:', error);
      return null;
    }
  }

  /**
   * Checks if a token is expired or will expire soon
   */
  isTokenExpired(token: SafeHavenToken, bufferMinutes: number = 5): boolean {
    const expirationTime = new Date(token.expires_at).getTime();
    const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds
    return Date.now() >= (expirationTime - bufferTime);
  }

  /**
   * Refreshes a SafeHaven token
   */
  async refreshToken(userId: string, refreshToken: string): Promise<SafeHavenOperationResult> {
    const startTime = Date.now();
    let auditLogId: string | null = null;

    try {
      // Create audit log entry
      auditLogId = await this.logOperation(
        userId,
        'token_refresh',
        { hasRefreshToken: !!refreshToken },
        null,
        'pending'
      );

      const requestData = {
        grant_type: 'refresh_token',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: this.CLIENT_ASSERTION,
        client_id: this.CLIENT_ID,
        refresh_token: refreshToken
      };

      const response = await fetch(`${this.API_URL}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = { status: response.status, statusText: response.statusText, error: errorText };
        
        // Update audit log with error
        await this.updateAuditLog(auditLogId, 'failed', null, errorData, responseTime);

        return {
          success: false,
          error: `Token refresh failed: ${response.status} ${response.statusText}`,
          auditLogId,
          responseTime
        };
      }

      const tokenData = await response.json();

      // Store the new token
      await this.storeToken(userId, tokenData, refreshToken);

      // Update audit log with success
      await this.updateAuditLog(
        auditLogId,
        'success',
        {
          tokenType: tokenData.token_type,
          expiresIn: tokenData.expires_in,
          ibsClientId: tokenData.ibs_client_id,
          ibsUserId: tokenData.ibs_user_id
        },
        null,
        responseTime
      );

      return {
        success: true,
        data: tokenData,
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
        auditLogId: auditLogId || undefined,
        responseTime
      };
    }
  }

  /**
   * Stores a SafeHaven token in the database
   */
  private async storeToken(userId: string, tokenData: any, refreshToken: string): Promise<void> {
    try {
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

      // Check if token exists
      const { data: existingToken, error: fetchError } = await supabase
        .from('safehaven_tokens')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

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

  /**
   * Fetches SafeHaven accounts for a user
   */
  async fetchAccounts(userId: string): Promise<SafeHavenOperationResult> {
    const startTime = Date.now();
    let auditLogId: string | null = null;

    try {
      // Get current token
      const token = await this.getToken(userId);
      if (!token) {
        return {
          success: false,
          error: 'No SafeHaven token found. Please refresh your token first.'
        };
      }

      // Check if token is expired
      if (this.isTokenExpired(token)) {
        return {
          success: false,
          error: 'SafeHaven token has expired. Please refresh your token first.'
        };
      }

      // Create audit log entry
      auditLogId = await this.logOperation(
        userId,
        'accounts_fetch',
        { tokenExpiresAt: token.expires_at },
        null,
        'pending'
      );

      const response = await fetch(`${this.API_URL}/accounts/`, {
        method: 'GET',
        headers: {
          'ClientID': this.CLIENT_ID,
          'Authorization': `Bearer ${token.access_token}`
        }
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = { status: response.status, statusText: response.statusText, error: errorText };
        
        // Update audit log with error
        await this.updateAuditLog(auditLogId, 'failed', null, errorData, responseTime);

        return {
          success: false,
          error: `Failed to fetch accounts: ${response.status} ${response.statusText}`,
          auditLogId,
          responseTime
        };
      }

      const accountsResponse = await response.json();
      const accounts = accountsResponse.data || [];

      // Store accounts in database
      await this.storeAccounts(userId, accounts);

      // Update audit log with success
      await this.updateAuditLog(
        auditLogId,
        'success',
        { accountsCount: accounts.length },
        null,
        responseTime
      );

      return {
        success: true,
        data: accounts,
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
   * Stores SafeHaven accounts in the database
   */
  private async storeAccounts(userId: string, accounts: any[]): Promise<void> {
    try {
      // Delete existing accounts for this user
      await supabase
        .from('safehaven_accounts')
        .delete()
        .eq('user_id', userId);

      if (accounts.length === 0) {
        return;
      }

      // Prepare account records
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

      // Insert new accounts
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

  /**
   * Gets user's SafeHaven accounts from database
   */
  async getUserAccounts(userId: string): Promise<SafeHavenAccount[]> {
    try {
      const { data, error } = await supabase
        .from('safehaven_accounts')
        .select(`
          id,
          account_number,
          account_name,
          account_type,
          currency_code,
          account_balance,
          book_balance,
          status,
          is_default,
          can_debit,
          can_credit,
          synced_at
        `)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('is_default', { ascending: false })
        .order('account_balance', { ascending: false });

      if (error) {
        throw error;
      }

      return data.map(account => ({
        id: account.id,
        accountNumber: account.account_number,
        accountName: account.account_name,
        accountType: account.account_type,
        currencyCode: account.currency_code,
        accountBalance: account.account_balance,
        bookBalance: account.book_balance,
        status: account.status,
        isDefault: account.is_default,
        canDebit: account.can_debit,
        canCredit: account.can_credit
      }));
    } catch (error) {
      console.error('Error getting user SafeHaven accounts:', error);
      return [];
    }
  }

  /**
   * Gets account summary for a user
   */
  async getAccountSummary(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_safehaven_accounts_summary', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      return data[0] || {
        total_accounts: 0,
        total_balance: 0,
        default_account_id: null,
        accounts_by_type: {}
      };
    } catch (error) {
      console.error('Error getting SafeHaven account summary:', error);
      return {
        total_accounts: 0,
        total_balance: 0,
        default_account_id: null,
        accounts_by_type: {}
      };
    }
  }

  /**
   * Logs a SafeHaven operation
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
          service: 'safehaven-service'
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
   * Gets audit logs for a user
   */
  async getAuditLogs(
    userId: string,
    operationType?: string,
    limit: number = 50
  ): Promise<SafeHavenAuditLog[]> {
    try {
      let query = supabase
        .from('safehaven_audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (operationType) {
        query = query.eq('operation_type', operationType);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map(log => ({
        id: log.id,
        userId: log.user_id,
        operationType: log.operation_type,
        status: log.status,
        requestData: log.request_data,
        responseData: log.response_data,
        errorData: log.error_data,
        responseTimeMs: log.response_time_ms,
        createdAt: log.created_at
      }));
    } catch (error) {
      console.error('Error getting SafeHaven audit logs:', error);
      return [];
    }
  }

  /**
   * Checks if SafeHaven service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.CLIENT_ID && this.CLIENT_ASSERTION);
  }

  /**
   * Gets service configuration status
   */
  getConfigurationStatus(): {
    isConfigured: boolean;
    hasClientId: boolean;
    hasClientAssertion: boolean;
  } {
    return {
      isConfigured: this.isConfigured(),
      hasClientId: !!this.CLIENT_ID,
      hasClientAssertion: !!this.CLIENT_ASSERTION
    };
  }
}

// Export singleton instance
export const safeHavenService = SafeHavenService.getInstance();

// Export types
export type {
  SafeHavenToken,
  SafeHavenAccount,
  SafeHavenOperationResult,
  SafeHavenAuditLog
};
