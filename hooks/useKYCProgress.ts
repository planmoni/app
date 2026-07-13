import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRegisterForegroundRefetch } from '@/hooks/useForegroundRefreshCoordinator';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';

export type KYCStep = 'liveness_verification' | 'personal' | 'bvn_verification' | 'id_face_match' | 'documents_verification' | 'address_details' | 'review';

export interface KYCProgress {
  id?: string;
  user_id?: string;
  current_step: KYCStep;
  personal_info_completed: boolean;
  bvn_verified: boolean;
  documents_verified: boolean;
  id_face_verified: boolean;
  address_completed: boolean;
  overall_completed: boolean;
  // Tier tracking
  tier_1_completed?: boolean;
  tier_2_completed?: boolean;
  tier_3_completed?: boolean;
  liveness_test_completed?: boolean;
  utility_bill_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface KYCTier {
  tier_number: number;
  tier_name: string;
  tier_description: string;
  max_daily_deposit: number;
  max_weekly_deposit: number;
  max_monthly_deposit: number;
  max_single_deposit: number;
  max_account_balance: number;
  requirements: Record<string, boolean>;
}

export interface KYCTierInfo {
  current_tier: number;
  can_upgrade: boolean;
  next_tier_requirements: Record<string, boolean>;
  tier_limits: KYCTier | null;
}

export const useKYCProgress = () => {
  const { session, isAuthReady } = useAuth();
  const hasCachedDataRef = useRef(false);
  const [progress, setProgress] = useState<KYCProgress>({
    current_step: 'liveness_verification',
    personal_info_completed: false,
    bvn_verified: false,
    documents_verified: false,
    id_face_verified: false,
    address_completed: false,
    overall_completed: false,
    tier_1_completed: false,
    tier_2_completed: false,
    tier_3_completed: false,
    liveness_test_completed: false,
    utility_bill_verified: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<number>(0);

  // Load KYC progress
  const loadProgress = useCallback(async () => {
    if (!session?.user?.id || !isAuthReady) return;

    try {
      if (!hasCachedDataRef.current) {
        setLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await fetchWithRetry(
        () =>
          supabase
            .from('kyc_progress')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle(),
        'KYC progress fetch'
      ) as { data: any; error: any };

      if (data) {
        setProgress(data);
        void writeCache(CACHE_KEYS.kycProgress(session.user.id), data);
      } else if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      } else {
        const defaultProgress: KYCProgress = {
          user_id: session.user.id,
          current_step: 'liveness_verification',
          personal_info_completed: false,
          bvn_verified: false,
          documents_verified: false,
          id_face_verified: false,
          address_completed: false,
          overall_completed: false,
          tier_1_completed: false,
          tier_2_completed: false,
          tier_3_completed: false,
          liveness_test_completed: false,
          utility_bill_verified: false
        };

        const { data: newData, error: createError } = await fetchWithRetry(
          () =>
            supabase
              .from('kyc_progress')
              .upsert(defaultProgress, {
                onConflict: 'user_id',
                ignoreDuplicates: false
              })
              .select()
              .single(),
          'KYC progress create'
        ) as { data: any; error: any };

        if (createError) {
          if (createError.code === '23505') {
            const { data: existingData, error: fetchExistingError } = await fetchWithRetry(
              () =>
                supabase
                  .from('kyc_progress')
                  .select('*')
                  .eq('user_id', session.user.id)
                  .single(),
              'KYC progress fetch (retry)'
            ) as { data: any; error: any };

            if (fetchExistingError) {
              throw fetchExistingError;
            }

            if (existingData) {
              setProgress(existingData);
              void writeCache(CACHE_KEYS.kycProgress(session.user.id), existingData);
              return;
            }
          }
          throw createError;
        }

        if (newData) {
          setProgress(newData);
          void writeCache(CACHE_KEYS.kycProgress(session.user.id), newData);
        }
      }
    } catch (err) {
      console.warn('Error loading KYC progress:', err);
      if (!hasCachedDataRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load progress');
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, isAuthReady]);

  // Update KYC progress
  const updateProgress = useCallback(async (updates: Partial<KYCProgress>): Promise<boolean> => {
    if (!session?.user?.id) return false;

    try {
      setLoading(true);
      setError(null);

      console.log('Updating KYC progress:', updates);

      const { data, error: updateError } = await supabase
        .from('kyc_progress')
        .update(updates)
        .eq('user_id', session.user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProgress(data);
      console.log('KYC progress updated successfully');
      return true;
    } catch (err) {
      console.error('Error updating KYC progress:', err);
      setError(err instanceof Error ? err.message : 'Failed to update progress');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Calculate progress percentage
  const getProgressPercentage = useCallback(() => {
    let completedSteps = 0;
    const totalSteps = 5;

    if (progress.personal_info_completed) completedSteps++;
    if (progress.bvn_verified) completedSteps++;
    if (progress.documents_verified) completedSteps++;
    if (progress.address_completed) completedSteps++;
    if (progress.overall_completed) completedSteps++;

    return Math.round((completedSteps / totalSteps) * 100);
  }, [progress]);

  // Get current step progress
  const getStepProgress = useCallback(() => {
    switch (progress.current_step) {
      case 'liveness_verification': return 5;
      case 'bvn_verification': return 20;
      case 'id_face_match': return 35;
      case 'personal': return 50;
      case 'documents_verification': return 65;
      case 'address_details': return 80;
      case 'review': return 100;
      default: return 0;
    }
  }, [progress.current_step]);

  // Update tier when progress changes
  const updateTier = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Call database function to calculate and update tier
      const { data: newTier, error: tierError } = await supabase.rpc('update_user_kyc_tier', {
        p_user_id: session.user.id
      });

      if (!tierError && newTier !== null) {
        setCurrentTier(newTier);
      }
    } catch (err) {
      console.error('Error updating tier:', err);
    }
  }, [session?.user?.id]);

  // Get tier info - optimized with parallel calls
  const getTierInfo = useCallback(async (): Promise<KYCTierInfo | null> => {
    if (!session?.user?.id) return null;

    try {
      // Get current tier first (required for other calls)
      const { data: tier, error: tierError } = await supabase.rpc('calculate_user_kyc_tier', {
        p_user_id: session.user.id
      });

      if (tierError) throw tierError;

      const currentTierValue = tier || 0;
      const tierToFetch = currentTierValue === 0 ? 1 : currentTierValue;
      const nextTier = currentTierValue + 1;

      // Parallelize independent calls: can_upgrade check and tier limits fetch
      const [canUpgradeResult, limitsResult] = await Promise.allSettled([
        // Check if can upgrade (only if next tier <= 3)
        nextTier <= 3 
          ? supabase.rpc('can_upgrade_tier', {
              p_user_id: session.user.id,
              p_target_tier: nextTier
            })
          : Promise.resolve({ data: false }),
        // Get tier limits
        supabase.rpc('get_tier_deposit_limits', {
          p_tier_number: tierToFetch
        })
      ]);

      // Extract can upgrade result
      let canUpgrade = false;
      if (canUpgradeResult.status === 'fulfilled' && canUpgradeResult.value.data !== undefined) {
        canUpgrade = canUpgradeResult.value.data || false;
      }

      // Extract tier limits
      let tierLimits = null;
      if (limitsResult.status === 'fulfilled') {
        const { data: limits, error: limitsError } = limitsResult.value;
        if (!limitsError && limits && limits[0]) {
          tierLimits = {
            tier_number: limits[0].tier_number,
            tier_name: limits[0].tier_name,
            tier_description: '',
            max_daily_deposit: limits[0].max_daily_deposit,
            max_weekly_deposit: limits[0].max_weekly_deposit,
            max_monthly_deposit: limits[0].max_monthly_deposit,
            max_single_deposit: limits[0].max_single_deposit,
            max_account_balance: limits[0].max_account_balance,
            requirements: {}
          };
        }
      }

      // Fallback to get_user_deposit_limits only if tier limits fetch failed
      if (!tierLimits) {
        const { data: userLimits } = await supabase.rpc('get_user_deposit_limits', {
          p_user_id: session.user.id
        });
        
        if (userLimits && userLimits[0]) {
          tierLimits = {
            tier_number: userLimits[0].tier_number,
            tier_name: userLimits[0].tier_name,
            tier_description: '',
            max_daily_deposit: userLimits[0].max_daily_deposit,
            max_weekly_deposit: userLimits[0].max_weekly_deposit,
            max_monthly_deposit: userLimits[0].max_monthly_deposit,
            max_single_deposit: userLimits[0].max_single_deposit,
            max_account_balance: userLimits[0].max_account_balance,
            requirements: {}
          };
        }
      }

      return {
        current_tier: currentTierValue,
        can_upgrade: canUpgrade,
        next_tier_requirements: {},
        tier_limits: tierLimits
      };
    } catch (err) {
      console.error('Error getting tier info:', err);
      return null;
    }
  }, [session?.user?.id]);

  // Override updateProgress to also update tier
  const updateProgressWithTier = useCallback(async (updates: Partial<KYCProgress>): Promise<boolean> => {
    const result = await updateProgress(updates);
    if (result) {
      await updateTier();
    }
    return result;
  }, [updateProgress, updateTier]);

  // Hydrate cached KYC only at startup — network fetch is lazy (loadProgress on demand).
  useEffect(() => {
    if (!session?.user?.id) {
      hasCachedDataRef.current = false;
      return;
    }

    let isMounted = true;

    const hydrate = async () => {
      try {
        const cached = await readCache<KYCProgress>(CACHE_KEYS.kycProgress(session.user.id));
        if (cached && isMounted) {
          setProgress(cached);
          hasCachedDataRef.current = true;
        }
      } catch (_) {}
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  useRegisterForegroundRefetch(
    'kyc-progress',
    3,
    () => {
      void loadProgress().then(() => updateTier());
    },
    !!session?.user?.id && isAuthReady
  );

  // Check tier completion based on progress
  const checkTierCompletion = useCallback(() => {
    // Helper function to check if a value is truthy (handles boolean, number, string)
    const isTruthy = (value: any): boolean => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
      return Boolean(value);
    };

    // Tier 1: Liveness + BVN + NIN (id_face_verified)
    const tier1Complete = 
      isTruthy(progress.liveness_test_completed) && 
      isTruthy(progress.bvn_verified) && 
      isTruthy(progress.id_face_verified);

    // Tier 2: Tier 1 + Personal Info + Documents
    const tier2Complete = 
      tier1Complete &&
      isTruthy(progress.personal_info_completed) &&
      isTruthy(progress.documents_verified);

    // Tier 3: Tier 2 + Address + Utility
    const tier3Complete = 
      tier2Complete &&
      isTruthy(progress.address_completed) &&
      isTruthy(progress.utility_bill_verified);

    return {
      tier1: tier1Complete,
      tier2: tier2Complete,
      tier3: tier3Complete
    };
  }, [progress]);

  return {
    progress,
    loading,
    error,
    currentTier,
    loadProgress,
    updateProgress: updateProgressWithTier,
    updateTier,
    getTierInfo,
    getProgressPercentage,
    getStepProgress,
    checkTierCompletion,
    setProgress
  };
}; 