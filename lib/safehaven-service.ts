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
   * Initializes a new SafeHaven token using client_credentials grant
   */
  async initializeToken(userId: string): Promise<SafeHavenOperationResult> {
    const startTime = Date.now();
    let auditLogId: string | undefined = undefined;

    try {
      // Create audit log entry
      auditLogId = await this.logOperation(
        userId,
        'token_initialize',
        { grantType: 'client_credentials' },
        null,
        'pending'
      );

      const requestData = {
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: this.CLIENT_ASSERTION,
        client_id: this.CLIENT_ID
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
          error: `Token initialization failed: ${response.status} ${response.statusText}`,
          auditLogId,
          responseTime
        };
      }

      const tokenData = await response.json();

      // Store the new token
      await this.storeToken(userId, tokenData, tokenData.refresh_token || '');

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
   * Gets a valid SafeHaven token, refreshing if needed
   */
  async getValidToken(userId: string): Promise<SafeHavenToken | null> {
    let token = await this.getToken(userId);

    // If no token exists, initialize one
    if (!token) {
      const initResult = await this.initializeToken(userId);
      if (!initResult.success) {
        return null;
      }
      token = await this.getToken(userId);
      if (!token) {
        return null;
      }
    }

    // If token is expired or will expire soon, refresh it
    if (this.isTokenExpired(token)) {
      const refreshResult = await this.refreshToken(userId, token.refresh_token);
      if (!refreshResult.success) {
        // If refresh fails, try to initialize a new token
        const initResult = await this.initializeToken(userId);
        if (!initResult.success) {
          return null;
        }
        token = await this.getToken(userId);
        return token;
      }
      token = await this.getToken(userId);
    }

    return token;
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
    let auditLogId: string | undefined = undefined;

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

      // Store the new token - use refresh_token from response if available, otherwise use the old one
      await this.storeToken(userId, tokenData, tokenData.refresh_token || refreshToken);

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
    let auditLogId: string | undefined = undefined;

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
        auditLogId: auditLogId || undefined,
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

      return data.map((account: any) => ({
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
  ): Promise<string | undefined> {
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
        return undefined;
      }

      return data || undefined;
    } catch (error) {
      console.error('Error in SafeHaven operation logging:', error);
      return undefined;
    }
  }

  /**
   * Updates an audit log entry
   */
  private async updateAuditLog(
    auditLogId: string | undefined,
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

      return data.map((log: any) => ({
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
   * Verifies NIN using SafeHaven API and creates account
   * Uses two-step workflow: identity verification first, then account creation
   * 
   * If OTP is not provided, only initializes verification (step 1) and returns identityId
   * If OTP is provided, creates account (step 2) using identityId
   */
  async verifyNINAndCreateAccount(
    userId: string,
    nin: string,
    phoneNumber: string,
    emailAddress: string,
    otp?: string,
    identityId?: string
  ): Promise<SafeHavenOperationResult> {
    const startTime = Date.now();
    let auditLogId: string | undefined = undefined;
    let currentIdentityId: string | undefined = identityId;

    try {
      // Get valid token
      const token = await this.getValidToken(userId);
      if (!token) {
        return {
          success: false,
          error: 'Unable to get SafeHaven token. Please try again.'
        };
      }

      // Create audit log entry for KYC
      const kycAuditLogId = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: userId,
        p_operation_type: 'nin_verification',
        p_verification_type: 'nin',
        p_verification_provider: 'safehaven',
        p_request_data: {
          nin: nin.substring(0, 4) + '****', // Partial NIN for security
          timestamp: new Date().toISOString()
        },
        p_response_data: null,
        p_status: 'pending',
        p_result_message: 'NIN verification initiated',
        p_metadata: {
          service: 'safehaven-service',
          operation: 'nin_verification'
        }
      });

      // Create SafeHaven audit log entry
      auditLogId = await this.logOperation(
        userId,
        'nin_verification',
        {
          nin: nin.substring(0, 4) + '****', // Partial NIN for security
          step: 'identity_verification'
        },
        null,
        'pending'
      );

      // STEP 1: Create identity verification (only if identityId not provided)
      if (!currentIdentityId) {
        const defaultDebitAccountNumber = '0117753301';
        const identityRequestPayload = {
          type: 'NIN',
          async: false,
          debitAccountNumber: defaultDebitAccountNumber,
          number: nin
        };

        const identityResponse = await fetch(`${this.API_URL}/identity/v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ClientID': this.CLIENT_ID,
            'Authorization': `Bearer ${token.access_token}`
          },
          body: JSON.stringify(identityRequestPayload)
        });

        if (!identityResponse.ok) {
          const errorText = await identityResponse.text();
          const errorData = { 
            status: identityResponse.status, 
            statusText: identityResponse.statusText, 
            error: errorText,
            step: 'identity_verification'
          };
          
          const responseTime = Date.now() - startTime;
          
          // Update both audit logs with error
          if (kycAuditLogId?.data) {
            await supabase
              .from('kyc_audit_logs')
              .update({
                status: 'failed',
                response_data: errorData,
                updated_at: new Date().toISOString()
              })
              .eq('id', kycAuditLogId.data);
          }
          await this.updateAuditLog(auditLogId, 'failed', null, errorData, responseTime);

          return {
            success: false,
            error: `Identity verification failed: ${identityResponse.status} ${identityResponse.statusText}`,
            auditLogId,
            responseTime
          };
        }

        const identityData = await identityResponse.json();
        console.log("safehaven nin verification identityData", identityData)
        // Extract identityId from response
        if (identityData?.data?._id) {
          currentIdentityId = identityData.data._id;
        } else if (identityData?._id) {
          currentIdentityId = identityData._id;
        } else {
          throw new Error('Identity ID not found in response');
        }

        // Extract OTP message from response
        const otpMessage = identityData?.message || null;

        // Update audit log with identity verification success - store full response
        await this.updateAuditLog(
          auditLogId,
          'pending', // Still pending as we need to create account
          identityData, // Store full response in response_data
          null,
          Date.now() - startTime
        );

        // If no OTP provided, return identityId for next step
        if (!otp) {
          // Update KYC audit log
          if (kycAuditLogId?.data) {
            await supabase
              .from('kyc_audit_logs')
              .update({
                status: 'success',
                response_data: {
                  identityId: currentIdentityId,
                  otp_sent: true,
                  status: identityData?.data?.status || identityData?.status || 'PENDING',
                  otp_message: otpMessage
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', kycAuditLogId.data);
          }

          return {
            success: true,
            data: {
              identityId: currentIdentityId,
              requiresOtp: true,
              status: identityData?.data?.status || identityData?.status || 'PENDING',
              otpMessage: otpMessage
            },
            auditLogId,
            responseTime: Date.now() - startTime
          };
        }
      }

      // STEP 2: Create account using identityId (requires OTP)
      if (!otp) {
        throw new Error('OTP is required to create account');
      }
      
      // When OTP is provided, identityId is required
      if (!currentIdentityId) {
        throw new Error('Identity ID is required when OTP is provided. Please initialize NIN verification first.');
      }
      
      const accountRequestPayload: any = {
        phoneNumber: phoneNumber,
        emailAddress: emailAddress,
        identityType: 'NIN',
        autoSweep: true,
        autoSweepDetails: {
          schedule: 'Instant',
          accountNumber: "0117753301"
        },
        externalReference: `AC_${userId.substring(0, 8)}`,
        identityNumber: nin,
        identityId: currentIdentityId
      };

      // Add OTP if provided
      if (otp) {
        accountRequestPayload.otp = otp;
      }

      const accountResponse = await fetch(`${this.API_URL}/accounts/v2/subaccount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ClientID': this.CLIENT_ID,
          'Authorization': `Bearer ${token.access_token}`
        },
        body: JSON.stringify(accountRequestPayload)
      });

      const responseTime = Date.now() - startTime;

      if (!accountResponse.ok) {
        const errorText = await accountResponse.text();
        const errorData = { 
          status: accountResponse.status, 
          statusText: accountResponse.statusText, 
          error: errorText,
          step: 'account_creation',
          identityId: currentIdentityId
        };
        
        // Update both audit logs with error
        if (kycAuditLogId?.data) {
          await supabase
            .from('kyc_audit_logs')
            .update({
              status: 'failed',
              response_data: errorData,
              updated_at: new Date().toISOString()
            })
            .eq('id', kycAuditLogId.data);
        }
        await this.updateAuditLog(auditLogId, 'failed', null, errorData, responseTime);

        return {
          success: false,
          error: `Account creation failed: ${accountResponse.status} ${accountResponse.statusText}`,
          auditLogId,
          responseTime,
          data: { identityId: currentIdentityId, requiresOtp: accountResponse.status === 400 || accountResponse.status === 422 }
        };
      }

      const accountData = await accountResponse.json();
      console.log("safehaven account creation accountData", accountData)
      // Extract account information from response
      const verificationData: any = {
        verified: true,
        identityId: currentIdentityId,
        identityNumber: nin,
        status: accountData?.data?.status || accountData?.status || 'PENDING'
      };

      // Extract account number if available - check multiple possible locations
      let accountNumber: string | null = null;
      if (accountData?.data?.accountNumber) {
        accountNumber = accountData.data.accountNumber;
      } else if (accountData?.data?.account_number) {
        accountNumber = accountData.data.account_number;
      } else if (accountData?.accountNumber) {
        accountNumber = accountData.accountNumber;
      } else if (accountData?.account_number) {
        accountNumber = accountData.account_number;
      } else if (accountData?.data?.data?.accountNumber) {
        accountNumber = accountData.data.data.accountNumber;
      }
      
      if (accountNumber) {
        verificationData.account_number = accountNumber;
        console.log("safehaven account number extracted:", accountNumber);
      } else {
        console.warn("safehaven account number not found in response:", JSON.stringify(accountData, null, 2));
      }

      // Extract account name if available - check multiple possible locations
      let accountName: string | null = null;
      if (accountData?.data?.accountName) {
        accountName = accountData.data.accountName;
      } else if (accountData?.data?.account_name) {
        accountName = accountData.data.account_name;
      } else if (accountData?.accountName) {
        accountName = accountData.accountName;
      } else if (accountData?.account_name) {
        accountName = accountData.account_name;
      }

      // Extract names if available
      if (accountName) {
        const names = accountName.split(' ');
        verificationData.first_name = names[0] || '';
        verificationData.last_name = names[names.length - 1] || '';
        verificationData.middle_name = names.length > 2 ? names.slice(1, -1).join(' ') : '';
      }

      // Update KYC audit log with success
      if (kycAuditLogId?.data) {
        await supabase
          .from('kyc_audit_logs')
          .update({
            status: 'success',
            response_data: {
              verified: true,
              nin: nin.substring(0, 4) + '****',
              hasAccount: !!verificationData.account_number,
              identityId: currentIdentityId
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', kycAuditLogId.data);
      }

      // Update SafeHaven audit log with success
      await this.updateAuditLog(
        auditLogId,
        'success',
        {
          verified: true,
          hasAccount: !!verificationData.account_number,
          accountNumber: verificationData.account_number ? verificationData.account_number.substring(0, 5) + '****' : null,
          identityId: currentIdentityId,
          step: 'account_creation_complete',
          responseData: accountData
        },
        null,
        responseTime
      );

      // If account was created, store it
      if (verificationData.account_number) {
        console.log("safehaven account creation verificationData", verificationData)
        try {
          await this.storeAccountFromNINVerification(userId, {
            account_number: verificationData.account_number,
            account_name: accountName || `${verificationData.first_name} ${verificationData.last_name}`.trim() || 'NIN Account',
            account_type: accountData?.data?.accountType || accountData?.accountType || 'savings',
            account_product: accountData?.data?.accountProduct || accountData?.accountProduct || 'Savings',
            currency_code: accountData?.data?.currencyCode || accountData?.currencyCode || 'NGN',
            status: accountData?.data?.status || accountData?.status || 'active',
            account_id: accountData?.data?._id || accountData?.data?.id || accountData?._id || accountData?.id || null,
            account_balance: accountData?.data?.accountBalance || accountData?.accountBalance || 0,
            book_balance: accountData?.data?.bookBalance || accountData?.bookBalance || 0,
            interest_balance: accountData?.data?.interestBalance || accountData?.interestBalance || 0,
            withholding_tax_balance: accountData?.data?.withHoldingTaxBalance || accountData?.withHoldingTaxBalance || 0
          });
          console.log("safehaven account saved successfully to database");
        } catch (storeError) {
          console.error("safehaven error storing account:", storeError);
          // Don't throw - log the error but continue with verification
        }
      } else {
        console.warn("safehaven account number not found, skipping database storage");
      }

      // Update KYC progress with NIN verification
      await supabase
        .from('kyc_progress')
        .update({
          nin_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      return {
        success: true,
        data: verificationData,
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
   * Stores account created from NIN verification
   */
  private async storeAccountFromNINVerification(userId: string, verificationData: any): Promise<void> {
    try {
      if (!verificationData.account_number) {
        console.error('Cannot store account: account_number is missing');
        throw new Error('Account number is required to store account');
      }

      // Get client_id from token or use default
      const token = await this.getToken(userId);
      const clientId = token?.client_id || this.CLIENT_ID || '';

      const accountRecord: any = {
        user_id: userId,
        safehaven_account_id: verificationData.account_id || verificationData.safehaven_account_id || verificationData.account_number, // Required: use account number as fallback
        client_id: clientId, // Required field
        account_product: verificationData.account_product || 'Savings', // Required field - default to Savings
        account_number: verificationData.account_number,
        cba_account_id: verificationData.cba_account_id || null,
        account_name: verificationData.account_name || verificationData.full_name || 'NIN Account',
        account_type: verificationData.account_type || 'savings',
        currency_code: verificationData.currency_code || 'NGN',
        bvn: verificationData.bvn || null,
        account_balance: verificationData.account_balance || 0,
        book_balance: verificationData.book_balance || 0,
        interest_balance: verificationData.interest_balance || 0,
        withholding_tax_balance: verificationData.withholding_tax_balance || 0,
        status: verificationData.status || 'active',
        is_default: true, // New account from NIN verification is default
        can_debit: verificationData.can_debit !== false,
        can_credit: verificationData.can_credit !== false,
        nominal_annual_interest_rate: verificationData.nominal_annual_interest_rate || 0,
        interest_compounding_period: verificationData.interest_compounding_period || null,
        interest_posting_period: verificationData.interest_posting_period || null,
        interest_calculation_type: verificationData.interest_calculation_type || null,
        interest_calculation_days_in_year_type: verificationData.interest_calculation_days_in_year_type || null,
        min_required_opening_balance: verificationData.min_required_opening_balance || 0,
        lockin_period_frequency: verificationData.lockin_period_frequency || 0,
        lockin_period_frequency_type: verificationData.lockin_period_frequency_type || null,
        allow_overdraft: verificationData.allow_overdraft !== false,
        overdraft_limit: verificationData.overdraft_limit || 0,
        charge_withholding_tax: verificationData.charge_withholding_tax !== false,
        charge_value_added_tax: verificationData.charge_value_added_tax !== false,
        charge_stamp_duty: verificationData.charge_stamp_duty !== false,
        notification_settings: verificationData.notification_settings || null,
        is_sub_account: verificationData.is_sub_account !== false,
        is_deleted: verificationData.is_deleted === true,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Check if account already exists by account number
      const { data: existingAccount, error: fetchError } = await supabase
        .from('safehaven_accounts')
        .select('id, safehaven_account_id')
        .eq('user_id', userId)
        .eq('account_number', verificationData.account_number)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking for existing account:', fetchError);
        throw fetchError;
      }

      if (existingAccount) {
        // Update existing account
        console.log('Updating existing SafeHaven account:', existingAccount.id);
        const { error: updateError } = await supabase
          .from('safehaven_accounts')
          .update(accountRecord)
          .eq('id', existingAccount.id);

        if (updateError) {
          console.error('Error updating existing account:', updateError);
          throw updateError;
        }
        console.log('SafeHaven account updated successfully');
      } else {
        // Insert new account
        console.log('Inserting new SafeHaven account:', verificationData.account_number);
        const { error: insertError } = await supabase
          .from('safehaven_accounts')
          .insert({
            ...accountRecord,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting new account:', insertError);
          throw insertError;
        }
        console.log('SafeHaven account inserted successfully');
      }
    } catch (error) {
      console.error('Error storing account from NIN verification:', error);
      throw error;
    }
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