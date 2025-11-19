import { Platform } from 'react-native';
import Intercom from '@intercom/intercom-react-native';

// Global state for instant Intercom access
let isIntercomAuthenticated = false;
let isInitialized = false;
let isRegisteringToken = false;
let lastRegisteredToken: string | null = null;

class IntercomInstant {
  private static instance: IntercomInstant;

  static getInstance(): IntercomInstant {
    if (!IntercomInstant.instance) {
      IntercomInstant.instance = new IntercomInstant();
    }
    return IntercomInstant.instance;
  }

  /**
   * Initialize Intercom at app startup for instant access
   */
  async initialize(): Promise<void> {
    if (isInitialized) {
      console.log('✅ IntercomInstant already initialized');
      return;
    }

    if (Platform.OS === 'web') {
      console.log('⚠️ Intercom not supported on web platform');
      return;
    }

    try {
      console.log('🚀 Initializing IntercomInstant for instant access...');
      
      // Add a small delay to ensure native module is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set up basic Intercom configuration
      await this.configureIntercom();
      
      isInitialized = true;
      console.log('✅ IntercomInstant initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize IntercomInstant:', error);
      // Don't throw error - let the app continue without Intercom
      console.warn('⚠️ Continuing without Intercom initialization');
    }
  }


  /**
   * Configure Intercom for optimal performance
   */
  private async configureIntercom(): Promise<void> {
    try {
      // Set up Intercom configuration for instant access
      // Note: We don't set launcher visibility here as it's handled in AppDelegate
      await Intercom.setInAppMessageVisibility('VISIBLE');
      
      console.log('✅ Intercom configured for instant access');
    } catch (error) {
      console.error('❌ Failed to configure Intercom:', error);
      // Don't throw error - let the app continue
      console.warn('⚠️ Continuing without Intercom configuration');
    }
  }

  /**
   * Register push token with Intercom for push notifications
   */
  async registerPushToken(expoPushToken: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        console.log('⚠️ Push notifications not supported on web');
        return;
      }

      // Prevent multiple simultaneous registrations
      if (isRegisteringToken) {
        console.log('ℹ️ Token registration already in progress, skipping...');
        return;
      }

      // Skip if we're trying to register the same token again
      if (lastRegisteredToken === expoPushToken) {
        console.log('ℹ️ Token already registered with Intercom, skipping...');
        return;
      }

      if (!expoPushToken || !expoPushToken.trim()) {
        console.warn('⚠️ Invalid push token provided to Intercom');
        return;
      }

      // Ensure Intercom is initialized before registering token
      if (!isInitialized) {
        console.log('🔄 Intercom not initialized, initializing now...');
        await this.initialize();
      }

      // Set flag to prevent concurrent calls
      isRegisteringToken = true;

      // Add a small delay to ensure Intercom is fully ready
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('📱 Registering push token with Intercom...');
      await Intercom.sendTokenToIntercom(expoPushToken);
      
      // Store the successfully registered token
      lastRegisteredToken = expoPushToken;
      console.log('✅ Push token registered with Intercom successfully');
    } catch (error: any) {
      // Reset flag on error
      isRegisteringToken = false;
      
      // Use warn instead of error since this is non-critical
      // Intercom push notifications are optional and the error is already handled gracefully
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('sendTokenToIntercom') || errorMessage.includes('already been rejected')) {
        // This is a known issue - Intercom might not be ready or user might not be authenticated
        // It's safe to ignore as push notifications will work once Intercom is properly set up
        console.log('ℹ️ Intercom push token registration skipped (will retry after authentication)');
      } else {
        console.warn('⚠️ Failed to register push token with Intercom:', errorMessage);
      }
      // Don't throw - push notifications are optional
    } finally {
      // Always reset the flag
      isRegisteringToken = false;
    }
  }

  /**
   * Authenticate user with Intercom (background process)
   */
  async authenticateUser(userId: string, email: string, name: string, phone?: string): Promise<void> {
    if (isIntercomAuthenticated) {
      console.log('✅ User already authenticated with Intercom');
      return;
    }

    try {
      console.log('👤 Authenticating user with Intercom:', { userId, email, name });
      
      await Intercom.loginUserWithUserAttributes({
        userId,
        email,
        name,
        phone,
        customAttributes: {
          user_type: 'customer',
          app_version: '1.0.0'
        }
      });
      
      isIntercomAuthenticated = true;
      console.log('✅ User authenticated with Intercom successfully');
      
      // Register push token with Intercom after authentication
      try {
        const { registerForPushNotificationsAsync } = await import('@/lib/notifications');
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await this.registerPushToken(token);
        }
      } catch (tokenError) {
        console.warn('⚠️ Failed to register push token with Intercom:', tokenError);
      }
      
    } catch (error) {
      console.error('❌ Failed to authenticate user with Intercom:', error);
      // Don't throw error - we can still open Intercom as unidentified user
    }
  }

  /**
   * Open Intercom instantly - no loading, no waiting
   */
  async open(): Promise<void> {
    if (Platform.OS === 'web') {
      throw new Error('Intercom is not supported on web platform');
    }

    if (!isInitialized) {
      console.warn('⚠️ IntercomInstant not initialized, initializing now...');
      await this.initialize();
    }

    try {
      console.log('🎯 Opening Intercom instantly...');
      await Intercom.present();
      console.log('✅ Intercom opened successfully');
    } catch (error) {
      console.error('❌ Failed to open Intercom:', error);
      throw error;
    }
  }

  /**
   * Logout from Intercom
   */
  async logout(): Promise<void> {
    try {
      await Intercom.logout();
      isIntercomAuthenticated = false;
      lastRegisteredToken = null; // Reset token so it can be registered again after re-login
      console.log('✅ Logged out from Intercom');
    } catch (error) {
      console.error('❌ Failed to logout from Intercom:', error);
    }
  }

  /**
   * Check if Intercom is ready for instant access
   */
  isReady(): boolean {
    return isInitialized;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return isIntercomAuthenticated;
  }
}

// Export singleton instance
export const intercomInstant = IntercomInstant.getInstance();
export default intercomInstant;
