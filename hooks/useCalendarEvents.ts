import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface CalendarEvent {
  id: string;
  type: 'completed' | 'pending' | 'scheduled' | 'failed' | 'expiring';
  title: string;
  description: string;
  date: string;
  time: string;
  payout_plan_id?: string;
  transaction_id?: string;
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch events from the events table
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          type,
          title,
          description,
          created_at,
          payout_plan_id,
          transaction_id
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (eventsError) {
        throw eventsError;
      }

      // Fetch upcoming payout dates from payout plans
      const { data: payoutPlans, error: payoutError } = await supabase
        .from('payout_plans')
        .select(`
          id,
          name,
          next_payout_date,
          payout_amount,
          status
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('next_payout_date', 'is', null);

      if (payoutError) {
        throw payoutError;
      }

      // Transform events data
      const transformedEvents: CalendarEvent[] = [];

      // Add events from events table
      if (eventsData) {
        eventsData.forEach(event => {
          const eventDate = new Date(event.created_at);
          const eventType = mapEventTypeToCalendarType(event.type);
          
          transformedEvents.push({
            id: event.id,
            type: eventType,
            title: event.title,
            description: event.description,
            date: formatDate(eventDate),
            time: formatTime(eventDate),
            payout_plan_id: event.payout_plan_id,
            transaction_id: event.transaction_id,
          });
        });
      }

      // Add scheduled payouts from payout plans
      if (payoutPlans) {
        payoutPlans.forEach(plan => {
          if (plan.next_payout_date) {
            const payoutDate = new Date(plan.next_payout_date);
            const today = new Date();
            const daysDiff = Math.ceil((payoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            // Determine event type based on how close the payout is
            let eventType: CalendarEvent['type'] = 'scheduled';
            if (daysDiff <= 3 && daysDiff > 0) {
              eventType = 'expiring';
            } else if (daysDiff < 0) {
              eventType = 'failed';
            }

            transformedEvents.push({
              id: `payout-${plan.id}`,
              type: eventType,
              title: `${plan.name} Payout`,
              description: `Scheduled payout of ₦${Number(plan.payout_amount).toLocaleString()}`,
              date: formatDate(payoutDate),
              time: '09:00 AM',
              payout_plan_id: plan.id,
            });
          }
        });
      }

      setEvents(transformedEvents);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calendar events');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshEvents = () => {
    fetchEvents();
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    isLoading,
    error,
    refreshEvents,
  };
}

// Helper functions
function mapEventTypeToCalendarType(eventType: string): CalendarEvent['type'] {
  switch (eventType) {
    case 'payout_completed':
      return 'completed';
    case 'payout_scheduled':
      return 'scheduled';
    case 'disbursement_failed':
      return 'failed';
    case 'vault_created':
      return 'pending';
    case 'security_alert':
      return 'failed';
    default:
      return 'pending';
  }
}

function formatDate(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}