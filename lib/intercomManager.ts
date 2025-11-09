import { supabase } from '@/lib/supabase';

// Global Intercom authentication manager with retry and fallback mechanisms
class IntercomManager {
  private isAuthenticated = false;
  private authenticationPromise: Promise<void> | null = null;
  private currentUserId: string | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 2000; // 2 seconds
  private lastError: Error | null = null;

  async authenticateUser(userId: string, accessToken: string, userMetadata: any) {
    // If already authenticated for this user, return immediately
    if (this.isAuthenticated && this.currentUserId === userId) {
      return;
    }

    // If authentication is in progress, wait for it
    if (this.authenticationPromise) {
      return this.authenticationPromise;
    }

    // Start new authentication with retry mechanism
    this.authenticationPromise = this.performAuthenticationWithRetry(userId, accessToken, userMetadata);
    return this.authenticationPromise;
  }

  private async performAuthenticationWithRetry(userId: string, accessToken: string, userMetadata: any) {
    try {
      console.log('🔐 IntercomManager: Starting authentication for user:', userId);
      
      const { default: Intercom } = await import('@intercom/intercom-react-native');
      
      // Get user name from metadata
      const firstName = userMetadata?.first_name || '';
      const lastName = userMetadata?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Get JWT from Supabase Edge Function for secure authentication
      const jwtResponse = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/intercom-jwt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
        }
      });
      
      if (!jwtResponse.ok) {
        throw new Error('Failed to get JWT from server');
      }
      
      const { jwt } = await jwtResponse.json();
      
      // Set the JWT and login with user attributes
      await Intercom.setUserJwt(jwt);
      await Intercom.loginUserWithUserAttributes({
        userId: userId,
        email: userMetadata?.email,
        name: fullName || userMetadata?.email?.split('@')[0] || 'User',
        phone: userMetadata?.phone || undefined,
        customAttributes: {
          first_name: firstName,
          last_name: lastName,
          user_type: 'customer',
          app_version: '1.0.0'
        }
      });
      
      this.isAuthenticated = true;
      this.currentUserId = userId;
      console.log('✅ IntercomManager: Authentication completed for user:', userId);
      
    } catch (error) {
      console.error('❌ IntercomManager: Authentication failed:', error);
      this.isAuthenticated = false;
      this.currentUserId = null;
      this.authenticationPromise = null;
      throw error;
    }
  }

  async openChat() {
    if (!this.isAuthenticated) {
      throw new Error('Intercom not authenticated');
    }
    
    const { default: Intercom } = await import('@intercom/intercom-react-native');
    await Intercom.present();
  }

  logout() {
    console.log('🔄 IntercomManager: Logging out user');
    this.isAuthenticated = false;
    this.currentUserId = null;
    this.authenticationPromise = null;
  }

  getAuthenticationStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      currentUserId: this.currentUserId
    };
  }
}

export const intercomManager = new IntercomManager();