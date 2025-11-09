import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { logAnalyticsEvent } from '@/lib/firebase';

// Global state for instant Intercom access
let isIntercomAuthenticated = false;
let authenticationPromise: Promise<void> | null = null;
let intercomModule: any = null;
let isModuleLoaded = false;

// Pre-load Intercom module for instant access
const loadIntercomModule = async () => {
  if (isModuleLoaded && intercomModule) {
    return intercomModule;
  }
  
  try {
    console.log('📦 Pre-loading Intercom module...');
    const { default: Intercom } = await import('@intercom/intercom-react-native');
    intercomModule = Intercom;
    isModuleLoaded = true;
    console.log('✅ Intercom module pre-loaded successfully');
    return Intercom;
  } catch (error) {
    console.error('❌ Failed to pre-load Intercom module:', error);
    throw error;
  }
};

// Helper function to create timeout for fetch requests
const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
  });
  
  return controller.signal;
};

export function useIntercomInstant() {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();
  const isInitialized = useRef(false);

  // Check if Intercom is supported on this platform
  const isSupported = Platform.OS !== 'web';

  // Pre-load Intercom module when hook is first used
  useEffect(() => {
    if (isSupported && !isModuleLoaded) {
      loadIntercomModule().catch(error => {
        console.warn('Failed to pre-load Intercom module:', error);
      });
    }
  }, [isSupported]);

  const authenticateIntercom = useCallback(async () => {
    // If already authenticated, return immediately
    if (isIntercomAuthenticated) {
      console.log('✅ Intercom already authenticated');
      return;
    }

    // If authentication is in progress, wait for it
    if (authenticationPromise) {
      console.log('⏳ Intercom authentication in progress, waiting...');
      return authenticationPromise;
    }

    // Check if we have a valid session
    if (!session?.user?.id) {
      console.log('⚠️ No user session available for Intercom authentication');
      return;
    }

    console.log('🚀 Starting Intercom authentication...');
    
    authenticationPromise = (async () => {
      try {
        const Intercom = await loadIntercomModule();
        
        // Get user data
        const firstName = session.user.user_metadata?.first_name || '';
        const lastName = session.user.user_metadata?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || session.user.email?.split('@')[0] || 'User';
        
        console.log('👤 Authenticating user:', {
          userId: session.user.id,
          email: session.user.email,
          name: fullName
        });

        // Login with user attributes
        await Intercom.loginUserWithUserAttributes({
          userId: session.user.id,
          email: session.user.email,
          name: fullName,
          phone: session.user.phone || undefined,
          customAttributes: {
            first_name: firstName,
            last_name: lastName,
            user_type: 'customer',
            app_version: '1.0.0'
          }
        });
        
        isIntercomAuthenticated = true;
        console.log('✅ Intercom authentication completed successfully');
        
      } catch (error) {
        console.error('❌ Intercom authentication failed:', error);
        isIntercomAuthenticated = false;
        authenticationPromise = null;
        throw error;
      }
    })();

    return authenticationPromise;
  }, [session]);

  // Start background authentication when user session is available
  useEffect(() => {
    if (session?.user?.id && !isIntercomAuthenticated && !authenticationPromise && isSupported) {
      console.log('🚀 Starting background Intercom authentication...');
      authenticateIntercom().catch(error => {
        console.warn('Background Intercom authentication failed:', error);
      });
    }
  }, [session, authenticateIntercom, isSupported]);

  // Reset authentication state when user logs out
  useEffect(() => {
    if (!session?.user?.id) {
      console.log('🔄 User logged out, resetting Intercom authentication state');
      isIntercomAuthenticated = false;
      authenticationPromise = null;
    }
  }, [session?.user?.id]);

  // INSTANT Intercom opening - no loading, no waiting
  const openIntercom = useCallback(async () => {
    try {
      console.log('🎯 Opening Intercom instantly...');
      
      // Check platform support
      if (!isSupported) {
        throw new Error('Intercom is not supported on web platform');
      }

      // Get the pre-loaded Intercom module
      const Intercom = await loadIntercomModule();
      
      // Try to open immediately - if not authenticated, it will still open as unidentified user
      console.log('🚀 Presenting Intercom (instant mode)...');
      await Intercom.present();
      
      console.log('✅ Intercom opened successfully');
      logAnalyticsEvent('intercom_chat_opened');
      
    } catch (error) {
      console.error('❌ Failed to open Intercom:', error);
      
      // Show user-friendly error with retry option
      Alert.alert(
        'Support Chat Unavailable',
        'Unable to open support chat at the moment. This might be due to network connectivity issues. Would you like to try again?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => {
              console.log('🔄 Retrying Intercom...');
              openIntercom();
            }
          }
        ]
      );
    }
  }, [isSupported]);

  // Alias for compatibility
  const present = openIntercom;

  return {
    openIntercom,
    present,
    isLoading: false, // Always false since we don't show loading for instant mode
    isAuthenticated: isIntercomAuthenticated,
    isSupported,
    isModuleLoaded
  };
}
