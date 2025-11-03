import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import Intercom from '@intercom/intercom-react-native';

// Global state to track authentication across app
let globalAuthState = {
  isAuthenticated: false,
  currentUserId: null as string | null,
  isAuthenticating: false,
  authPromise: null as Promise<void> | null
};

export function useIntercom() {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();
  const isAuthenticatedRef = useRef(false);

  // Check if Intercom is supported on this platform
  const isSupported = Platform.OS !== 'web';

  // Authenticate user with Intercom
  const authenticateUser = useCallback(async () => {
    if (!session?.user?.id) {
      return;
    }

    // If already authenticated for this user, return immediately
    if (globalAuthState.isAuthenticated && globalAuthState.currentUserId === session.user.id) {
      console.log('✅ Intercom already authenticated for this user');
      isAuthenticatedRef.current = true;
      return;
    }

    // If authentication is in progress, wait for it
    if (globalAuthState.isAuthenticating && globalAuthState.authPromise) {
      console.log('⏳ Intercom authentication in progress, waiting...');
      await globalAuthState.authPromise;
      return;
    }

    // Start new authentication
    globalAuthState.isAuthenticating = true;
    globalAuthState.authPromise = (async () => {
      try {
        console.log('🔐 Authenticating user with Intercom...');
        
        // Logout any existing user first (in case AppDelegate logged in as unidentified)
        try {
          await Intercom.logout();
          console.log('✅ Logged out from Intercom before authenticating');
          // Small delay after logout to ensure it's processed
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (logoutError) {
          // Ignore logout errors - user might not be logged in
          console.log('ℹ️ No existing Intercom session to logout');
        }
        
        // Try to get JWT from your backend, but don't fail if it's not available
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/intercom-jwt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
            }
          });

          if (response.ok) {
            const { jwt } = await response.json();
            if (jwt) {
              console.log('🔐 JWT received, setting for Intercom...');
              await Intercom.setUserJwt(jwt);
              console.log('✅ JWT set successfully');
            } else {
              console.warn('⚠️ JWT response empty');
            }
          } else {
            const errorText = await response.text();
            console.warn('⚠️ JWT request failed:', response.status, errorText);
          }
        } catch (jwtError) {
          console.warn('⚠️ Failed to get JWT, continuing without JWT:', jwtError);
        }

        // Get user data
        const firstName = session.user.user_metadata?.first_name || '';
        const lastName = session.user.user_metadata?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const userEmail = session.user.email;

        // Validate required fields
        if (!userEmail) {
          throw new Error('User email is required for Intercom authentication');
        }

        if (!session.user.id) {
          throw new Error('User ID is required for Intercom authentication');
        }

        // Login user with the same user_id used in the JWT
        await Intercom.loginUserWithUserAttributes({
          userId: session.user.id,
          email: userEmail,
          name: fullName || userEmail.split('@')[0] || 'User',
          phone: session.user.phone || undefined,
          customAttributes: {
            first_name: firstName,
            last_name: lastName,
            user_type: 'customer',
            app_version: '1.0.0'
          }
        });

        // Update global state
        globalAuthState.isAuthenticated = true;
        globalAuthState.currentUserId = session.user.id;
        isAuthenticatedRef.current = true;
        
        console.log('✅ User authenticated with Intercom successfully');

      } catch (error) {
        console.error('❌ Failed to authenticate with Intercom:', error);
        
        // Fallback to unidentified user
        try {
          console.log('🔄 Falling back to unidentified user...');
          
          // Logout first before trying to login as unidentified
          try {
            await Intercom.logout();
            console.log('✅ Logged out before unidentified login');
          } catch (logoutError) {
            // Ignore logout errors
            console.log('ℹ️ No existing session to logout');
          }
          
          await Intercom.loginUnidentifiedUser();
          
          // Update global state for fallback
          globalAuthState.isAuthenticated = true;
          globalAuthState.currentUserId = 'unidentified';
          isAuthenticatedRef.current = true;
          
          console.log('✅ Fallback to unidentified user successful');
        } catch (fallbackError) {
          console.error('❌ Fallback failed:', fallbackError);
          globalAuthState.isAuthenticated = false;
          globalAuthState.currentUserId = null;
          isAuthenticatedRef.current = false;
          // Don't throw - allow the app to continue without Intercom
        }
      } finally {
        globalAuthState.isAuthenticating = false;
        globalAuthState.authPromise = null;
      }
    })();

    return globalAuthState.authPromise;
  }, [session]);

  // Authenticate when user session is available
  useEffect(() => {
    if (session?.user?.id) {
      // Add a small delay to ensure Intercom is ready
      const timer = setTimeout(() => {
        authenticateUser().catch(error => {
          console.warn('Background Intercom authentication failed:', error);
        });
      }, 500); // 500ms delay to ensure native module is ready
      
      return () => clearTimeout(timer);
    } else if (!session?.user?.id && globalAuthState.isAuthenticated) {
      // Logout when user session is lost
      console.log('🔄 User logged out, clearing Intercom authentication');
      try {
        Intercom.logout();
      } catch (error) {
        console.warn('Failed to logout from Intercom:', error);
      }
      globalAuthState.isAuthenticated = false;
      globalAuthState.currentUserId = null;
      isAuthenticatedRef.current = false;
    }
  }, [session, authenticateUser]);

  // Open Intercom chat
  const openChat = useCallback(async () => {
    if (!isSupported) {
      Alert.alert('Not Supported', 'Intercom is not supported on web platform');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🎯 Opening Intercom chat...');

      // Ensure user is authenticated (this will be instant if already authenticated)
      await authenticateUser();

      // Add a small delay to ensure Intercom is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Present the Intercom messenger
      await Intercom.present();
      
      console.log('✅ Intercom chat opened successfully');

    } catch (error) {
      console.error('❌ Failed to open Intercom chat:', error);
      Alert.alert(
        'Support Chat Unavailable',
        'Unable to open support chat at the moment. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, authenticateUser]);

  return {
    openChat,
    isLoading,
    isAuthenticated: globalAuthState.isAuthenticated,
    isSupported
  };
}
