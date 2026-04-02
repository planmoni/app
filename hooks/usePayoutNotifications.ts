import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
            await supabase.from('events').insert({
              user_id: user.id,
              type: 'payout_completed',
              title: 'Payout Completed',
              description: `Your payout of ₦${Number(newPlan.amount).toLocaleString()} has been successfully sent.`,
              status: 'unread',
              payout_plan_id: newPlan.id,
            } as any);
          }

          if (oldPlan.status !== 'failed' && newPlan.status === 'failed') {
            await supabase.from('events').insert({
              user_id: user.id,
              type: 'disbursement_failed',
              title: 'Payout Failed',
              description: `Your payout of ₦${Number(newPlan.amount).toLocaleString()} could not be processed. Please try again.`,
              status: 'unread',
              payout_plan_id: newPlan.id,
            } as any);
          }

          if (oldPlan.is_paused === false && newPlan.is_paused === true) {
            await supabase.from('events').insert({
              user_id: user.id,
              type: 'payout_paused',
              title: 'Payout Paused',
              description: 'Your payout plan has been paused. You can resume it anytime from your payout settings.',
              status: 'unread',
              payout_plan_id: newPlan.id,
            } as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
