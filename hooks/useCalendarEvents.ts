import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type CalendarEvent = {
  id: string;
  title: string;
  amount: string;
  time: string;
  type: 'completed' | 'pending' | 'scheduled' | 'failed';
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
    } else {
      setEvents([]);
      setIsLoading(false);
      setError(null);
    }
  }, [session?.user?.id]);

  const fetchCalendarEvents = async () => {
    if (!session?.user?.id) return;
    try {
      setError(null);
      setIsLoading(true);

      const selectPlan = `
        id,
        name,
        payout_amount,
        status,
        start_date,
        next_payout_date,
        created_at,
        completed_payouts,
        duration,
        frequency
      `;
      const { data: ownedPlans, error: ownedError } = await supabase
        .from('payout_plans')
        .select(selectPlan)
        .eq('user_id', session.user.id);

      if (ownedError) throw ownedError;

      const { data: pairingRows } = await supabase
        .from('payout_plan_pairings')
        .select('payout_plan_id')
        .eq('paired_user_id', session.user.id);

      const pairedIds = (pairingRows || []).map((r: { payout_plan_id: string }) => r.payout_plan_id).filter(Boolean);
      let pairedPlans: any[] = [];
      if (pairedIds.length > 0) {
        const { data: pairedData } = await supabase
          .from('payout_plans')
          .select(selectPlan)
          .in('id', pairedIds);
        pairedPlans = pairedData || [];
      }
      const payoutPlans = [...(ownedPlans || []), ...pairedPlans];

      // Fetch payout transactions (RLS returns own + paired plan payouts)
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
        .eq('type', 'payout')
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      const calendarEvents: CalendarEvent[] = [];

      // Process completed payouts from transactions
      transactions?.forEach((transaction: any) => {
        const date = new Date(transaction.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

        calendarEvents.push({
          id: transaction.id,
          title: `₦${Number(transaction.amount).toLocaleString()} disbursed`,
          amount: `₦${Number(transaction.amount).toLocaleString()}`,
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

      // Process payout plan creation dates and scheduled payouts
      if (payoutPlans) {
        for (const plan of payoutPlans) {
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

          // Process scheduled payouts - calculate all future scheduled payouts
          if (plan.status === 'active' && plan.start_date) {
            const startDate = new Date(plan.start_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Extract payout time from next_payout_date (if it exists and is a timestamptz)
            // Default to 9:00 AM if not available or if time is midnight (likely just a date)
            let payoutTime: { hours: number; minutes: number } = { hours: 9, minutes: 0 };
            if (plan.next_payout_date) {
              const nextPayoutDateTime = new Date(plan.next_payout_date);
              // Check if it's a valid date and has meaningful time information (not midnight)
              if (!isNaN(nextPayoutDateTime.getTime())) {
                const hours = nextPayoutDateTime.getHours();
                const minutes = nextPayoutDateTime.getMinutes();
                // Only use the time if it's not midnight (likely a real time, not just a date)
                if (hours !== 0 || minutes !== 0) {
                  payoutTime = { hours, minutes };
                }
              }
            }
            
            // Calculate all future scheduled payouts
            const scheduledDates: Date[] = [];
            
            if (plan.frequency === 'custom') {
              // For custom frequency, fetch custom payout dates
              const { data: customDates } = await supabase
                .from('custom_payout_dates')
                .select('payout_date')
                .eq('payout_plan_id', plan.id)
                .gte('payout_date', today.toISOString().split('T')[0])
                .order('payout_date', { ascending: true });
              
              if (customDates) {
                for (const customDate of customDates) {
                  const date = new Date(customDate.payout_date);
                  // Apply the payout time
                  date.setHours(payoutTime.hours, payoutTime.minutes, 0, 0);
                  scheduledDates.push(date);
                }
              }
            } else {
              // Calculate scheduled dates based on frequency
              const remainingPayouts = plan.duration - plan.completed_payouts;
              
              for (let i = 0; i < remainingPayouts; i++) {
                const payoutIndex = plan.completed_payouts + i;
                const scheduledDate = new Date(startDate);
                
                switch (plan.frequency) {
                  case 'daily':
                    scheduledDate.setDate(startDate.getDate() + payoutIndex);
                    break;
                  case 'weekly':
                    scheduledDate.setDate(startDate.getDate() + (payoutIndex * 7));
                    break;
                  case 'biweekly':
                    scheduledDate.setDate(startDate.getDate() + (payoutIndex * 14));
                    break;
                  case 'monthly':
                    scheduledDate.setMonth(startDate.getMonth() + payoutIndex);
                    break;
                }
                
                // Apply the payout time
                scheduledDate.setHours(payoutTime.hours, payoutTime.minutes, 0, 0);
                
                // Only include future dates (or today)
                const scheduledDateOnly = new Date(scheduledDate);
                scheduledDateOnly.setHours(0, 0, 0, 0);
                if (scheduledDateOnly >= today) {
                  scheduledDates.push(scheduledDate);
                }
              }
            }
            
            // Create calendar events for each scheduled payout
            for (let index = 0; index < scheduledDates.length; index++) {
              const scheduledDate = scheduledDates[index];
              const formattedDate = scheduledDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });

          // Calculate days until payout
              const daysUntilPayout = Math.ceil((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          // Determine event type and title based on timing
          let eventType: 'scheduled' | 'failed' = 'scheduled';
          let eventTitle = 'Scheduled payout';
              let eventDescription = `Payout from "${plan.name}"`;
          
          // If payout is overdue (more than 1 day past due), mark as failed
          if (daysUntilPayout < -1) {
            eventType = 'failed';
            eventTitle = 'Overdue payout';
            eventDescription = `Overdue payout from "${plan.name}" (${Math.abs(daysUntilPayout)} days late)`;
          }
          
              // Show all future scheduled payouts, or overdue payouts up to 7 days
              // This ensures all scheduled payouts in a plan are visible in the calendar
              if (daysUntilPayout >= 0 || (daysUntilPayout < 0 && daysUntilPayout >= -7)) {
            calendarEvents.push({
                  id: `plan-scheduled-${plan.id}-${index}`,
              title: eventTitle,
              amount: `₦${plan.payout_amount.toLocaleString()}`,
                  time: scheduledDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }),
              type: eventType,
              description: eventDescription,
              vault: plan.name,
                  date: formattedDate,
              payout_plan_id: plan.id,
            });
              }
          }
        }

        // Check for plans that are paused
        if (plan.status === 'paused' && plan.next_payout_date) {
          const pausedDate = new Date(plan.next_payout_date);
          const formattedPausedDate = pausedDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });

          calendarEvents.push({
            id: `plan-paused-${plan.id}`,
            title: 'Payout paused',
            amount: `₦${plan.payout_amount.toLocaleString()}`,
            time: pausedDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }),
            type: 'failed',
            description: `Payout from "${plan.name}" was paused`,
            vault: plan.name,
            date: formattedPausedDate,
            payout_plan_id: plan.id,
          });
        }
        }
      }

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