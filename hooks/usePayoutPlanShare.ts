import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const SHARE_BASE_URL = 'https://planmoni.com/plan';

export type PlanByShareCodeResult = {
  found: boolean;
  id?: string;
  name?: string;
  payout_amount?: number;
  frequency?: string;
  next_payout_date?: string | null;
  creator_first_name?: string;
  is_owner?: boolean;
  is_paired?: boolean;
  error?: string;
};

export function usePayoutPlanShare() {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ensure plan has a share code (owner only); returns the share code or null on failure. */
  const ensureShareCode = useCallback(async (planId: string): Promise<string | null> => {
    if (!session?.user?.id) return null;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('ensure_payout_plan_share_code', {
        p_plan_id: planId,
      });
      if (rpcError) {
        setError(rpcError.message);
        return null;
      }
      return data as string | null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  /** Get universal share URL for a plan (generates share code if needed). */
  const getShareUrl = useCallback(async (planId: string): Promise<string | null> => {
    const code = await ensureShareCode(planId);
    return code ? `${SHARE_BASE_URL}/${code}` : null;
  }, [ensureShareCode]);

  /** Add current user as paired to the plan (idempotent). */
  const pairToPlan = useCallback(async (planId: string): Promise<boolean> => {
    if (!session?.user?.id) return false;
    setIsLoading(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('payout_plan_pairings').insert({
        payout_plan_id: planId,
        paired_user_id: session.user.id,
      });
      if (insertError) {
        if (insertError.code === '23505') return true;
        setError(insertError.message);
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plan');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  /** Fetch minimal plan info by share code (for accept-share screen). */
  const getPlanByShareCode = useCallback(async (code: string): Promise<PlanByShareCodeResult> => {
    if (!code?.trim()) return { found: false, error: 'Invalid code' };
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_plan_by_share_code', {
        p_share_code: code.trim(),
      });
      if (rpcError) {
        return { found: false, error: rpcError.message };
      }
      const result = data as {
        found?: boolean;
        id?: string;
        name?: string;
        payout_amount?: number;
        frequency?: string;
        next_payout_date?: string | null;
        creator_first_name?: string;
        is_owner?: boolean;
        is_paired?: boolean;
        error?: string;
      };
      if (!result?.found) {
        return { found: false, error: result?.error || 'Plan not found' };
      }
      return {
        found: true,
        id: result.id,
        name: result.name,
        payout_amount: result.payout_amount,
        frequency: result.frequency,
        next_payout_date: result.next_payout_date ?? undefined,
        creator_first_name: result.creator_first_name,
        is_owner: result.is_owner,
        is_paired: result.is_paired,
      };
    } catch (err) {
      return { found: false, error: err instanceof Error ? err.message : 'Failed to load plan' };
    }
  }, []);

  return {
    ensureShareCode,
    getShareUrl,
    pairToPlan,
    getPlanByShareCode,
    isLoading,
    error,
    shareBaseUrl: SHARE_BASE_URL,
  };
}
