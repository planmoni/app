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
  // In-memory token storage as fallback when database storage fails
  private inMemoryTokens: Map<string, SafeHavenToken> = new Map();

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
      // First try to get from database
      const { data, error } = await supabase
        .from('safehaven_tokens')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle to avoid error if no record exists

      if (data) {
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
      }

      // If not in database, check in-memory storage (fallback for RLS issues)
      const inMemoryToken = this.inMemoryTokens.get(userId);
      if (inMemoryToken) {
        // Check if token is still valid
        if (!this.isTokenExpired(inMemoryToken)) {
          return inMemoryToken;
        } else {
          // Remove expired token from memory
          this.inMemoryTokens.delete(userId);
        }
      }

      return null; // No token found
    } catch (error) {
      // If database query fails, check in-memory storage
      const inMemoryToken = this.inMemoryTokens.get(userId);
      if (inMemoryToken && !this.isTokenExpired(inMemoryToken)) {
        return inMemoryToken;
      }
      
      console.error('[SafeHaven] Error getting SafeHaven token:', error);
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
      // Validate credentials before making API call
      if (!this.CLIENT_ID || !this.CLIENT_ASSERTION) {
        const missingCredentials = [];
        if (!this.CLIENT_ID) missingCredentials.push('CLIENT_ID');
        if (!this.CLIENT_ASSERTION) missingCredentials.push('CLIENT_ASSERTION');
        
        console.error(`[SafeHaven] API credentials are missing: ${missingCredentials.join(', ')}`);
        return {
          success: false,
          error: `SafeHaven API credentials are missing (${missingCredentials.join(', ')}). Please configure EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID and EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION.`,
          responseTime: Date.now() - startTime
        };
      }

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
        let errorMessage: string;
        
        // Distinguish between invalid credentials and other API errors
        if (response.status === 401 || response.status === 403) {
          errorMessage = `SafeHaven API authentication failed. Please verify your CLIENT_ID and CLIENT_ASSERTION are correct. (Status: ${response.status})`;
          console.error('[SafeHaven] Invalid credentials - authentication failed:', {
            status: response.status,
            error: errorText.substring(0, 200) // Log first 200 chars to avoid logging sensitive data
          });
        } else if (response.status >= 500) {
          errorMessage = `SafeHaven API server error. Please try again later. (Status: ${response.status})`;
          console.error('[SafeHaven] API server error:', {
            status: response.status,
            error: errorText.substring(0, 200)
          });
        } else {
          errorMessage = `SafeHaven API request failed. (Status: ${response.status} ${response.statusText})`;
          console.error('[SafeHaven] API request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText.substring(0, 200)
          });
        }
        
        const errorData = { status: response.status, statusText: response.statusText, error: errorText };
        
        // Update audit log with error
        await this.updateAuditLog(auditLogId, 'failed', null, errorData, responseTime);

        return {
          success: false,
          error: errorMessage,
          auditLogId,
          responseTime
        };
      }

      const tokenData = await response.json();

      // Store the new token (may fail due to RLS, but we'll use in-memory fallback)
      const stored = await this.storeToken(userId, tokenData, tokenData.refresh_token || '');
      
      // If database storage failed, store in memory as fallback
      if (!stored) {
        const inMemoryToken: SafeHavenToken = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          ibs_client_id: tokenData.ibs_client_id,
          ibs_user_id: tokenData.ibs_user_id,
          client_id: tokenData.client_id
        };
        this.inMemoryTokens.set(userId, inMemoryToken);
        console.log('[SafeHaven] Token stored in memory as fallback');
      }

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
      let errorMessage: string;
      
      // Distinguish between network errors and other errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to SafeHaven API. Please check your internet connection.';
        console.error('[SafeHaven] Network error during token initialization:', error);
      } else if (error instanceof Error) {
        errorMessage = `SafeHaven token initialization error: ${error.message}`;
        console.error('[SafeHaven] Error during token initialization:', error);
      } else {
        errorMessage = 'Unknown error occurred during SafeHaven token initialization.';
        console.error('[SafeHaven] Unknown error during token initialization:', error);
      }

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
      // Try to get token from database or memory
      token = await this.getToken(userId);
      // If still no token but we have data from API response, use that
      if (!token && initResult.data) {
        const apiToken: SafeHavenToken = {
          access_token: initResult.data.access_token,
          refresh_token: initResult.data.refresh_token || '',
          token_type: initResult.data.token_type,
          expires_in: initResult.data.expires_in,
          expires_at: new Date(Date.now() + (initResult.data.expires_in * 1000)).toISOString(),
          ibs_client_id: initResult.data.ibs_client_id,
          ibs_user_id: initResult.data.ibs_user_id,
          client_id: initResult.data.client_id
        };
        // Store in memory as fallback
        this.inMemoryTokens.set(userId, apiToken);
        return apiToken;
      }
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
        // Try to get token from database or memory
        token = await this.getToken(userId);
        // If still no token but we have data from API response, use that
        if (!token && initResult.data) {
          const apiToken: SafeHavenToken = {
            access_token: initResult.data.access_token,
            refresh_token: initResult.data.refresh_token || '',
            token_type: initResult.data.token_type,
            expires_in: initResult.data.expires_in,
            expires_at: new Date(Date.now() + (initResult.data.expires_in * 1000)).toISOString(),
            ibs_client_id: initResult.data.ibs_client_id,
            ibs_user_id: initResult.data.ibs_user_id,
            client_id: initResult.data.client_id
          };
          // Store in memory as fallback
          this.inMemoryTokens.set(userId, apiToken);
          return apiToken;
        }
        return token;
      }
      token = await this.getToken(userId);
      // If still no token but we have data from refresh response, use that
      if (!token && refreshResult.data) {
        const apiToken: SafeHavenToken = {
          access_token: refreshResult.data.access_token,
          refresh_token: refreshResult.data.refresh_token || '',
          token_type: refreshResult.data.token_type,
          expires_in: refreshResult.data.expires_in,
          expires_at: new Date(Date.now() + (refreshResult.data.expires_in * 1000)).toISOString(),
          ibs_client_id: refreshResult.data.ibs_client_id,
          ibs_user_id: refreshResult.data.ibs_user_id,
          client_id: refreshResult.data.client_id
        };
        // Store in memory as fallback
        this.inMemoryTokens.set(userId, apiToken);
        return apiToken;
      }
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

      // Store the new token (may fail due to RLS, but we'll use in-memory fallback)
      const stored = await this.storeToken(userId, tokenData, tokenData.refresh_token || refreshToken);
      
      // If database storage failed, store in memory as fallback
      if (!stored) {
        const inMemoryToken: SafeHavenToken = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || refreshToken,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          ibs_client_id: tokenData.ibs_client_id,
          ibs_user_id: tokenData.ibs_user_id,
          client_id: tokenData.client_id
        };
        this.inMemoryTokens.set(userId, inMemoryToken);
        console.log('[SafeHaven] Token stored in memory as fallback');
      }

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
  private async storeToken(userId: string, tokenData: any, refreshToken: string): Promise<boolean> {
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
        .maybeSingle(); // Use maybeSingle to avoid error if no record exists

      if (fetchError && fetchError.code !== 'PGRST116') {
        // RLS policy violations are expected if policies aren't configured
        if (fetchError.code === '42501') {
          console.warn('[SafeHaven] Token storage skipped due to RLS policy (token will be used in-memory)');
          return false;
        }
        throw fetchError;
      }

      if (existingToken) {
        // Update existing token
        const { error: updateError } = await supabase
          .from('safehaven_tokens')
          .update(tokenRecord)
          .eq('user_id', userId);

        if (updateError) {
          // RLS policy violations are expected if policies aren't configured
          if (updateError.code === '42501') {
            console.warn('[SafeHaven] Token storage skipped due to RLS policy (token will be used in-memory)');
            return false;
          }
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
          // RLS policy violations are expected if policies aren't configured
          if (insertError.code === '42501') {
            console.warn('[SafeHaven] Token storage skipped due to RLS policy (token will be used in-memory)');
            return false;
          }
          throw insertError;
        }
      }

      return true;
    } catch (error) {
      // RLS policy violations are expected if policies aren't configured
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('row-level security') || (error as any)?.code === '42501') {
        console.warn('[SafeHaven] Token storage skipped due to RLS policy (token will be used in-memory)');
        return false;
      }
      console.error('[SafeHaven] Error storing SafeHaven token:', error);
      return false;
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
        // RLS policy violations are expected if policies aren't configured
        // Log as warning instead of error to avoid noise
        if (error.code === '42501') {
          console.warn('[SafeHaven] Audit logging skipped due to RLS policy (this is non-critical):', error.message);
        } else {
          console.error('[SafeHaven] Error logging SafeHaven operation:', error);
        }
        return undefined;
      }

      return data || undefined;
    } catch (error) {
      // RLS policy violations are expected if policies aren't configured
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('row-level security') || errorMessage.includes('42501')) {
        console.warn('[SafeHaven] Audit logging skipped due to RLS policy (this is non-critical)');
      } else {
        console.error('[SafeHaven] Error in SafeHaven operation logging:', error);
      }
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
      // Check if SafeHaven is configured before attempting token initialization
      if (!this.isConfigured()) {
        console.error('[SafeHaven] Service not configured. Missing CLIENT_ID or CLIENT_ASSERTION.');
        return {
          success: false,
          error: 'SafeHaven service is not configured. Please contact support.'
        };
      }

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

      // Variables to store names extracted from identity verification
      let identityFirstName = '';
      let identityLastName = '';
      let identityMiddleName = '';
      let identityDateOfBirth = '';

      // STEP 1: Create identity verification (only if identityId not provided)
      if (!currentIdentityId) {
        const defaultDebitAccountNumber = '0117753301';
        const identityRequestPayload = {
          type: 'NIN',
          async: true,
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
        
        // Extract identityId from response
        if (identityData?.data?._id) {
          currentIdentityId = identityData.data._id;
        } else if (identityData?._id) {
          currentIdentityId = identityData._id;
        } else {
          throw new Error('Identity ID not found in response');
        }

        // Extract names from identity verification response
        // SafeHaven NIN verification returns user names in the identity response
        const identityResponseData = identityData?.data || identityData;
        
        // Check multiple possible locations for names in identity response
        identityFirstName = identityResponseData?.firstName || 
                           identityResponseData?.first_name || 
                           identityResponseData?.firstName || 
                           identityResponseData?.firstname ||
                           identityResponseData?.givenName ||
                           identityResponseData?.given_name ||
                           '';
        
        identityLastName = identityResponseData?.lastName || 
                          identityResponseData?.last_name || 
                          identityResponseData?.surname ||
                          identityResponseData?.familyName ||
                          identityResponseData?.family_name ||
                          '';
        
        identityMiddleName = identityResponseData?.middleName || 
                            identityResponseData?.middle_name || 
                            identityResponseData?.otherName ||
                            identityResponseData?.other_name ||
                            '';
        
        identityDateOfBirth = identityResponseData?.dateOfBirth || 
                              identityResponseData?.date_of_birth || 
                              identityResponseData?.birthDate ||
                              identityResponseData?.birth_date ||
                              identityResponseData?.dob ||
                              '';

        // If names are in a nested structure, check there too
        if (!identityFirstName || !identityLastName) {
          const nestedData = identityResponseData?.data || identityResponseData?.identity || identityResponseData?.user;
          if (nestedData) {
            identityFirstName = identityFirstName || nestedData?.firstName || nestedData?.first_name || nestedData?.givenName || '';
            identityLastName = identityLastName || nestedData?.lastName || nestedData?.last_name || nestedData?.surname || nestedData?.familyName || '';
            identityMiddleName = identityMiddleName || nestedData?.middleName || nestedData?.middle_name || nestedData?.otherName || '';
            identityDateOfBirth = identityDateOfBirth || nestedData?.dateOfBirth || nestedData?.date_of_birth || nestedData?.dob || '';
          }
        }

        // If we have a full name string, try to parse it
        const fullName = identityResponseData?.fullName || 
                        identityResponseData?.full_name || 
                        identityResponseData?.name ||
                        identityResponseData?.accountName ||
                        identityResponseData?.account_name ||
                        '';
        
        if (fullName && (!identityFirstName || !identityLastName)) {
          const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
          if (nameParts.length > 0) {
            identityFirstName = identityFirstName || nameParts[0] || '';
            identityLastName = identityLastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '') || '';
            identityMiddleName = identityMiddleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '') || '';
          }
        }

        // Log extracted names for debugging
        if (identityFirstName || identityLastName) {
          console.log('[SafeHaven] ✅ Extracted names from identity verification:', {
            firstName: identityFirstName,
            lastName: identityLastName,
            middleName: identityMiddleName,
            dateOfBirth: identityDateOfBirth ? '***' : '',
            source: 'identity_verification_response'
          });
        } else {
          console.warn('[SafeHaven] ⚠️ No names found in identity verification response. Response structure:', {
            hasData: !!identityData?.data,
            dataKeys: identityData?.data ? Object.keys(identityData.data) : [],
            topLevelKeys: Object.keys(identityData || {}),
            sampleData: JSON.stringify(identityData, null, 2).substring(0, 500)
          });
        }

        // Update audit log with identity verification success
        await this.updateAuditLog(
          auditLogId,
          'pending', // Still pending as we need to create account
          {
            identityId: currentIdentityId,
            status: identityData?.data?.status || identityData?.status || 'PENDING',
            step: 'identity_verification_complete'
          },
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
                  status: identityData?.data?.status || identityData?.status || 'PENDING'
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
              status: identityData?.data?.status || identityData?.status || 'PENDING'
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

      // Get user data for account creation - prioritize identity verification names
      // Priority: 1. Identity verification response, 2. KYC data, 3. Profile
      let firstName = identityFirstName || '';
      let lastName = identityLastName || '';
      let middleName = identityMiddleName || '';
      let dateOfBirth = identityDateOfBirth || '';
      
      // If names not found in identity response, try KYC data
      if (!firstName || !lastName) {
        try {
          const { data: kycData } = await supabase
            .from('kyc_data')
            .select('first_name, last_name, middle_name, date_of_birth')
            .eq('user_id', userId)
            .single();

          if (kycData) {
            firstName = firstName || kycData.first_name || '';
            lastName = lastName || kycData.last_name || '';
            middleName = middleName || kycData.middle_name || '';
            dateOfBirth = dateOfBirth || kycData.date_of_birth || '';
          }
        } catch (kycError) {
          console.warn('[SafeHaven] Could not fetch KYC data:', kycError);
        }
      }

      // If still no names, try profile
      if (!firstName || !lastName) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();

          if (profile) {
            firstName = firstName || profile.first_name || '';
            lastName = lastName || profile.last_name || '';
          }
        } catch (profileError) {
          console.warn('[SafeHaven] Could not fetch profile data:', profileError);
        }
      }

      // Validate names - ensure we have valid values (not undefined or empty)
      firstName = (firstName && firstName.trim()) || '';
      lastName = (lastName && lastName.trim()) || '';
      middleName = (middleName && middleName.trim()) || '';
      dateOfBirth = (dateOfBirth && dateOfBirth.trim()) || '';

      // Log final names being used for account creation
      console.log('[SafeHaven] Names for account creation:', {
        firstName: firstName || '(empty)',
        lastName: lastName || '(empty)',
        middleName: middleName || '(empty)',
        dateOfBirth: dateOfBirth ? '***' : '(empty)',
        source: identityFirstName ? 'identity_verification' : (firstName ? 'kyc_data_or_profile' : 'none')
      });

      // Warn if we don't have names - account creation might fail
      if (!firstName || !lastName) {
        console.warn('[SafeHaven] ⚠️ Warning: Missing first name or last name for account creation. Account creation may fail or use placeholder names.');
      }
      
      const accountRequestPayload: any = {
        phoneNumber: phoneNumber,
        emailAddress: emailAddress,
        identityType: 'NIN',
        autoSweep: true,
        autoSweepDetails: {
          schedule: 'Instant'
        },
        externalReference: `AC_${userId.substring(0, 8)}`,
        identityNumber: nin,
        identityId: currentIdentityId,
        otp: otp
      };

      // Add name fields - only include if we have valid values
      // SafeHaven API requires names for account creation
      if (firstName && firstName.trim()) {
        accountRequestPayload.firstName = firstName.trim();
      }
      if (lastName && lastName.trim()) {
        accountRequestPayload.lastName = lastName.trim();
      }
      if (middleName && middleName.trim()) {
        accountRequestPayload.middleName = middleName.trim();
      }
      if (dateOfBirth && dateOfBirth.trim()) {
        accountRequestPayload.dateOfBirth = dateOfBirth.trim();
      }

      // Log the payload being sent (without sensitive data)
      console.log('[SafeHaven] Account creation payload (sanitized):', {
        ...accountRequestPayload,
        otp: '***',
        identityNumber: nin.substring(0, 4) + '****',
        hasFirstName: !!accountRequestPayload.firstName,
        hasLastName: !!accountRequestPayload.lastName,
        hasMiddleName: !!accountRequestPayload.middleName,
        hasDateOfBirth: !!accountRequestPayload.dateOfBirth
      });

      console.log('[SafeHaven] Creating sub-account with payload:', {
        ...accountRequestPayload,
        otp: '***', // Don't log OTP
        identityNumber: nin.substring(0, 4) + '****'
      });

      const accountResponse = await fetch(`${this.API_URL}/accounts/v2/subaccount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ClientID': this.CLIENT_ID,
          'Authorization': `Bearer ${token.access_token}`
        },
        body: JSON.stringify(accountRequestPayload)
      });

      console.log('[SafeHaven] Account creation response status:', accountResponse.status, accountResponse.statusText);

      const responseTime = Date.now() - startTime;

      if (!accountResponse.ok) {
        let errorText = '';
        let errorJson: any = null;
        
        try {
          errorText = await accountResponse.text();
          try {
            errorJson = JSON.parse(errorText);
          } catch {
            // Not JSON, use as text
          }
        } catch (readError) {
          console.error('[SafeHaven] Error reading error response:', readError);
          errorText = 'Unable to read error response';
        }

        const errorData = { 
          status: accountResponse.status, 
          statusText: accountResponse.statusText, 
          error: errorText,
          errorJson: errorJson,
          step: 'account_creation',
          identityId: currentIdentityId,
          requestPayload: {
            ...accountRequestPayload,
            otp: '***',
            identityNumber: nin.substring(0, 4) + '****'
          }
        };

        console.error('[SafeHaven] Account creation failed:', errorData);
        
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

        // Extract user-friendly error message
        let errorMessage = `Account creation failed: ${accountResponse.status} ${accountResponse.statusText}`;
        if (errorJson?.message) {
          errorMessage = errorJson.message;
        } else if (errorJson?.error) {
          errorMessage = errorJson.error;
        } else if (errorText && errorText.length < 200) {
          errorMessage = errorText;
        }

        return {
          success: false,
          error: errorMessage,
          auditLogId,
          responseTime,
          data: { 
            identityId: currentIdentityId, 
            requiresOtp: accountResponse.status === 400 || accountResponse.status === 422,
            errorDetails: errorData
          }
        };
      }

      let accountData: any;
      try {
        accountData = await accountResponse.json();
        console.log('[SafeHaven] Account creation response data:', JSON.stringify(accountData, null, 2));
      } catch (parseError) {
        console.error('[SafeHaven] Error parsing account creation response:', parseError);
        const responseText = await accountResponse.text();
        console.error('[SafeHaven] Raw response:', responseText);
        throw new Error('Invalid response format from SafeHaven API');
      }

      // Extract account information from response
      const verificationData: any = {
        verified: true,
        identityId: currentIdentityId,
        identityNumber: nin,
        status: accountData?.data?.status || accountData?.status || 'PENDING'
      };

      // Extract account number if available - check multiple possible locations
      // SafeHaven API may return account number in various nested structures
      let accountNumber = null;
      const accountNumberPaths = [
        // Direct paths
        accountData?.data?.accountNumber,
        accountData?.data?.account_number,
        accountData?.accountNumber,
        accountData?.account_number,
        // Nested account object
        accountData?.data?.account?.accountNumber,
        accountData?.data?.account?.account_number,
        accountData?.account?.accountNumber,
        accountData?.account?.account_number,
        // ID fields (sometimes account ID is the account number)
        accountData?.data?._id,
        accountData?._id,
        accountData?.data?.account?._id,
        accountData?.account?._id,
        // Response wrapper paths
        accountData?.data?.response?.accountNumber,
        accountData?.data?.response?.account_number,
        accountData?.response?.accountNumber,
        accountData?.response?.account_number,
        // Result paths
        accountData?.data?.result?.accountNumber,
        accountData?.data?.result?.account_number,
        accountData?.result?.accountNumber,
        accountData?.result?.account_number,
        // Subaccount paths
        accountData?.data?.subaccount?.accountNumber,
        accountData?.data?.subaccount?.account_number,
        accountData?.subaccount?.accountNumber,
        accountData?.subaccount?.account_number,
      ];

      for (const path of accountNumberPaths) {
        if (path && typeof path === 'string') {
          // Account numbers are typically 10 digits, but can be longer
          // Check if it looks like an account number (numeric, 10+ characters)
          const cleaned = path.replace(/\D/g, ''); // Remove non-digits
          if (cleaned.length >= 10) {
            accountNumber = cleaned;
            console.log('[SafeHaven] Found account number in response:', accountNumber.substring(0, 5) + '****');
            break;
          }
        }
      }
      
      if (accountNumber) {
        verificationData.account_number = accountNumber;
      } else {
        console.warn('[SafeHaven] Account number not found in response. Checking for pending status...');
        // Check if account is being created asynchronously
        const status = accountData?.data?.status || accountData?.status || 'UNKNOWN';
        const message = accountData?.data?.message || accountData?.message || '';
        console.log('[SafeHaven] Account creation status:', status, 'Message:', message);
        
        if (status === 'PENDING' || status === 'PROCESSING' || message.toLowerCase().includes('pending') || message.toLowerCase().includes('processing')) {
          verificationData.status = 'PENDING';
          verificationData.message = message || 'Account is being created. Please check back later.';
          console.log('[SafeHaven] Account creation is pending. Will store with pending status.');
        }
      }

      // Extract account name if available - check multiple possible locations
      let accountName = null;
      if (accountData?.data?.accountName) {
        accountName = accountData.data.accountName;
      } else if (accountData?.data?.account_name) {
        accountName = accountData.data.account_name;
      } else if (accountData?.accountName) {
        accountName = accountData.accountName;
      } else if (accountData?.account_name) {
        accountName = accountData.account_name;
      } else if (accountData?.data?.account?.accountName) {
        accountName = accountData.data.account.accountName;
      } else if (accountData?.data?.account?.account_name) {
        accountName = accountData.data.account.account_name;
      }
      
      // Also check for name fields directly in the response
      let responseFirstName = null;
      let responseLastName = null;
      let responseMiddleName = null;
      
      // Check for direct name fields in accountData
      if (accountData?.data?.firstName || accountData?.data?.first_name) {
        responseFirstName = accountData.data.firstName || accountData.data.first_name;
      } else if (accountData?.firstName || accountData?.first_name) {
        responseFirstName = accountData.firstName || accountData.first_name;
      }
      
      if (accountData?.data?.lastName || accountData?.data?.last_name) {
        responseLastName = accountData.data.lastName || accountData.data.last_name;
      } else if (accountData?.lastName || accountData?.last_name) {
        responseLastName = accountData.lastName || accountData.last_name;
      }
      
      if (accountData?.data?.middleName || accountData?.data?.middle_name) {
        responseMiddleName = accountData.data.middleName || accountData.data.middle_name;
      } else if (accountData?.middleName || accountData?.middle_name) {
        responseMiddleName = accountData.middleName || accountData.middle_name;
      }
      
      // Extract names from accountName if direct fields not available
      if (accountName && (!responseFirstName || !responseLastName)) {
        const names = accountName.split(' ').filter(Boolean);
        if (names.length > 0) {
          responseFirstName = responseFirstName || names[0] || '';
          responseLastName = responseLastName || names[names.length - 1] || '';
          responseMiddleName = responseMiddleName || (names.length > 2 ? names.slice(1, -1).join(' ') : '');
        }
      }
      
      // Set names in verificationData if available (prefer response names, fallback to KYC data)
      const finalFirstName = responseFirstName || firstName || '';
      const finalLastName = responseLastName || lastName || '';
      const finalMiddleName = responseMiddleName || '';
      
      if (finalFirstName || finalLastName) {
        verificationData.first_name = finalFirstName;
        verificationData.last_name = finalLastName;
        verificationData.middle_name = finalMiddleName;
        if (accountName) {
          verificationData.account_name = accountName;
        } else if (finalFirstName || finalLastName) {
          // Construct account name from individual name fields
          verificationData.account_name = [finalFirstName, finalMiddleName, finalLastName].filter(Boolean).join(' ');
        }
      } else if (accountName) {
        // Fallback: extract from accountName if no direct fields
        const names = accountName.split(' ').filter(Boolean);
        if (names.length > 0) {
          verificationData.first_name = names[0] || '';
          verificationData.last_name = names[names.length - 1] || '';
          verificationData.middle_name = names.length > 2 ? names.slice(1, -1).join(' ') : '';
          verificationData.account_name = accountName;
        }
      }
      
      // Log extracted names for debugging
      if (verificationData.first_name || verificationData.last_name) {
        console.log('[SafeHaven] Extracted names:', {
          first_name: verificationData.first_name,
          last_name: verificationData.last_name,
          middle_name: verificationData.middle_name,
          account_name: verificationData.account_name
        });
      } else {
        console.warn('[SafeHaven] Warning: Could not extract names from account response. Account data:', JSON.stringify(accountData, null, 2));
      }
      
      // If account number is not found in response, immediately fetch accounts from API
      // This matches the SafeHaven Dashboard behavior - account is created synchronously
      // We fetch immediately to get the account number without waiting for polling/webhooks
      if (!accountNumber) {
        console.log('[SafeHaven] Account number not in response. Fetching accounts immediately from API...');
        
        try {
          // Immediately fetch accounts from SafeHaven API to get the newly created account
          // Account creation is synchronous in SafeHaven, so we can fetch immediately
          const accountsResponse = await fetch(`${this.API_URL}/accounts/v2`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'ClientID': this.CLIENT_ID,
              'Authorization': `Bearer ${token.access_token}`
            }
          });

          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            const accounts = accountsData?.data || accountsData || [];
            
            console.log('[SafeHaven] Fetched accounts from API:', accounts.length, 'accounts found');
            
            // Find the newly created account by identityId or externalReference
            const externalRef = `AC_${userId.substring(0, 8)}`;
            const matchingAccount = accounts.find((acc: any) => {
              // Check by identityId (most reliable)
              if (acc.identityId === currentIdentityId || acc.identity_id === currentIdentityId) {
                return true;
              }
              // Check by externalReference
              if (acc.externalReference === externalRef || acc.external_reference === externalRef) {
                return true;
              }
              // Check if externalReference contains user ID
              if (acc.externalReference && acc.externalReference.includes(userId.substring(0, 8))) {
                return true;
              }
              if (acc.external_reference && acc.external_reference.includes(userId.substring(0, 8))) {
                return true;
              }
              return false;
            });

            if (matchingAccount) {
              // Extract account number from the matching account - check multiple locations
              const foundAccountNumber = matchingAccount.accountNumber || 
                                        matchingAccount.account_number || 
                                        matchingAccount._id ||
                                        matchingAccount.id;
              
              if (foundAccountNumber) {
                // Clean the account number (remove non-digits)
                const cleaned = foundAccountNumber.toString().replace(/\D/g, '');
                if (cleaned.length >= 10) {
                  accountNumber = cleaned;
                  verificationData.account_number = accountNumber;
                  
                  // Also update account name if available
                  if (matchingAccount.accountName || matchingAccount.account_name) {
                    accountName = matchingAccount.accountName || matchingAccount.account_name;
                    verificationData.account_name = accountName;
                  }
                  
                  // Update status if available
                  if (matchingAccount.status) {
                    verificationData.status = matchingAccount.status;
                  }
                  
                  console.log('[SafeHaven] ✅ Found account number via immediate fetch:', accountNumber.substring(0, 5) + '****');
                } else {
                  console.warn('[SafeHaven] Matching account found but account number too short:', foundAccountNumber);
                }
              } else {
                console.warn('[SafeHaven] Matching account found but no account number field:', Object.keys(matchingAccount));
              }
            } else {
              console.warn('[SafeHaven] No matching account found in fetched accounts.', {
                externalRef,
                identityId: currentIdentityId,
                totalAccounts: accounts.length,
                accountIds: accounts.map((acc: any) => ({
                  id: acc._id || acc.id,
                  identityId: acc.identityId || acc.identity_id,
                  externalRef: acc.externalReference || acc.external_reference
                }))
              });
            }
          } else {
            const errorText = await accountsResponse.text();
            console.warn('[SafeHaven] Failed to fetch accounts from API:', accountsResponse.status, accountsResponse.statusText, errorText);
          }
        } catch (fetchError) {
          console.error('[SafeHaven] Error fetching accounts immediately after creation:', fetchError);
        }
      }

      // If account number still not found, log the full response for debugging
      if (!accountNumber) {
        console.warn('[SafeHaven] Account number not found after immediate fetch. Full response structure:', {
          hasData: !!accountData?.data,
          dataKeys: accountData?.data ? Object.keys(accountData.data) : [],
          topLevelKeys: Object.keys(accountData || {}),
          status: accountData?.data?.status || accountData?.status,
          message: accountData?.data?.message || accountData?.message
        });
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
          step: 'account_creation_complete'
        },
        null,
        responseTime
      );

      // Store account - account number should be available after immediate fetch
      // Only use PENDING status if we really couldn't find the account number
      const accountStatus = verificationData.account_number ? 'active' : 'pending';
      
      // Always store the account - it should have an account number after immediate fetch
      if (verificationData.account_number) {
        console.log('[SafeHaven] ✅ Storing account with account number:', verificationData.account_number.substring(0, 5) + '****');
      } else {
        console.warn('[SafeHaven] ⚠️ Storing account without account number - will be updated when available');
      }
      
      await this.storeAccountFromNINVerification(userId, {
        account_number: verificationData.account_number || null,
        account_name: verificationData.account_name || accountData?.data?.accountName || accountData?.data?.account_name || `${verificationData.first_name} ${verificationData.last_name}`.trim() || 'Pending Account',
        account_type: 'savings',
        currency_code: 'NGN',
        status: accountStatus
      });

      // Update KYC progress with NIN verification (using id_face_verified)
      await supabase
        .from('kyc_progress')
        .update({
          id_face_verified: true,
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
      // For pending accounts, use a placeholder account number if account_number is not available
      // The account_number field is NOT NULL in the database, so we need a placeholder
      const accountNumber = verificationData.account_number || `PENDING_${userId.substring(0, 8)}_${Date.now()}`;
      
      const accountRecord: any = {
        user_id: userId,
        safehaven_account_id: verificationData.account_id || verificationData.safehaven_account_id || `PENDING_${userId.substring(0, 8)}`,
        client_id: this.CLIENT_ID || 'PENDING',
        account_product: verificationData.account_type || 'savings',
        account_number: accountNumber,
        account_name: verificationData.account_name || verificationData.full_name || 'Pending Account',
        account_type: verificationData.account_type || 'savings',
        currency_code: verificationData.currency_code || 'NGN',
        bvn: verificationData.bvn || null,
        account_balance: verificationData.account_balance || 0,
        book_balance: verificationData.book_balance || 0,
        status: verificationData.status || 'pending',
        is_default: true, // New account from NIN verification is default
        can_debit: verificationData.can_debit !== false,
        can_credit: verificationData.can_credit !== false,
        synced_at: new Date().toISOString()
      };

      // Note: identity_id and external_reference are not stored in safehaven_accounts table
      // They are tracked in audit logs instead

      // Check if account already exists (by account_number or by pending status)
      let existingAccount = null;
      
      if (verificationData.account_number && !accountNumber.startsWith('PENDING_')) {
        // Check by actual account number
        const { data } = await supabase
          .from('safehaven_accounts')
          .select('id, account_number, status')
          .eq('user_id', userId)
          .eq('account_number', verificationData.account_number)
          .maybeSingle();
        existingAccount = data;
      } else {
        // If no account number or pending, check for pending account for this user
        const { data } = await supabase
          .from('safehaven_accounts')
          .select('id, account_number, status')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .like('account_number', 'PENDING_%')
          .maybeSingle();
        existingAccount = data;
      }

      if (existingAccount) {
        // Update existing account
        console.log('[SafeHaven] Updating existing account:', {
          id: existingAccount.id,
          currentAccountNumber: existingAccount.account_number,
          newAccountNumber: accountRecord.account_number,
          status: accountRecord.status
        });
        
        const { data: updatedAccount, error: updateError } = await supabase
          .from('safehaven_accounts')
          .update({
            ...accountRecord,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAccount.id)
          .select()
          .single();

        if (updateError) {
          console.error('[SafeHaven] Error updating account:', updateError);
          throw updateError;
        }
        console.log('[SafeHaven] ✅ Updated existing account:', {
          id: updatedAccount?.id,
          accountNumber: updatedAccount?.account_number?.substring(0, 5) + '****',
          status: updatedAccount?.status
        });
      } else {
        // Insert new account
        console.log('[SafeHaven] Inserting new account:', {
          userId,
          accountNumber: accountRecord.account_number?.substring(0, 5) + '****',
          accountName: accountRecord.account_name,
          status: accountRecord.status,
          safehavenAccountId: accountRecord.safehaven_account_id?.substring(0, 10) + '...'
        });
        
        const { data: newAccount, error: insertError } = await supabase
          .from('safehaven_accounts')
          .insert({
            ...accountRecord,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('[SafeHaven] ❌ Error inserting account:', {
            error: insertError,
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            accountRecord: {
              ...accountRecord,
              account_number: accountRecord.account_number?.substring(0, 5) + '****'
            }
          });
          throw insertError;
        }
        console.log('[SafeHaven] ✅ Created new account:', {
          id: newAccount?.id,
          accountNumber: newAccount?.account_number?.substring(0, 5) + '****',
          status: newAccount?.status,
          accountName: newAccount?.account_name
        });
      }
    } catch (error) {
      console.error('[SafeHaven] Error storing account from NIN verification:', error);
      throw error;
    }
  }

  /**
   * Polls for account status if account was created asynchronously
   */
  async pollAccountStatus(userId: string, identityId: string, maxAttempts: number = 10, intervalMs: number = 5000): Promise<SafeHavenOperationResult> {
    console.log('[SafeHaven] Starting account status polling for identityId:', identityId);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        
        // Get token
        const token = await this.getValidToken(userId);
        if (!token) {
          return {
            success: false,
            error: 'Unable to get SafeHaven token for polling'
          };
        }

        // Check if account exists in database
        const { data: account } = await supabase
          .from('safehaven_accounts')
          .select('account_number, status')
          .eq('user_id', userId)
          .eq('status', 'active')
          .not('account_number', 'is', null)
          .maybeSingle();

        if (account?.account_number) {
          console.log('[SafeHaven] Account found in database:', account.account_number.substring(0, 5) + '****');
          return {
            success: true,
            data: {
              account_number: account.account_number,
              status: account.status
            }
          };
        }

        // Try to fetch accounts from SafeHaven API
        const accountsResponse = await fetch(`${this.API_URL}/accounts/v2`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ClientID': this.CLIENT_ID,
            'Authorization': `Bearer ${token.access_token}`
          }
        });

        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          const accounts = accountsData?.data || accountsData || [];
          
          // Find account by identityId or external reference
          const matchingAccount = accounts.find((acc: any) => 
            acc.identityId === identityId || 
            acc.identity_id === identityId ||
            acc.externalReference?.includes(userId.substring(0, 8))
          );

          if (matchingAccount?.accountNumber || matchingAccount?.account_number) {
            const accountNumber = matchingAccount.accountNumber || matchingAccount.account_number;
            console.log('[SafeHaven] Account found via API polling:', accountNumber.substring(0, 5) + '****');
            
            // Store the account
            await this.storeAccountFromNINVerification(userId, {
              account_number: accountNumber,
              account_name: matchingAccount.accountName || matchingAccount.account_name || 'Account',
              account_type: 'savings',
              currency_code: 'NGN',
              status: 'active'
            });

            return {
              success: true,
              data: {
                account_number: accountNumber,
                status: 'active'
              }
            };
          }
        }

        console.log(`[SafeHaven] Polling attempt ${attempt}/${maxAttempts} - account not found yet`);
      } catch (error) {
        console.error(`[SafeHaven] Error during polling attempt ${attempt}:`, error);
      }
    }

    return {
      success: false,
      error: 'Account not found after polling. Please check back later or contact support.'
    };
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
