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

          // Only create notification for completed deposits
          if (transaction.type === 'deposit' && transaction.status === 'completed') {
            // Check if notification already exists to avoid duplicates
            const { data: existingNotification } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', user.id)
              .eq('type', 'transaction')
              .contains('data', { transactionId: transaction.reference || transaction.id })
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            // Only create notification if it doesn't already exist
            if (!existingNotification) {
              await inAppNotificationService.createNotification(
                user.id,
                'Funds Received',
                `₦${Number(transaction.amount).toLocaleString()} has been added to your wallet.`,
                'transaction',
                {
                  transactionId: transaction.reference || transaction.id,
                  amount: transaction.amount,
                  type: 'deposit_successful',
                  route: '/(tabs)/',
                },
                true
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletTransactionsChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [user?.id]);
}
