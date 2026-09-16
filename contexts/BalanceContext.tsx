import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalletQuery } from '@/hooks/queries/useWalletQuery';
import { useAuth } from '@/contexts/AuthContext';
import { logAnalyticsEvent } from '@/lib/firebase';

const BALANCE_VISIBILITY_KEY = 'show_balances_preference';

export type WalletStatus = 'loading' | 'ready' | 'error';

type BalanceContextType = {
  showBalances: boolean;
  toggleBalances: () => void;
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  /** True only when React Query has real wallet data (not a silent zero fallback). */
  hasWalletData: boolean;
  /** True when we have cached/memory data but the last network refresh failed. */
  isWalletStale: boolean;
  walletStatus: WalletStatus;
  isLoading: boolean;
  isTimedOut: boolean;
  error: string | null;
  refreshWallet: () => Promise<{ balance: number; lockedBalance: number; availableBalance: number } | null>;
  addFunds?: (amount: number) => Promise<void>;
};

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const wallet = useWalletQuery();
  
  // Return mock data when unauthenticated
  const isAuthenticated = !!session?.user?.id;
  
  // Balance should be off by default for unauthenticated users, on by default for authenticated
  const [showBalances, setShowBalances] = useState(isAuthenticated);
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);

  // Load balance visibility preference from storage
  useEffect(() => {
    const loadPreference = async () => {
      try {
        if (isAuthenticated) {
          // For authenticated users, load saved preference or default to true
          const saved = await AsyncStorage.getItem(BALANCE_VISIBILITY_KEY);
          if (saved !== null) {
            setShowBalances(saved === 'true');
          } else {
            // No saved preference, default to showing balances for authenticated users
            setShowBalances(true);
          }
        } else {
          // For unauthenticated users, always hide balances
          setShowBalances(false);
        }
      } catch (error) {
        console.error('Error loading balance visibility preference:', error);
        // On error, use default based on authentication state
        setShowBalances(isAuthenticated);
      } finally {
        setIsLoadingPreference(false);
      }
    };

    loadPreference();
  }, [isAuthenticated]);

  // Sync showBalances with authentication state changes
  useEffect(() => {
    if (!isAuthenticated) {
      // When user logs out, hide balances (but keep preference saved)
      setShowBalances(false);
    }
  }, [isAuthenticated]);

  // Log balance changes for analytics
  useEffect(() => {
    if (wallet.balance > 0 || wallet.lockedBalance > 0) {
      logAnalyticsEvent('wallet_balance_update', {
        balance: wallet.balance,
        locked_balance: wallet.lockedBalance,
      });
    }
  }, [wallet.balance, wallet.lockedBalance, wallet.availableBalance]);

  const toggleBalances = useCallback(async () => {
    const newState = !showBalances;
    setShowBalances(newState);
    
    // Only save preference if user is authenticated
    if (isAuthenticated) {
      try {
        await AsyncStorage.setItem(BALANCE_VISIBILITY_KEY, newState.toString());
      } catch (error) {
        console.error('Error saving balance visibility preference:', error);
      }
    }
    
    logAnalyticsEvent('toggle_balance_visibility', { show_balances: newState });
  }, [showBalances, isAuthenticated]);

  const refreshWalletStub = useCallback(async () => {
    return { balance: 0, lockedBalance: 0, availableBalance: 0 };
  }, []);

  const addFundsStub = useCallback(async (amount: number) => {
    try {
      await wallet.refreshWallet();
    } catch (err) {
      console.warn('addFunds stub failed to refresh wallet', err);
    }
  }, [wallet]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    showBalances, 
    toggleBalances,
    balance: isAuthenticated ? wallet.balance : 0,
    lockedBalance: isAuthenticated ? wallet.lockedBalance : 0,
    availableBalance: isAuthenticated ? wallet.availableBalance : 0,
    hasWalletData: isAuthenticated ? wallet.hasWalletData : false,
    isWalletStale: isAuthenticated ? !!wallet.isStale : false,
    walletStatus: (isAuthenticated ? wallet.walletStatus : 'ready') as WalletStatus,
    isLoading: isAuthenticated ? wallet.isLoading : false,
    isTimedOut: isAuthenticated ? wallet.isTimedOut : false,
    error: isAuthenticated ? wallet.error : null,
    refreshWallet: isAuthenticated ? wallet.refreshWallet : refreshWalletStub,
    addFunds: isAuthenticated ? addFundsStub : undefined,
  }), [
    showBalances,
    toggleBalances,
    isAuthenticated,
    wallet.balance,
    wallet.lockedBalance,
    wallet.availableBalance,
    wallet.hasWalletData,
    wallet.isStale,
    wallet.walletStatus,
    wallet.isLoading,
    wallet.isTimedOut,
    wallet.error,
    wallet.refreshWallet,
    refreshWalletStub,
    addFundsStub,
  ]);

  return (
    <BalanceContext.Provider value={contextValue}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}