import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { logAnalyticsEvent } from '@/lib/firebase';

// Global state to track authentication status
let isIntercomAuthenticated = false;
let authenticationPromise: Promise<void> | null = null;
let lastAuthenticationAttempt = 0;
const AUTHENTICATION_COOLDOWN = 30000; // 30 seconds

// Helper function to create timeout for fetch requests
const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  // Clean up timeout when signal is aborted
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
  });
  
  return controller.signal;
};

export function useIntercom() {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  // Check if Intercom is supported on this platform
  const isSupported = Platform.OS !== 'web';

  // Enhanced authentication function with better error handling and fallbacks
  const authenticateIntercom = useCallback(async () => {
    // If already authenticated, return immediately
    if (isIntercomAuthenticated) {
      console.log('✅ Intercom already authenticated, skipping...');
      return;
    }

    // Check cooldown to prevent rapid retries
    const now = Date.now();
    if (now - lastAuthenticationAttempt < AUTHENTICATION_COOLDOWN) {
      console.log('🕐 Intercom authentication in cooldown period, skipping...');
      return;
    }

    // If authentication is in progress, wait for it
    if (authenticationPromise) {
      console.log('⏳ Intercom authentication in progress, waiting...');
      return authenticationPromise;
    }

    // Start new authentication
    lastAuthenticationAttempt = now;
    authenticationPromise = (async () => {
      try {
        console.log('🔐 Background Intercom authentication starting...');
        console.log('📱 Platform:', Platform.OS);
        console.log('👤 Session exists:', !!session);
        console.log(' User ID:', session?.user?.id);
        
        const { default: Intercom } = await import('@intercom/intercom-react-native');
        console.log('📦 Intercom module loaded successfully');
        
        if (!session?.user?.id) {
          console.log('👤 No user session, logging in as unidentified user...');
          await Intercom.loginUnidentifiedUser();
          console.log('✅ Unidentified user logged in');
        } else {
          console.log(' User session found, authenticating with user data...');
          
          // Get user name from metadata
          const firstName = session.user.user_metadata?.first_name || '';
          const lastName = session.user.user_metadata?.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          
          console.log('👤 User data for Intercom:', {
            userId: session.user.id,
            email: session.user.email,
            firstName,
            lastName,
            fullName
          });
          
          // Try to get JWT with timeout and fallback
          let jwt = null;
          try {
            console.log('🔐 Getting JWT from server...');
            console.log('🌐 Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
            
            const jwtResponse = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/intercom-jwt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
              },
              // Add timeout to prevent hanging - using compatible method
              signal: createTimeoutSignal(10000) // 10 second timeout
            });
            
            console.log('📡 JWT Response status:', jwtResponse.status);
            console.log(' JWT Response ok:', jwtResponse.ok);
            
            if (!jwtResponse.ok) {
              throw new Error(`JWT request failed with status: ${jwtResponse.status}`);
            }
            
            const jwtData = await jwtResponse.json();
            jwt = jwtData.jwt;
            console.log('✅ JWT received successfully, length:', jwt?.length);
            
          } catch (jwtError) {
            const error = jwtError as Error;
            console.warn('⚠️ JWT authentication failed, falling back to basic authentication:', error);
            console.warn('⚠️ JWT Error details:', {
              message: error.message,
              name: error.name,
              stack: error.stack
            });
            // Continue without JWT - Intercom will still work but without secure authentication
          }
          
          // Set JWT if available
          if (jwt) {
            console.log('🔐 Setting JWT for Intercom...');
            await Intercom.setUserJwt(jwt);
            console.log('✅ JWT set successfully');
          }
          
          // Login with user attributes (with or without JWT)
          console.log('👤 Logging in user with attributes...');
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
          console.log('✅ User logged in to Intercom');
        }
        
        isIntercomAuthenticated = true;
        console.log('✅ Intercom background authentication completed');
        
      } catch (error) {
        console.error('❌ Background Intercom authentication failed:', error);
        console.error('❌ Error details:', error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : error);
        // Reset authentication state on failure
        isIntercomAuthenticated = false;
        authenticationPromise = null;
        throw error;
      }
    })();

    return authenticationPromise;
  }, [session]);

  // Start background authentication when user session is available
  useEffect(() => {
    if (session?.user?.id && !isIntercomAuthenticated && !authenticationPromise) {
      console.log('🚀 Starting background Intercom authentication...');
      authenticateIntercom().catch(error => {
        console.warn('Background Intercom authentication failed:', error);
      });
    }
  }, [session, authenticateIntercom]);

  // Reset authentication state when user logs out
  useEffect(() => {
    if (!session?.user?.id) {
      console.log('🔄 User logged out, resetting Intercom authentication state');
      isIntercomAuthenticated = false;
      authenticationPromise = null;
    }
  }, [session?.user?.id]);

  const openIntercom = async () => {
    try {
      setIsLoading(true);
      console.log('🎯 Intercom: Opening support chat');
      console.log('📱 Platform:', Platform.OS);
      console.log('🔐 Is authenticated:', isIntercomAuthenticated);
      
      // Check if we're on a supported platform
      if (Platform.OS === 'web') {
        throw new Error('Intercom is not supported on web platform');
      }
      
      // Ensure authentication is complete before opening
      console.log('🔐 Ensuring authentication is complete...');
      await authenticateIntercom();
      console.log('✅ Authentication confirmed');
      
      const { default: Intercom } = await import('@intercom/intercom-react-native');
      console.log('📦 Intercom module loaded for presentation');
      
      // Present Intercom with timeout
      console.log('🎯 Presenting Intercom (already authenticated)...');
      await Promise.race([
        Intercom.present(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Intercom presentation timeout')), 15000)
        )
      ]);
      
      console.log('✅ Intercom presented successfully');
      logAnalyticsEvent('intercom_chat_opened');
      
    } catch (error) {
      console.error('❌ Failed to open Intercom:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Show user-friendly error with retry option
      Alert.alert(
        'Support Chat Unavailable',
        'Unable to open support chat at the moment. This might be due to network connectivity issues. Would you like to try again?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => {
              // Reset authentication state and try again
              console.log('🔄 Retrying Intercom authentication...');
              isIntercomAuthenticated = false;
              authenticationPromise = null;
              openIntercom();
            }
          }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Alias for compatibility with existing components
  const present = openIntercom;

  return {
    openIntercom,
    present, // Alias for compatibility
    isLoading,
    isAuthenticated: isIntercomAuthenticated,
    isSupported
  };
}