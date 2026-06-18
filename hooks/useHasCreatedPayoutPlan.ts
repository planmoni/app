import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/with-timeout';

const FETCH_TIMEOUT_MS = 20000;

export function useHasCreatedPayoutPlan() {
  const [hasCreatedPayoutPlan, setHasCreatedPayoutPlan] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      checkIfUserHasCreatedPayoutPlan();
    } else {
      setHasCreatedPayoutPlan(false);
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const checkIfUserHasCreatedPayoutPlan = async () => {
    try {
      setIsLoading(true);

      // Only consider users who have existing payout transactions.
      // This prevents showing the "first payout schedule" modal when the user already has payout history.
      const { data, error } = await withTimeout(
        supabase
          .from('transactions')
          .select('id')
          .eq('user_id', session?.user?.id)
          .eq('type', 'payout')
          .limit(1),
        FETCH_TIMEOUT_MS,
        'Payout plan check'
      );

      if (error) {
        console.error('Error checking payout transaction history:', error);
        // Default to false on error to be safe
        setHasCreatedPayoutPlan(false);
      } else {
        // If any event exists, user has created a payout plan before
        setHasCreatedPayoutPlan((data?.length ?? 0) > 0);
      }
    } catch (err) {
      console.error('Error checking if user has created payout transactions:', err);
      setHasCreatedPayoutPlan(false);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    hasCreatedPayoutPlan,
    isLoading,
    refetch: checkIfUserHasCreatedPayoutPlan,
  };
}

