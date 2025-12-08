import { useState, useEffect } from 'react';
import { ExpensePlan, ExpenseBucket, ExpenseBucketLockedFunds, BudgetStructure } from '@/types/expense-planner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function useExpensePlans() {
  const { session } = useAuth();
  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Calculate funding status for a plan based on buckets and locked funds
   */
  const getPlanFundingStatus = (
    status: string,
    buckets: ExpenseBucket[],
    lockedFundsMap: Map<string, number>
  ): 'draft' | 'unfunded' | 'partially_funded' | 'funded' => {
    // Draft plans are always 'draft'
    if (status === 'draft') {
      return 'draft';
    }

    // If no buckets, consider unfunded
    if (!buckets || buckets.length === 0) {
      return 'unfunded';
    }

    let totalTarget = 0;
    let totalLocked = 0;
    let fullyFundedBuckets = 0;

    // Calculate funding for each bucket
    for (const bucket of buckets) {
      totalTarget += bucket.target_amount;
      const lockedAmount = lockedFundsMap.get(bucket.id) || 0;
      totalLocked += lockedAmount;

      // Check if bucket is fully funded (locked amount >= target amount)
      if (lockedAmount >= bucket.target_amount) {
        fullyFundedBuckets++;
      }
    }

    // If no locked funds at all, it's unfunded
    if (totalLocked === 0) {
      return 'unfunded';
    }

    // If all buckets are fully funded, it's funded
    if (fullyFundedBuckets === buckets.length) {
      return 'funded';
    }

    // Otherwise, it's partially funded
    return 'partially_funded';
  };

  const fetchExpensePlans = async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch all expense plans
      const { data: plans, error: fetchError } = await supabase
        .from('expense_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      if (!plans || plans.length === 0) {
        setExpensePlans([]);
        return;
      }

      // Fetch all buckets for all plans
      const planIds = plans.map(p => p.id);
      const { data: buckets, error: bucketsError } = await supabase
        .from('expense_buckets')
        .select('*')
        .in('expense_plan_id', planIds)
        .order('order_index', { ascending: true });

      if (bucketsError) throw bucketsError;

      // Fetch all locked funds for all buckets
      const bucketIds = buckets?.map(b => b.id) || [];
      let lockedFunds: ExpenseBucketLockedFunds[] = [];
      
      if (bucketIds.length > 0) {
        const { data: funds, error: fundsError } = await supabase
          .from('expense_bucket_locked_funds')
          .select('*')
          .in('expense_bucket_id', bucketIds)
          .eq('status', 'locked');

        if (fundsError) throw fundsError;
        lockedFunds = funds || [];
      }

      // Create a map of bucket_id -> total locked amount
      const lockedFundsMap = new Map<string, number>();
      for (const fund of lockedFunds) {
        const current = lockedFundsMap.get(fund.expense_bucket_id) || 0;
        lockedFundsMap.set(fund.expense_bucket_id, current + Number(fund.locked_amount));
      }

      // Group buckets by plan_id
      const bucketsByPlan = new Map<string, ExpenseBucket[]>();
      for (const bucket of buckets || []) {
        const planBuckets = bucketsByPlan.get(bucket.expense_plan_id) || [];
        planBuckets.push(bucket);
        bucketsByPlan.set(bucket.expense_plan_id, planBuckets);
      }

      // Enhance plans with buckets, locked funds, and funding status
      const enhancedPlans: ExpensePlan[] = plans.map(plan => {
        const planBuckets = bucketsByPlan.get(plan.id) || [];
        const fundingStatus = getPlanFundingStatus(plan.status, planBuckets, lockedFundsMap);
        
        // Calculate total locked for this plan
        let totalLocked = 0;
        for (const bucket of planBuckets) {
          totalLocked += lockedFundsMap.get(bucket.id) || 0;
        }

        return {
          ...plan,
          buckets: planBuckets,
          total_locked: totalLocked,
          funding_status: fundingStatus,
        };
      });

      // Auto-delete unfunded plans older than 24 hours
      const now = new Date();
      const plansToDelete: string[] = [];
      
      for (const plan of enhancedPlans) {
        // Check if plan is unfunded (not draft, and no locked funds)
        if (plan.funding_status === 'unfunded' && plan.status !== 'draft') {
          const createdAt = new Date(plan.created_at);
          const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          
          // If plan is older than 24 hours, mark for deletion
          if (hoursSinceCreation >= 24) {
            plansToDelete.push(plan.id);
          }
        }
      }

      // Delete expired unfunded plans
      if (plansToDelete.length > 0) {
        console.log(`Auto-deleting ${plansToDelete.length} expired unfunded plan(s)`);
        try {
          const { error: deleteError } = await supabase
            .from('expense_plans')
            .delete()
            .in('id', plansToDelete)
            .eq('user_id', session.user.id);

          if (deleteError) {
            console.error('Error auto-deleting expired plans:', deleteError);
          } else {
            console.log('Successfully auto-deleted expired unfunded plans');
          }
        } catch (err) {
          console.error('Error during auto-deletion of expired plans:', err);
        }

        // Filter out deleted plans from the list
        const filteredPlans = enhancedPlans.filter(plan => !plansToDelete.includes(plan.id));
        setExpensePlans(filteredPlans);
      } else {
        setExpensePlans(enhancedPlans);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch expense plans'));
      console.error('Error fetching expense plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if error is a retryable network/server error (502, 503, 504, etc.)
   */
  const isRetryableError = (error: any): boolean => {
    const errorMessage = error?.message || error?.toString() || '';
    const errorCode = error?.code || error?.status || '';
    
    return (
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('Bad Gateway') ||
      errorMessage.includes('Service Unavailable') ||
      errorMessage.includes('Gateway Timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorCode === '502' ||
      errorCode === '503' ||
      errorCode === '504'
    );
  };

  /**
   * Retry a function with exponential backoff
   */
  const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // If it's not a retryable error, throw immediately
        if (!isRetryableError(error)) {
          throw error;
        }
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };

  const saveDraftExpensePlan = async (planData: {
    name?: string;
    total_budget?: number;
    budget_structure?: BudgetStructure;
    start_date?: string;
    end_date?: string;
    planId?: string;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      return await retryWithBackoff(async () => {
      // If planId exists, update existing draft
      if (planData.planId) {
        const updates: any = {};
        if (planData.name !== undefined) updates.name = planData.name;
        if (planData.total_budget !== undefined) updates.total_budget = planData.total_budget;
        if (planData.budget_structure !== undefined) updates.budget_structure = planData.budget_structure;
        if (planData.start_date !== undefined) updates.start_date = planData.start_date;
        if (planData.end_date !== undefined) updates.end_date = planData.end_date;

        const { data, error: updateError } = await supabase
          .from('expense_plans')
          .update(updates)
          .eq('id', planData.planId)
          .eq('user_id', session.user.id)
          .select()
          .single();

          if (updateError) {
            // Enhance error message for 502 errors
            if (isRetryableError(updateError)) {
              const enhancedError = new Error('Server temporarily unavailable. Please try again.');
              (enhancedError as any).originalError = updateError;
              throw enhancedError;
            }
            throw updateError;
          }
        return data;
      }

      // Create new draft plan
      if (!planData.total_budget || !planData.budget_structure) {
        throw new Error('total_budget and budget_structure are required to create a draft plan');
      }

      const { data, error: insertError } = await supabase
        .from('expense_plans')
        .insert({
          user_id: session.user.id,
          name: planData.name || 'Untitled Plan',
          total_budget: planData.total_budget,
          budget_structure: planData.budget_structure,
          start_date: planData.start_date || null,
          end_date: planData.end_date || null,
          status: 'draft',
        })
        .select()
        .single();

        if (insertError) {
          // Enhance error message for 502 errors
          if (isRetryableError(insertError)) {
            const enhancedError = new Error('Server temporarily unavailable. Please try again.');
            (enhancedError as any).originalError = insertError;
            throw enhancedError;
          }
          throw insertError;
        }
      return data;
      });
    } catch (err) {
      console.error('Error saving draft expense plan:', err);
      
      // Provide user-friendly error message
      if (isRetryableError(err)) {
        const friendlyError = new Error('Unable to connect to server. Please check your internet connection and try again.');
        (friendlyError as any).originalError = err;
        throw friendlyError;
      }
      
      throw err;
    }
  };

  const saveExpenseBuckets = async (planId: string, buckets: Array<{
    category_id: string;
    subcategory_id: string;
    name: string;
    target_amount: number;
    order_index?: number;
  }>) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      // First, delete existing buckets for this plan
      const { error: deleteError } = await supabase
        .from('expense_buckets')
        .delete()
        .eq('expense_plan_id', planId);

      if (deleteError) throw deleteError;

      // Insert new buckets
      if (buckets.length > 0) {
        const bucketsToInsert = buckets.map((bucket, index) => ({
          expense_plan_id: planId,
          category_id: bucket.category_id,
          subcategory_id: bucket.subcategory_id,
          name: bucket.name,
          target_amount: bucket.target_amount,
          order_index: bucket.order_index ?? index,
        }));

        const { data, error: insertError } = await supabase
          .from('expense_buckets')
          .insert(bucketsToInsert)
          .select();

        if (insertError) throw insertError;
        return data;
      }

      return [];
    } catch (err) {
      console.error('Error saving expense buckets:', err);
      throw err;
    }
  };

  const lockExpenseFunds = async (bucketLocks: Array<{
    bucket_id: string;
    locked_amount: number;
    unlock_date: string;
  }>) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const locksJson = bucketLocks.map(lock => ({
        bucket_id: lock.bucket_id,
        locked_amount: lock.locked_amount,
        unlock_date: lock.unlock_date,
      }));

      const { data, error: lockError } = await supabase.rpc('lock_expense_funds', {
        p_user_id: session.user.id,
        p_bucket_locks: locksJson,
      });

      if (lockError) throw lockError;
      return data;
    } catch (err) {
      console.error('Error locking expense funds:', err);
      throw err;
    }
  };

  const finalizeExpensePlan = async (planId: string, name: string) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error: updateError } = await supabase
        .from('expense_plans')
        .update({
          name,
          status: 'active',
        })
        .eq('id', planId)
        .eq('user_id', session.user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    } catch (err) {
      console.error('Error finalizing expense plan:', err);
      throw err;
    }
  };

  const createExpensePlan = async (planData: {
    name: string;
    total_budget: number;
    budget_structure: BudgetStructure;
    buckets: Array<{
      category_id: string;
      subcategory_id: string;
      name: string;
      target_amount: number;
    }>;
    start_date?: string;
    end_date?: string;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const bucketsJson = planData.buckets.map((bucket, index) => ({
        category_id: bucket.category_id,
        subcategory_id: bucket.subcategory_id,
        name: bucket.name,
        target_amount: bucket.target_amount,
        order_index: index,
      }));

      const { data: planId, error: createError } = await supabase.rpc('create_expense_plan_with_buckets', {
        p_user_id: session.user.id,
        p_name: planData.name,
        p_total_budget: planData.total_budget,
        p_budget_structure: planData.budget_structure,
        p_start_date: planData.start_date || null,
        p_end_date: planData.end_date || null,
        p_buckets: bucketsJson,
      });

      if (createError) throw createError;

      // Fetch the created plan
      const { data: plan, error: fetchError } = await supabase
        .from('expense_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (fetchError) throw fetchError;

      // Update status to active
      const { data: finalizedPlan, error: finalizeError } = await supabase
        .from('expense_plans')
        .update({ status: 'active' })
        .eq('id', planId)
        .select()
        .single();

      if (finalizeError) throw finalizeError;

      return finalizedPlan;
    } catch (err) {
      console.error('Error creating expense plan:', err);
      throw err;
    }
  };

  const updateExpensePlan = async (id: string, updates: Partial<ExpensePlan>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('expense_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local state
      setExpensePlans(prev =>
        prev.map(plan => (plan.id === id ? { ...plan, ...updates } : plan))
      );

      return data;
    } catch (err) {
      console.error('Error updating expense plan:', err);
      throw err;
    }
  };

  const deleteExpensePlan = async (id: string) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      // First verify the plan exists and belongs to the user
      const { data: plan, error: fetchError } = await supabase
        .from('expense_plans')
        .select('id, user_id, status')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single();

      if (fetchError) throw fetchError;
      if (!plan) {
        throw new Error('Plan not found or you do not have permission to delete it');
      }

      // Delete the plan (CASCADE will handle related records)
      const { error: deleteError } = await supabase
        .from('expense_plans')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id); // Ensure user owns the plan

      if (deleteError) throw deleteError;

      // Update local state
      setExpensePlans(prev => prev.filter(plan => plan.id !== id));
      
      console.log('Plan deleted successfully:', id);
    } catch (err) {
      console.error('Error deleting expense plan:', err);
      throw err;
    }
  };

  const getExpenseBuckets = async (planId: string): Promise<ExpenseBucket[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('expense_buckets')
        .select('*')
        .eq('expense_plan_id', planId)
        .order('order_index', { ascending: true });

      if (fetchError) throw fetchError;
      return data || [];
    } catch (err) {
      console.error('Error fetching expense buckets:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchExpensePlans();
  }, [session?.user?.id]);

  return {
    expensePlans,
    isLoading,
    error,
    fetchExpensePlans,
    createExpensePlan,
    updateExpensePlan,
    deleteExpensePlan,
    saveDraftExpensePlan,
    saveExpenseBuckets,
    lockExpenseFunds,
    finalizeExpensePlan,
    getExpenseBuckets,
  };
}

