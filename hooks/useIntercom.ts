import { useCallback, useEffect, useState } from 'react';
import { intercomService, Visibility, IntercomUserAttributes } from '@/lib/intercom';
import { Platform } from 'react-native';

export const useIntercom = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if Intercom is supported on current platform
    if (intercomService.isSupported()) {
      setIsInitialized(intercomService.getInitializationStatus());
    }
  }, []);

  const initialize = useCallback(async () => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.initialize();
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize Intercom:', error);
    }
  }, []);

  const loginUnidentifiedUser = useCallback(async () => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.loginUnidentifiedUser();
    } catch (error) {
      console.error('Failed to login unidentified user:', error);
    }
  }, []);

  const loginUser = useCallback(async (userId: string, email: string, name?: string, company?: string) => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.loginUser(userId, email, name, company);
    } catch (error) {
      console.error('Failed to login user:', error);
    }
  }, []);

  const updateUser = useCallback(async (attributes: Partial<IntercomUserAttributes>) => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.updateUser(attributes);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.logout();
      setIsInitialized(false);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  }, []);

  const present = useCallback(async () => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.present();
    } catch (error) {
      console.error('Failed to present Intercom:', error);
    }
  }, []);

  const setLauncherVisibility = useCallback(async (visibility: Visibility) => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.setLauncherVisibility(visibility);
    } catch (error) {
      console.error('Failed to set launcher visibility:', error);
    }
  }, []);

  const setInAppMessageVisibility = useCallback(async (visibility: Visibility) => {
    if (!intercomService.isSupported()) {
      console.warn('Intercom not supported on this platform');
      return;
    }

    try {
      await intercomService.setInAppMessageVisibility(visibility);
    } catch (error) {
      console.error('Failed to set in-app message visibility:', error);
    }
  }, []);

  return {
    // State
    isInitialized,
    isSupported: intercomService.isSupported(),
    
    // Methods
    initialize,
    loginUnidentifiedUser,
    loginUser,
    updateUser,
    logout,
    present,
    setLauncherVisibility,
    setInAppMessageVisibility,
    
    // Constants
    Visibility
  };
};