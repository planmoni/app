import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { inAppNotificationService } from '@/lib/in-app-notifications';
import { supabase } from '@/lib/supabase';

export function useTransactionNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Listen to wallet_transactions table
    const walletTransactionsChannel = supabase
      .channel(`wallet-transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const transaction = payload.new as any;

          if (transaction.type === 'credit' && transaction.status === 'completed') {
            await inAppNotificationService.createNotification(
              user.id,
              'Deposit Successful',
              `₦${Number(transaction.amount).toLocaleString()} has been added to your wallet.`,
              'transaction',
              {
                transactionId: transaction.id,
                amount: transaction.amount,
                route: '/(tabs)/',
              },
              true
            );
          }
        }
      )
      .subscribe();

    // Listen to transactions table for deposits
    // NOTE: Deposit notifications are now handled by database trigger (create_deposit_event_trigger)
    // This hook is disabled for deposits to prevent duplicates
    // The trigger automatically creates events and notifications when deposit transactions are inserted
    const transactionsChannel = supabase
      .channel(`transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const transaction = payload.new as any;

          // Skip deposit notifications - they are handled by database trigger
          // The trigger (create_deposit_event_trigger) automatically creates events and notifications
          if (transaction.type === 'deposit' && transaction.status === 'completed') {
            console.log('💰 Deposit transaction detected - notification handled by database trigger');
            return;
          }

          // Handle other transaction types here if needed (non-deposit transactions)
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletTransactionsChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [user?.id]);
}
