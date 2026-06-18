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
  const { payoutPlans, isLoading: plansLoading, error: plansError, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { transactions, isLoading: transactionsLoading, error: transactionsError, fetchTransactions } =
    useRealtimeTransactions();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [customDatesByPlan, setCustomDatesByPlan] = useState<
    Record<string, { payout_date: string; payout_time?: string }[]>
  >({});
  const hasCachedDataRef = useRef(false);
  const customDatesFetchedRef = useRef<string>('');

  const isLoading =
    !cacheReady ||
    (!hasCachedDataRef.current && (plansLoading || transactionsLoading) && events.length === 0);

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setEvents([]);
      setError(null);
      setIsStale(false);
      setCacheReady(true);
      return;
    }

    let isMounted = true;
    setCacheReady(false);

    const loadCache = async () => {
      const cached = await readCache<CalendarEvent[]>(CACHE_KEYS.calendarEvents(session.user.id));
      if (!isMounted) return;

      if (Array.isArray(cached) && cached.length > 0) {
        setEvents(cached);
        hasCachedDataRef.current = true;
        setError(null);
      }
      setCacheReady(true);
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
    if (!session?.user?.id || !cacheReady) return;

    if (builtEvents.length > 0) {
      setEvents(builtEvents);
      hasCachedDataRef.current = true;
      void writeCache(CACHE_KEYS.calendarEvents(session.user.id), builtEvents);
      setError(null);
      setIsStale(false);
      return;
    }

    if (hasCachedDataRef.current) {
      // Keep showing cached events while plans/transactions refresh.
      if (!plansLoading && !transactionsLoading) {
        setIsStale(true);
      }
      return;
    }

    if (!plansLoading && !transactionsLoading) {
      const sourceError = plansError || transactionsError;
      if (sourceError) {
        setError("Couldn't load calendar events. Tap Retry.");
      }
    }
  }, [
    builtEvents,
    session?.user?.id,
    plansError,
    transactionsError,
    plansLoading,
    transactionsLoading,
    cacheReady,
  ]);

  const refreshEvents = useCallback(async () => {
    if (!session?.user?.id) return;
    setError(null);
    setIsStale(false);
    customDatesFetchedRef.current = '';
    await warmConnection();
    await Promise.allSettled([fetchPayoutPlans(), fetchTransactions()]);
    await fetchCustomDates();
  }, [session?.user?.id, fetchPayoutPlans, fetchTransactions, fetchCustomDates]);

  const displayError = error ? toUserFacingError(error, hasCachedDataRef.current) : null;

  return {
    events,
    isLoading,
    error: events.length > 0 ? (isStale ? displayError ?? "Couldn't refresh. Showing saved data." : null) : displayError,
    isStale,
    refreshEvents,
  };
}
