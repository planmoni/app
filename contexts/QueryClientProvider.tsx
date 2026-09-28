/**
 * React Query Provider
 *
 * Provides QueryClient for React Query hooks
 */

import React, { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
  focusManager,
} from '@tanstack/react-query';

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

// Create a client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Resume refetch is owned by useForegroundRefreshCoordinator, after one
      // session check. Window-focus refetch was stampeding the auth lock.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000,
      // Wallet overrides this with networkMode: 'online' + staleTime: 0
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
    },
  },
});

interface QueryClientProviderProps {
  children: React.ReactNode;
}

export function QueryClientProvider({ children }: QueryClientProviderProps) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
    </TanStackQueryClientProvider>
  );
}

export { queryClient };
