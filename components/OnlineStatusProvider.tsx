import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

type OnlineStatusContextType = {
  isOnline: boolean;
  isInitialCheckDone: boolean;
};

const OnlineStatusContext = createContext<OnlineStatusContextType>({
  isOnline: true,
  isInitialCheckDone: false,
});

export const useOnlineStatus = () => useContext(OnlineStatusContext);

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    // Skip for web platform if needed
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }

    // Function to handle connection changes
    const handleConnectivityChange = (state: NetInfoState) => {
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

  return (
    <OnlineStatusContext.Provider value={{ isOnline, isInitialCheckDone }}>
      {children}
    </OnlineStatusContext.Provider>
  );
}