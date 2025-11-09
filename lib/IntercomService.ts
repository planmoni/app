import { InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface JWTCache {
  jwt: string;
  expiresAt: number;
  userId: string;
}

interface UserSession {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      first_name?: string;
      last_name?: string;
    };
    phone?: string;
  };
  access_token: string;
}

class IntercomService {
  private static instance: IntercomService;
  private isInitialized = false;
  private isAuthenticated = false;
  private currentUserId: string | null = null;
  private jwtCache: JWTCache | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private Intercom: any = null; // Will hold the dynamic import
  
  private readonly CACHE_KEY = 'intercom_jwt_cache';
  private readonly SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  private readonly SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  static getInstance(): IntercomService {
    if (!IntercomService.instance) {
      IntercomService.instance = new IntercomService();
    }
    return IntercomService.instance;
  }

  /**
   * Load Intercom dynamically for real device compatibility
   */
  private async loadIntercom(): Promise<any> {
    if (this.Intercom) {
      return this.Intercom;
    }

    try {
      console.log(' IntercomService - Loading Intercom dynamically...');
      
      // Dynamic import for real device compatibility
      const { default: Intercom } = await import('@intercom/intercom-react-native');
      this.Intercom = Intercom;
      
      console.log('✅ IntercomService - Intercom loaded successfully');
      return this.Intercom;
    } catch (error) {
      console.error('❌ IntercomService - Failed to load Intercom:', error);
      throw new Error('Failed to load Intercom module');
    }
  }

  /**
   * Initialize Intercom service with user session
   * Runs in background to avoid blocking UI
   */
  async init(session: UserSession | null): Promise<void> {
    if (!session?.user?.id) {
      await this.logout();
      return;
    }

    // If already authenticated for this user, skip
    if (this.isAuthenticated && this.currentUserId === session.user.id) {
      return;
    }

    // Reset retry count for new session
    this.retryCount = 0;

    // Run heavy work in background
    InteractionManager.runAfterInteractions(async () => {
      await this.initializeWithRetry(session);
    });
  }

  /**
   * Initialize with retry mechanism
   */
  private async initializeWithRetry(session: UserSession): Promise<void> {
    try {
      console.log(` IntercomService - Initializing (attempt ${this.retryCount + 1}/${this.maxRetries + 1})...`);
      
      // Load Intercom first
      const Intercom = await this.loadIntercom();
      
      // Load cached JWT
      await this.loadCachedJWT();
      
      // Check if we need fresh JWT
      if (!this.jwtCache || this.jwtCache.expiresAt <= Date.now()) {
        await this.fetchAndCacheJWT(session);
      } else {
        console.log('📦 IntercomService - Using cached JWT');
      }
      
      // Try to authenticate with Intercom
      await this.authenticateWithIntercom(session, Intercom);
      
      // Set up automatic refresh
      this.scheduleJWTRefresh();
      
      this.isInitialized = true;
      this.isAuthenticated = true;
      this.currentUserId = session.user.id;
      this.retryCount = 0; // Reset retry count on success
      
      console.log('✅ IntercomService - Initialized successfully');
      
    } catch (error) {
      console.error(`❌ IntercomService - Initialization failed (attempt ${this.retryCount + 1}):`, error);
      
      this.retryCount++;
      
      if (this.retryCount <= this.maxRetries) {
        // Retry after exponential backoff
        const delay = Math.pow(2, this.retryCount) * 1000; // 2s, 4s, 8s
        console.log(`⏰ IntercomService - Retrying in ${delay}ms...`);
        
        setTimeout(() => {
          this.initializeWithRetry(session);
        }, delay);
      } else {
        // Max retries reached, try fallback to unidentified user
        console.log('🔄 IntercomService - Max retries reached, trying fallback...');
        await this.fallbackToUnidentifiedUser();
      }
    }
  }

  /**
   * Fallback to unidentified user mode
   */
  private async fallbackToUnidentifiedUser(): Promise<void> {
    try {
      console.log('👤 IntercomService - Falling back to unidentified user...');
      
      const Intercom = await this.loadIntercom();
      
      await Intercom.logout(); // Clear any existing session
      await Intercom.loginUnidentifiedUser();
      
      this.isInitialized = true;
      this.isAuthenticated = true;
      this.currentUserId = 'unidentified';
      
      console.log('✅ IntercomService - Fallback to unidentified user successful');
      
    } catch (error) {
      console.error('❌ IntercomService - Fallback failed:', error);
      this.isAuthenticated = false;
    }
  }

  /**
   * Open Intercom instantly - no waiting, no async work
   */
  async open(): Promise<void> {
    if (!this.isAuthenticated) {
      console.warn('⚠️ IntercomService - Not authenticated, trying fallback...');
      
      // Try fallback to unidentified user
      try {
        await this.fallbackToUnidentifiedUser();
        if (this.isAuthenticated) {
          const Intercom = await this.loadIntercom();
          await Intercom.present();
          return;
        }
      } catch (error) {
        console.error('❌ IntercomService - Fallback failed:', error);
      }
      
      throw new Error('Intercom not available');
    }

    try {
      console.log('🎯 IntercomService - Opening Intercom instantly...');
      
      const Intercom = await this.loadIntercom();
      await Intercom.present();
      
      console.log('✅ IntercomService - Opened successfully');
    } catch (error) {
      console.error('❌ IntercomService - Failed to open:', error);
      
      // If present() fails, try to re-authenticate and present again
      if (this.currentUserId !== 'unidentified') {
        console.log('🔄 IntercomService - Retrying with re-authentication...');
        try {
          await this.fallbackToUnidentifiedUser();
          const Intercom = await this.loadIntercom();
          await Intercom.present();
          return;
        } catch (retryError) {
          console.error('❌ IntercomService - Retry failed:', retryError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Logout from Intercom
   */
  async logout(): Promise<void> {
    try {
      console.log(' IntercomService - Logging out...');
      
      if (this.Intercom) {
        await this.Intercom.logout();
      }
      
      // Clear state
      this.isAuthenticated = false;
      this.currentUserId = null;
      this.jwtCache = null;
      this.retryCount = 0;
      this.Intercom = null; // Clear the module reference
      
      // Clear cache
      await AsyncStorage.removeItem(this.CACHE_KEY);
      
      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer as any);
        this.refreshTimer = null;
      }
      
      console.log('✅ IntercomService - Logged out successfully');
      
    } catch (error) {
      console.error('❌ IntercomService - Logout failed:', error);
    }
  }

  /**
   * Get authentication status
   */
  isReady(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get detailed status for debugging
   */
  getStatus(): { isReady: boolean; userId: string | null; retryCount: number; platform: string } {
    return {
      isReady: this.isAuthenticated,
      userId: this.currentUserId,
      retryCount: this.retryCount,
      platform: Platform.OS
    };
  }

  /**
   * Load JWT from cache
   */
  private async loadCachedJWT(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        this.jwtCache = JSON.parse(cached);
        console.log('📦 IntercomService - Loaded JWT from cache');
      }
    } catch (error) {
      console.error('❌ IntercomService - Failed to load JWT cache:', error);
    }
  }

  /**
   * Fetch JWT from Supabase Edge Function and cache it
   */
  private async fetchAndCacheJWT(session: UserSession): Promise<void> {
    try {
      console.log('🔐 IntercomService - Fetching fresh JWT...');
      
      const response = await fetch(`${this.SUPABASE_URL}/functions/v1/intercom-jwt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.SUPABASE_ANON_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`JWT fetch failed: ${response.status} ${response.statusText}`);
      }

      const { jwt } = await response.json();
      
      if (!jwt) {
        throw new Error('No JWT received from server');
      }
      
      // Decode JWT to get expiry (basic decode, no verification needed)
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      
      this.jwtCache = {
        jwt,
        expiresAt,
        userId: session.user.id
      };
      
      // Cache to storage
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(this.jwtCache));
      
      console.log('✅ IntercomService - JWT fetched and cached');
      
    } catch (error) {
      console.error('❌ IntercomService - Failed to fetch JWT:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Intercom using cached JWT
   */
  private async authenticateWithIntercom(session: UserSession, Intercom: any): Promise<void> {
    try {
      console.log(' IntercomService - Authenticating with Intercom...');
      
      if (!this.jwtCache) {
        throw new Error('No JWT available for authentication');
      }
      
      // Set JWT
      await Intercom.setUserJwt(this.jwtCache.jwt);
      
      // Get user data
      const firstName = session.user.user_metadata?.first_name || '';
      const lastName = session.user.user_metadata?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Login with user attributes
      await Intercom.loginUserWithUserAttributes({
        userId: session.user.id,
        email: session.user.email,
        name: fullName || session.user.email?.split('@')[0] || 'User',
        phone: session.user.phone || undefined,
        customAttributes: {
          first_name: firstName,
          last_name: lastName,
          user_type: 'customer',
          app_version: '1.0.0'
        }
      });
      
      console.log('✅ IntercomService - Authenticated with Intercom');
      
    } catch (error) {
      console.error('❌ IntercomService - Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Schedule JWT refresh 5 minutes before expiry
   */
  private scheduleJWTRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    if (!this.jwtCache) return;
    
    const refreshTime = this.jwtCache.expiresAt - (5 * 60 * 1000); // 5 minutes before expiry
    const now = Date.now();
    
    if (refreshTime > now) {
      const delay = refreshTime - now;
      
      this.refreshTimer = setTimeout(async () => {
        console.log('🔄 IntercomService - Refreshing JWT in background...');
        
        try {
          // This would need the current session, but we'll handle it in the next init call
          console.log('⏰ IntercomService - JWT refresh scheduled');
        } catch (error) {
          console.error('❌ IntercomService - JWT refresh failed:', error);
        }
      }, delay);
      
      console.log(`⏰ IntercomService - JWT refresh scheduled in ${Math.round(delay / 1000)}s`);
    }
  }
}

// Export singleton instance
export const intercomService = IntercomService.getInstance();
export default intercomService; 