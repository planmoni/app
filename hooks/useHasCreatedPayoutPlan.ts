import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';

export function useHasCreatedPayoutPlan() {
  const [hasCreatedPayoutPlan, setHasCreatedPayoutPlan] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const { session, isAuthReady } = useAuth();
  const hasCachedDataRef = useRef(false);

  const checkIfUserHasCreatedPayoutPlan = useCallback(async () => {
    if (!session?.user?.id || !isAuthReady) {
      if (!session?.user?.id) {
        setHasCreatedPayoutPlan(false);
        setIsLoading(false);
      }
      return;
    }

    try {
      if (!hasCachedDataRef.current) {
        setIsLoading(true);
      }

      const { data, error } = await fetchWithRetry(
        () =>
          supabase
            .from('transactions')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('type', 'payout')
            .limit(1),
        'Payout plan check'
      ) as { data: { id: string }[] | null; error: unknown };

      if (error) {
        console.warn('Error checking payout transaction history:', error);
        // Keep cached value on failure — do not assume user has no history.
      } else {
        const hasPlan = (data?.length ?? 0) > 0;
        setHasCreatedPayoutPlan(hasPlan);
        void writeCache(CACHE_KEYS.hasPayoutPlan(session.user.id), hasPlan);
      }
    } catch (err) {
      console.warn('Error checking if user has created payout transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, isAuthReady]);

  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      setHasCreatedPayoutPlan(false);
      setIsLoading(false);
      return;
    }

    if (!isAuthReady) return;

    let isMounted = true;

    const init = async () => {
      const cached = await readCache<boolean>(CACHE_KEYS.hasPayoutPlan(session.user.id));
      if (cached !== null && isMounted) {
        setHasCreatedPayoutPlan(cached);
        setIsLoading(false);
        hasCachedDataRef.current = true;
      }

      if (!isMounted) return;
      await checkIfUserHasCreatedPayoutPlan();
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, isAuthReady, checkIfUserHasCreatedPayoutPlan]);

  return {
    hasCreatedPayoutPlan,
    isLoading,
    refetch: checkIfUserHasCreatedPayoutPlan,
  };
}
