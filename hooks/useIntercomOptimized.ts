import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { logAnalyticsEvent } from '@/lib/firebase';
import { intercomInstant } from '@/lib/IntercomInstant';

export function useIntercomOptimized() {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  // Check if Intercom is supported on this platform
  const isSupported = Platform.OS !== 'web';

  // Initialize Intercom at app startup
  useEffect(() => {
    if (isSupported) {
      intercomInstant.initialize().catch(error => {
        console.warn('Failed to initialize IntercomInstant:', error);
      });
    }
  }, [isSupported]);

  // Authenticate user when session is available
  useEffect(() => {
    if (session?.user?.id && isSupported) {
      const firstName = session.user.user_metadata?.first_name || '';
      const lastName = session.user.user_metadata?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || session.user.email?.split('@')[0] || 'User';
      
      intercomInstant.authenticateUser(
        session.user.id,
        session.user.email || '',
        fullName,
        session.user.phone || undefined
      ).catch(error => {
        console.warn('Background Intercom authentication failed:', error);
      });
    }
  }, [session, isSupported]);

  // Reset authentication when user logs out
  useEffect(() => {
    if (!session?.user?.id && isSupported) {
      intercomInstant.logout().catch(error => {
        console.warn('Failed to logout from Intercom:', error);
      });
    }
  }, [session?.user?.id, isSupported]);

  // INSTANT Intercom opening - optimized for speed
  const openIntercom = useCallback(async () => {
    try {
      console.log('🎯 Opening Intercom (optimized mode)...');
      
      // Check platform support
      if (!isSupported) {
        throw new Error('Intercom is not supported on web platform');
      }

      // Open Intercom instantly
      await intercomInstant.open();
      
      // Log analytics
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
    isLoading: false, // Always false for instant mode
    isAuthenticated: intercomInstant.isAuthenticated(),
    isSupported,
    isReady: intercomInstant.isReady()
  };
}
