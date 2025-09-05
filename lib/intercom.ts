import { Platform } from 'react-native';
import Intercom, { 
  Visibility
} from '@intercom/intercom-react-native';

// Define types based on what's available
interface IntercomUserAttributes {
  userId?: string;
  email?: string;
  name?: string;
  company?: string;
  [key: string]: any;
}

class IntercomService {
  private static instance: IntercomService;
  private isInitialized: boolean = false;

  static getInstance(): IntercomService {
    if (!IntercomService.instance) {
      IntercomService.instance = new IntercomService();
    }
    return IntercomService.instance;
  }

  /**
   * Initialize Intercom with configuration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Intercom already initialized');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        console.log('Intercom not supported on web');
        return;
      }

      // Set up Intercom configuration
      await Intercom.setLauncherVisibility(Visibility.GONE);
      await Intercom.setInAppMessageVisibility(Visibility.VISIBLE);
      
      this.isInitialized = true;
      console.log('Intercom initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Intercom:', error);
    }
  }

  /**
   * Login unidentified user (for guests)
   */
  async loginUnidentifiedUser(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      await Intercom.loginUnidentifiedUser();
      console.log('Logged in unidentified user to Intercom');
    } catch (error) {
      console.error('Failed to login unidentified user:', error);
    }
  }

  /**
   * Login user with attributes
   */
  async loginUser(userId: string, email: string, name?: string, company?: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const userAttributes: IntercomUserAttributes = {
        userId,
        email,
        ...(name && { name }),
        ...(company && { company })
      };

      await Intercom.loginUserWithUserAttributes(userAttributes);
      console.log('Logged in user to Intercom:', userAttributes);
    } catch (error) {
      console.error('Failed to login user to Intercom:', error);
    }
  }

  /**
   * Update user attributes
   */
  async updateUser(attributes: Partial<IntercomUserAttributes>): Promise<void> {
    try {
      if (!this.isInitialized) {
        console.warn('Intercom not initialized, cannot update user');
        return;
      }

      await Intercom.updateUser(attributes);
      console.log('Updated user attributes in Intercom:', attributes);
    } catch (error) {
      console.error('Failed to update user in Intercom:', error);
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      if (!this.isInitialized) {
        console.warn('Intercom not initialized, cannot logout');
        return;
      }

      await Intercom.logout();
      console.log('Logged out user from Intercom');
    } catch (error) {
      console.error('Failed to logout from Intercom:', error);
    }
  }

  /**
   * Show Intercom messenger
   */
  async present(): Promise<void> {
    try {
      if (!this.isInitialized) {
        console.warn('Intercom not initialized, cannot present messenger');
        return;
      }

      await Intercom.present();
      console.log('Presented Intercom messenger');
    } catch (error) {
      console.error('Failed to present Intercom messenger:', error);
    }
  }

  /**
   * Set launcher visibility
   */
  async setLauncherVisibility(visibility: Visibility): Promise<void> {
    try {
      if (!this.isInitialized) {
        console.warn('Intercom not initialized, cannot set launcher visibility');
        return;
      }

      await Intercom.setLauncherVisibility(visibility);
      console.log('Set Intercom launcher visibility:', visibility);
    } catch (error) {
      console.error('Failed to set Intercom launcher visibility:', error);
    }
  }

  /**
   * Set in-app message visibility
   */
  async setInAppMessageVisibility(visibility: Visibility): Promise<void> {
    try {
      if (!this.isInitialized) {
        console.warn('Intercom not initialized, cannot set in-app message visibility');
        return;
      }

      await Intercom.setInAppMessageVisibility(visibility);
      console.log('Set Intercom in-app message visibility:', visibility);
    } catch (error) {
      console.error('Failed to set Intercom in-app message visibility:', error);
    }
  }

  /**
   * Check if Intercom is supported on current platform
   */
  isSupported(): boolean {
    return Platform.OS !== 'web';
  }

  /**
   * Check if Intercom is initialized
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const intercomService = IntercomService.getInstance();

// Export types and values for convenience
export { 
  Visibility
};

export type { 
  IntercomUserAttributes
};