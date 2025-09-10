import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { logAnalyticsEvent } from '@/lib/firebase';

// Global state to track authentication status
let isIntercomAuthenticated = false;
let authenticationPromise: Promise<void> | null = null;

export function useIntercom() {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  // Background authentication function
  const authenticateIntercom = useCallback(async () => {
    // If already authenticated, return immediately
    if (isIntercomAuthenticated) {
      return;
    }

    // If authentication is in progress, wait for it
    if (authenticationPromise) {
      return authenticationPromise;
    }

    // Start new authentication
    authenticationPromise = (async () => {
      try {
        console.log('🔐 Background Intercom authentication starting...');
        
        const { default: Intercom } = await import('@intercom/intercom-react-native');
        
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
          
          // Get JWT from Supabase Edge Function for secure authentication
          console.log('🔐 Getting JWT from server...');
          const jwtResponse = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/intercom-jwt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
            }
          });
          
          if (!jwtResponse.ok) {
            throw new Error('Failed to get JWT from server');
          }
          
          const { jwt } = await jwtResponse.json();
          
          // Set the JWT before making any user registration calls
          console.log('🔐 Setting JWT for Intercom...');
          await Intercom.setUserJwt(jwt);
          console.log('✅ JWT set successfully');
          
          // Now login with user attributes
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
          console.log('✅ User logged in to Intercom with JWT');
        }
        
        isIntercomAuthenticated = true;
        console.log('✅ Intercom background authentication completed');
        
      } catch (error) {
        console.error('❌ Background Intercom authentication failed:', error);
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
      
      // Ensure authentication is complete before opening
      await authenticateIntercom();
      
      const { default: Intercom } = await import('@intercom/intercom-react-native');
      
      // Present Intercom instantly since authentication is already complete
      console.log('🎯 Presenting Intercom (already authenticated)...');
      await Intercom.present();
      
      logAnalyticsEvent('intercom_chat_opened');
      
    } catch (error) {
      console.error('❌ Failed to open Intercom:', error);
      
      // Show user-friendly error
      Alert.alert(
        'Intercom Error',
        'Unable to open support chat. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    openIntercom,
    isLoading,
    isAuthenticated: isIntercomAuthenticated
  };
}