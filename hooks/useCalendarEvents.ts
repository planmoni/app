import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type CalendarEvent = {
  id: string;
  title: string;
  amount: string;
  time: string;
  type: 'completed' | 'pending' | 'scheduled' | 'failed' | 'expiring';
  description: string;
  vault?: string;
  date: string;
  payout_plan_id?: string;
  transaction_id?: string;
};

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchCalendarEvents();
    }
  }, [session?.user?.id]);

  const fetchCalendarEvents = async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Fetch payout plans and their events
      const { data: payoutPlans, error: plansError } = await supabase
        .from('payout_plans')
        .select(`
          id,
          name,
          payout_amount,
          status,
          start_date,
          next_payout_date,
          created_at,
          completed_payouts,
          duration
        `)
        .eq('user_id', session?.user?.id);

      if (plansError) throw plansError;

      // Fetch transactions related to payouts
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          id,
          type,
          amount,
          status,
          created_at,
          payout_plan_id,
          payout_plans (
            name
          )
        `)
        .eq('user_id', session?.user?.id)
        .eq('type', 'payout')
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      const calendarEvents: CalendarEvent[] = [];

      // Process completed payouts from transactions
      transactions?.forEach(transaction => {
        const date = new Date(transaction.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

        calendarEvents.push({
          id: transaction.id,
          title: `₦${transaction.amount.toLocaleString()} disbursed`,
          amount: `₦${transaction.amount.toLocaleString()}`,
          time: date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          type: transaction.status === 'completed' ? 'completed' : 'failed',
          description: `From Vault "${transaction.payout_plans?.name || 'Unknown'}"`,
          vault: transaction.payout_plans?.name,
          date: formattedDate,
          payout_plan_id: transaction.payout_plan_id,
          transaction_id: transaction.id,
        });
      });

      // Process payout plan creation dates
      payoutPlans?.forEach(plan => {
        const createdDate = new Date(plan.created_at);
        const formattedCreatedDate = createdDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

        calendarEvents.push({
          id: `plan-created-${plan.id}`,
          title: 'Payout plan created',
          amount: `₦${plan.payout_amount.toLocaleString()}`,
          time: createdDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          type: 'pending',
          description: `Plan "${plan.name}" created`,
          vault: plan.name,
          date: formattedCreatedDate,
          payout_plan_id: plan.id,
        });

        // Process scheduled payouts
        if (plan.next_payout_date && plan.status === 'active') {
          const nextPayoutDate = new Date(plan.next_payout_date);
          const formattedNextDate = nextPayoutDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });

          // Check if payout is expiring (within 3 days)
          const daysUntilPayout = Math.ceil((nextPayoutDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const isExpiring = daysUntilPayout <= 3 && daysUntilPayout > 0;

          calendarEvents.push({
            id: `plan-scheduled-${plan.id}`,
            title: isExpiring ? 'Payout expiring soon' : 'Scheduled payout',
            amount: `₦${plan.payout_amount.toLocaleString()}`,
            time: '12:00 PM', // Default time for scheduled events
            type: isExpiring ? 'expiring' : 'scheduled',
            description: `Next payout from "${plan.name}"`,
            vault: plan.name,
            date: formattedNextDate,
            payout_plan_id: plan.id,
          });
        }

        // Check for plans that might have failed payouts
        if (plan.status === 'paused' && plan.next_payout_date) {
          const pausedDate = new Date(plan.next_payout_date);
          const formattedPausedDate = pausedDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });

          calendarEvents.push({
            id: `plan-failed-${plan.id}`,
            title: 'Payout paused',
            amount: `₦${plan.payout_amount.toLocaleString()}`,
            time: '12:00 PM',
            type: 'failed',
            description: `Payout from "${plan.name}" was paused`,
            vault: plan.name,
            date: formattedPausedDate,
            payout_plan_id: plan.id,
          });
        }
      });

      // Sort events by date
      calendarEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setEvents(calendarEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar events');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    events,
    isLoading,
    error,
    refreshEvents: fetchCalendarEvents,
  };
}