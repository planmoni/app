import { createContext, useContext, useState } from 'react';
import { useRealtimeWallet } from '@/hooks/useRealtimeWallet';

type BalanceContextType = {
  showBalances: boolean;
  toggleBalances: () => void;
  balance: number;
  lockedBalance: number;
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

  const toggleBalances = () => {
    setShowBalances(prev => !prev);
  };

  return (
    <BalanceContext.Provider 
      value={{ 
        showBalances, 
        toggleBalances,
        balance: wallet.balance,
        lockedBalance: wallet.lockedBalance,
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