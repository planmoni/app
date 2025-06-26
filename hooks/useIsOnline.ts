import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    // Skip for web platform if needed
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }

    // Function to handle connection changes
    const handleConnectivityChange = (state: any) => {
      setIsOnline(!!state.isConnected);
    };

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    // Initial check
    NetInfo.fetch().then(state => {
      setIsOnline(!!state.isConnected);
      setIsInitialCheckDone(true);
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline, isInitialCheckDone };
}