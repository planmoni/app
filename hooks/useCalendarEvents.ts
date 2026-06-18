import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { buildCalendarEvents, CalendarEvent } from '@/lib/calendar/buildCalendarEvents';
import {
  CACHE_KEYS,
  fetchWithRetry,
  readCache,
  writeCache,
  toUserFacingError,
  warmConnection,
} from '@/lib/supabase-fetch';

export type { CalendarEvent };

export function useCalendarEvents() {
  const { session } = useAuth();
  const { payoutPlans, isLoading: plansLoading, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { transactions, isLoading: transactionsLoading, fetchTransactions } = useRealtimeTransactions();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [customDatesByPlan, setCustomDatesByPlan] = useState<
    Record<string, { payout_date: string; payout_time?: string }[]>
  >({});
  const hasCachedDataRef = useRef(false);
  const customDatesFetchedRef = useRef<string>('');

  const isLoading =
    !hasCachedDataRef.current && (plansLoading || transactionsLoading) && events.length === 0;

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setEvents([]);
      setError(null);
      setIsStale(false);
      return;
    }

    let isMounted = true;

    const loadCache = async () => {
      const cached = await readCache<CalendarEvent[]>(CACHE_KEYS.calendarEvents(session.user.id));
      if (cached?.length && isMounted) {
        setEvents(cached);
        hasCachedDataRef.current = true;
      }
    };

    void loadCache();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const fetchCustomDates = useCallback(async () => {
    if (!session?.user?.id) return;

    const customPlanIds = payoutPlans
      .filter((p) => p.status === 'active' && p.start_date && p.frequency === 'custom')
      .map((p) => p.id);

    const idsKey = customPlanIds.sort().join(',');
    if (idsKey === customDatesFetchedRef.current) return;
    customDatesFetchedRef.current = idsKey;

    if (customPlanIds.length === 0) {
      setCustomDatesByPlan({});
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    try {
      const { data } = (await fetchWithRetry(
        () =>
          supabase
            .from('custom_payout_dates')
            .select('payout_plan_id, payout_date, payout_time')
            .in('payout_plan_id', customPlanIds)
            .gte('payout_date', todayStr)
            .order('payout_date', { ascending: true }),
        'Calendar custom dates'
      )) as { data: any[] | null; error: any };

      const byPlan: Record<string, { payout_date: string; payout_time?: string }[]> = {};
      data?.forEach((item) => {
        if (!byPlan[item.payout_plan_id]) byPlan[item.payout_plan_id] = [];
        byPlan[item.payout_plan_id].push(item);
      });
      setCustomDatesByPlan(byPlan);
      setIsStale(false);
    } catch (err) {
      console.warn('Calendar custom dates fetch failed:', err);
      if (hasCachedDataRef.current) {
        setIsStale(true);
      }
    }
  }, [session?.user?.id, payoutPlans]);

  useEffect(() => {
    void fetchCustomDates();
  }, [fetchCustomDates]);

  const builtEvents = useMemo(
    () => buildCalendarEvents(payoutPlans, transactions, customDatesByPlan),
    [payoutPlans, transactions, customDatesByPlan]
  );

  useEffect(() => {
    if (!session?.user?.id) return;

    if (builtEvents.length > 0 || (payoutPlans.length === 0 && transactions.length === 0 && !plansLoading && !transactionsLoading)) {
      setEvents(builtEvents);
      if (builtEvents.length > 0) {
        hasCachedDataRef.current = true;
        void writeCache(CACHE_KEYS.calendarEvents(session.user.id), builtEvents);
      }
      setError(null);
      setIsStale(false);
    } else if (!hasCachedDataRef.current && !plansLoading && !transactionsLoading) {
      setError("Couldn't load calendar events. Tap Retry.");
    }
  }, [builtEvents, session?.user?.id, payoutPlans.length, transactions.length, plansLoading, transactionsLoading]);

  const refreshEvents = useCallback(async () => {
    if (!session?.user?.id) return;
    setError(null);
    customDatesFetchedRef.current = '';
    await warmConnection();
    await Promise.allSettled([fetchPayoutPlans(), fetchTransactions()]);
    await fetchCustomDates();
  }, [session?.user?.id, fetchPayoutPlans, fetchTransactions, fetchCustomDates]);

  const displayError = error ? toUserFacingError(error, hasCachedDataRef.current) : null;

  return {
    events,
    isLoading,
    error: events.length > 0 ? (isStale ? displayError : null) : displayError,
    isStale,
    refreshEvents,
  };
}
