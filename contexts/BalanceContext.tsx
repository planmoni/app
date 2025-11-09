import { createContext, useContext, useState, useEffect } from 'react';
import { useRealtimeWallet } from '@/hooks/useRealtimeWallet';
import { logAnalyticsEvent } from '@/lib/firebase';

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
  const [showBalances, setShowBalances] = useState(true);
  const wallet = useRealtimeWallet();
  
  // Log balance changes for analytics
  useEffect(() => {
    if (wallet.balance > 0 || wallet.lockedBalance > 0) {
      logAnalyticsEvent('wallet_balance_update', {
        balance: wallet.balance,
        locked_balance: wallet.lockedBalance,
      });
    }
  }, [wallet.balance, wallet.lockedBalance, wallet.availableBalance]);

  const toggleBalances = () => {
    const newState = !showBalances;
    setShowBalances(newState);
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
        balance: wallet.balance,
        lockedBalance: wallet.lockedBalance,
        availableBalance: wallet.availableBalance,
        isLoading: wallet.isLoading,
        error: wallet.error,
        refreshWallet: wallet.refreshWallet,
        // Lightweight stub used by some screens to trigger a wallet refresh after adding funds
        addFunds: async (amount: number) => {
          try {
            // The actual add-funds flow happens elsewhere (payment providers). We trigger a refresh here.
            await wallet.refreshWallet();
          } catch (err) {
            console.warn('addFunds stub failed to refresh wallet', err);
          }
        },
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