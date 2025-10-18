import { Platform } from 'react-native';

// Global state for instant Intercom access
let isIntercomAuthenticated = false;
let intercomModule: any = null;
let isModuleLoaded = false;
let isInitialized = false;

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
      
      // Pre-load the Intercom module
      await this.loadModule();
      
      // Set up basic Intercom configuration
      await this.configureIntercom();
      
      isInitialized = true;
      console.log('✅ IntercomInstant initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize IntercomInstant:', error);
      throw error;
    }
  }

  /**
   * Pre-load Intercom module for instant access
   */
  private async loadModule(): Promise<void> {
    if (isModuleLoaded && intercomModule) {
      return;
    }

    try {
      console.log('📦 Loading Intercom module...');
      const { default: Intercom } = await import('@intercom/intercom-react-native');
      intercomModule = Intercom;
      isModuleLoaded = true;
      console.log('✅ Intercom module loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load Intercom module:', error);
      throw error;
    }
  }

  /**
   * Configure Intercom for optimal performance
   */
  private async configureIntercom(): Promise<void> {
    if (!intercomModule) {
      throw new Error('Intercom module not loaded');
    }

    try {
      // Set up Intercom configuration for instant access
      await intercomModule.setLauncherVisibility('GONE');
      await intercomModule.setInAppMessageVisibility('VISIBLE');
      
      console.log('✅ Intercom configured for instant access');
    } catch (error) {
      console.error('❌ Failed to configure Intercom:', error);
      throw error;
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

    if (!intercomModule) {
      console.warn('⚠️ Intercom module not loaded, skipping authentication');
      return;
    }

    try {
      console.log('👤 Authenticating user with Intercom:', { userId, email, name });
      
      await intercomModule.loginUserWithUserAttributes({
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

    if (!intercomModule) {
      throw new Error('Intercom module not available');
    }

    try {
      console.log('🎯 Opening Intercom instantly...');
      await intercomModule.present();
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
    if (!intercomModule) {
      return;
    }

    try {
      await intercomModule.logout();
      isIntercomAuthenticated = false;
      console.log('✅ Logged out from Intercom');
    } catch (error) {
      console.error('❌ Failed to logout from Intercom:', error);
    }
  }

  /**
   * Check if Intercom is ready for instant access
   */
  isReady(): boolean {
    return isInitialized && isModuleLoaded && !!intercomModule;
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
