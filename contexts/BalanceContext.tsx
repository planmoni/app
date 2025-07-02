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
  addFunds: (amount: number) => Promise<void>;
  lockFunds: (amount: number) => Promise<void>;
  refreshWallet: () => Promise<void>;
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
        addFunds: wallet.addFunds,
        lockFunds: wallet.lockFunds,
        refreshWallet: wallet.refreshWallet
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