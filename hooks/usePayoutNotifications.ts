import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { inAppNotificationService } from '@/lib/in-app-notifications';
import { supabase } from '@/lib/supabase';

export function usePayoutNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`payout-plans:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payout_plans',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const oldPlan = payload.old as any;
          const newPlan = payload.new as any;

          if (oldPlan.status !== 'completed' && newPlan.status === 'completed') {
            await inAppNotificationService.createNotification(
              user.id,
              'Payout Completed',
              `Your payout of ₦${Number(newPlan.amount).toLocaleString()} has been successfully sent.`,
              'payout',
              {
                payoutId: newPlan.id,
                amount: newPlan.amount,
                route: '/all-payouts',
              },
              true
            );
          }

          if (oldPlan.status !== 'failed' && newPlan.status === 'failed') {
            await inAppNotificationService.createNotification(
              user.id,
              'Payout Failed',
              `Your payout of ₦${Number(newPlan.amount).toLocaleString()} could not be processed. Please try again.`,
              'security',
              {
                payoutId: newPlan.id,
                amount: newPlan.amount,
                route: '/all-payouts',
              },
              true
            );
          }

          if (oldPlan.is_paused === false && newPlan.is_paused === true) {
            await inAppNotificationService.createNotification(
              user.id,
              'Payout Paused',
              `Your payout plan has been paused. You can resume it anytime from your payout settings.`,
              'system',
              {
                payoutId: newPlan.id,
                route: '/all-payouts',
              },
              true
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
