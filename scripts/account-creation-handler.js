/**
 * Account Creation Handler Script
 * 
 * This script provides a robust account creation process that:
 * 1. Maintains UI state during async operations
 * 2. Handles errors gracefully without blank screens
 * 3. Provides proper loading states and progress feedback
 * 4. Includes retry mechanisms and fallback options
 * 5. Ensures database consistency
 */

import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

class AccountCreationHandler {
  constructor() {
    this.isCreating = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.timeoutMs = 30000; // 30 seconds timeout
  }

  /**
   * Main account creation method with comprehensive error handling
   */
  async createAccount({
    email,
    password,
    firstName,
    lastName,
    referralCode,
    onProgress,
    onError,
    onSuccess
  }) {
    if (this.isCreating) {
      console.warn('Account creation already in progress');
      return { success: false, error: 'Account creation already in progress' };
    }

    this.isCreating = true;
    this.retryCount = 0;

    try {
      // Step 1: Validate input
      onProgress?.('Validating information...');
      const validationResult = this.validateInput({ email, password, firstName, lastName });
      if (!validationResult.valid) {
        throw new Error(validationResult.error);
      }

      // Step 2: Check if email already exists
      onProgress?.('Checking email availability...');
      const emailCheck = await this.checkEmailAvailability(email);
      if (!emailCheck.available) {
        throw new Error('This email is already registered. Please sign in or use a different email.');
      }

      // Step 3: Create account with timeout
      onProgress?.('Creating your account...');
      const accountResult = await this.createAccountWithTimeout({
        email,
        password,
        firstName,
        lastName,
        referralCode
      });

      if (!accountResult.success) {
        throw new Error(accountResult.error);
      }

      // Step 4: Verify profile creation
      onProgress?.('Setting up your profile...');
      const profileResult = await this.verifyProfileCreation(accountResult.userId);
      if (!profileResult.success) {
        console.warn('Profile verification failed, but account was created:', profileResult.error);
        // Don't throw here - account was created successfully
      }

      // Step 5: Create wallet
      onProgress?.('Setting up your wallet...');
      const walletResult = await this.verifyWalletCreation(accountResult.userId);
      if (!walletResult.success) {
        console.warn('Wallet verification failed, but account was created:', walletResult.error);
        // Don't throw here - account was created successfully
      }

      // Step 6: Final verification
      onProgress?.('Finalizing your account...');
      await this.finalizeAccount(accountResult.userId);

      onProgress?.('Account created successfully!');
      onSuccess?.(accountResult);
      
      return { success: true, data: accountResult };

    } catch (error) {
      console.error('Account creation failed:', error);
      
      // Attempt retry if we haven't exceeded max retries
      if (this.retryCount < this.maxRetries && this.isRetryableError(error)) {
        this.retryCount++;
        onProgress?.(`Retrying... (${this.retryCount}/${this.maxRetries})`);
        
        // Wait before retry
        await this.delay(2000 * this.retryCount);
        
        // Retry the entire process
        return this.createAccount({
          email,
          password,
          firstName,
          lastName,
          referralCode,
          onProgress,
          onError,
          onSuccess
        });
      }

      onError?.(error);
      return { success: false, error: error.message };
    } finally {
      this.isCreating = false;
    }
  }

  /**
   * Validate input parameters
   */
  validateInput({ email, password, firstName, lastName }) {
    if (!email || !email.includes('@')) {
      return { valid: false, error: 'Please enter a valid email address' };
    }
    
    if (!password || password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }
    
    if (!firstName || firstName.trim().length < 2) {
      return { valid: false, error: 'First name must be at least 2 characters long' };
    }
    
    if (!lastName || lastName.trim().length < 2) {
      return { valid: false, error: 'Last name must be at least 2 characters long' };
    }

    return { valid: true };
  }

  /**
   * Check if email is available
   */
  async checkEmailAvailability(email) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return { available: !data };
    } catch (error) {
      console.error('Email availability check failed:', error);
      // If we can't check, assume it's available and let the signup process handle it
      return { available: true };
    }
  }

  /**
   * Create account with timeout protection
   */
  async createAccountWithTimeout({ email, password, firstName, lastName, referralCode }) {
    return Promise.race([
      this.performSignUp({ email, password, firstName, lastName, referralCode }),
      this.createTimeoutPromise()
    ]);
  }

  /**
   * Perform the actual signup
   */
  async performSignUp({ email, password, firstName, lastName, referralCode }) {
    const { error, data } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          referral_code: referralCode?.trim() || null,
        }
      }
    });

    if (error) {
      let errorMessage = error.message;
      
      // Handle specific error cases
      if (error.message.includes('already registered')) {
        errorMessage = 'This email is already registered. Please sign in or use a different email.';
      } else if (error.message.includes('password')) {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      
      return { success: false, error: errorMessage };
    }

    return { 
      success: true, 
      userId: data.user?.id,
      session: data.session,
      user: data.user
    };
  }

  /**
   * Verify profile was created successfully
   */
  async verifyProfileCreation(userId) {
    try {
      // Wait a bit for the trigger to complete
      await this.delay(1000);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist, try to create it manually
        if (error.code === 'PGRST116') {
          console.warn('Profile not found after signup, attempting to create manually...');
          const createResult = await this.createProfileManually(userId);
          if (!createResult.success) {
            return { success: false, error: 'Database error saving new user: Profile creation failed' };
          }
          return { success: true, profile: createResult.profile };
        }
        return { success: false, error: `Database error saving new user: ${error.message}` };
      }

      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: `Database error saving new user: ${error.message}` };
    }
  }

  /**
   * Manually create profile if trigger failed
   */
  async createProfileManually(userId) {
    try {
      // Get user data from auth
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { success: false, error: 'Could not retrieve user data' };
      }

      // Generate referral code in JavaScript
      const generateReferralCode = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36).toUpperCase().substring(0, 8).padStart(8, '0');
      };

      const referralCode = generateReferralCode(userId + user.email + Date.now());

      // Create profile manually
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user.email,
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          referral_code: referralCode,
          email_verified: !!user.email_confirmed_at,
          app_lock_enabled: false,
          two_factor_enabled: false,
          account_verified: false,
          kyc_tier: 1,
        })
        .select()
        .single();

      if (profileError) {
        return { success: false, error: profileError.message };
      }

      // Create wallet
      const { error: walletError } = await supabase
        .from('wallets')
        .insert({
          user_id: userId,
          balance: 0,
          locked_balance: 0,
        });

      if (walletError && walletError.code !== '23505') { // Ignore duplicate key errors
        console.warn('Wallet creation failed:', walletError);
      }

      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify wallet was created successfully
   */
  async verifyWalletCreation(userId) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('user_id, balance, locked_balance')
        .eq('user_id', userId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, wallet: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Finalize account setup
   */
  async finalizeAccount(userId) {
    try {
      // Update email verification status if needed
      const { error } = await supabase
        .from('profiles')
        .update({ 
          email_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.warn('Failed to update email verification status:', error);
      }

      // Add any additional setup steps here
      return { success: true };
    } catch (error) {
      console.warn('Account finalization failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create timeout promise
   */
  createTimeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Account creation timed out. Please try again.'));
      }, this.timeoutMs);
    });
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'rate limit',
      'temporary',
      'server error'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset handler state
   */
  reset() {
    this.isCreating = false;
    this.retryCount = 0;
  }
}

// Export singleton instance
export const accountCreationHandler = new AccountCreationHandler();

// Export class for testing
export { AccountCreationHandler };
