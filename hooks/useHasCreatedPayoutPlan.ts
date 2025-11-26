import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
      
      // Check if user has any "payout_scheduled" events (created when a payout plan is created)
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', session?.user?.id)
        .eq('type', 'payout_scheduled')
        .limit(1);

      if (error) {
        console.error('Error checking payout plan creation:', error);
        // Default to false on error to be safe
        setHasCreatedPayoutPlan(false);
      } else {
        // If any event exists, user has created a payout plan before
        setHasCreatedPayoutPlan((data?.length ?? 0) > 0);
      }
    } catch (err) {
      console.error('Error checking if user has created payout plan:', err);
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

