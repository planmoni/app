import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRealtimeWallet } from '@/hooks/useRealtimeWallet';
import { useAuth } from '@/contexts/AuthContext';
import { logAnalyticsEvent } from '@/lib/firebase';

const BALANCE_VISIBILITY_KEY = 'show_balances_preference';

type BalanceContextType = {
  showBalances: boolean;
  toggleBalances: () => void;
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  isLoading: boolean;
  error: string | null;
  refreshWallet: () => Promise<{ balance: number; lockedBalance: number; availableBalance: number } | null>;
  addFunds?: (amount: number) => Promise<void>;
};

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const wallet = useRealtimeWallet();
  
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

  const toggleBalances = async () => {
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
  };

  // Log balance changes for debugging
  console.log('BalanceContext - Current wallet state:');
  console.log('- Balance:', wallet.balance);
  console.log('- Locked Balance:', wallet.lockedBalance);
  console.log('- Available Balance:', wallet.availableBalance);

  return (
    <BalanceContext.Provider 
      value={{ 
        showBalances, 
        toggleBalances,
        balance: isAuthenticated ? wallet.balance : 0,
        lockedBalance: isAuthenticated ? wallet.lockedBalance : 0,
        availableBalance: isAuthenticated ? wallet.availableBalance : 0,
        isLoading: isAuthenticated ? wallet.isLoading : false,
        error: isAuthenticated ? wallet.error : null,
        refreshWallet: isAuthenticated ? wallet.refreshWallet : async () => ({ balance: 0, lockedBalance: 0, availableBalance: 0 }),
        // Lightweight stub used by some screens to trigger a wallet refresh after adding funds
        addFunds: isAuthenticated ? async (amount: number) => {
          try {
            // The actual add-funds flow happens elsewhere (payment providers). We trigger a refresh here.
            await wallet.refreshWallet();
          } catch (err) {
            console.warn('addFunds stub failed to refresh wallet', err);
          }
        } : undefined,
      }}
    >
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