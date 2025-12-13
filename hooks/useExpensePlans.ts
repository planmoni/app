import { useState, useEffect, useRef } from 'react';
import { ExpensePlan, ExpenseBucket, ExpenseBucketLockedFunds, BudgetStructure } from '@/types/expense-planner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useExpensePlans() {
  const { session } = useAuth();
  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Calculate funding status for a plan based on current_balance and total_budget
   */
  const getPlanFundingStatus = (
    status: string,
    currentBalance: number,
    totalBudget: number
  ): 'draft' | 'unfunded' | 'partially_funded' | 'funded' => {
    // Draft plans are always 'draft'
    if (status === 'draft') {
      return 'draft';
    }

    // If no budget set, consider unfunded
    if (!totalBudget || totalBudget <= 0) {
      return 'unfunded';
    }

    // If no current balance, it's unfunded
    if (!currentBalance || currentBalance <= 0) {
      return 'unfunded';
    }

    // If current balance >= total budget, it's fully funded
    if (currentBalance >= totalBudget) {
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
        
        // Get current_balance from plan (from plan_wallets via trigger)
        const currentBalance = (plan as any).current_balance || 0;
        const totalBudget = plan.total_budget || 0;
        
        // Calculate funding status based on current_balance and total_budget
        const fundingStatus = getPlanFundingStatus(plan.status, currentBalance, totalBudget);
        
        // Calculate total locked for this plan (for backward compatibility)
        let totalLocked = 0;
        for (const bucket of planBuckets) {
          totalLocked += lockedFundsMap.get(bucket.id) || 0;
        }

        // Extract metadata fields
        const metadata = plan.metadata || {};
        
        return {
          ...plan,
          buckets: planBuckets,
          total_locked: totalLocked,
          funding_status: fundingStatus,
          // Extract metadata fields to top level for easier access
          start_action: metadata.start_action || plan.start_action,
          payout_account_id: metadata.payout_account_id || plan.payout_account_id,
          payout_account_label: metadata.payout_account_label || plan.payout_account_label,
          payout_account_bank_name: metadata.payout_account_bank_name || plan.payout_account_bank_name,
          // Keep metadata for backward compatibility
          metadata,
        };
      });

      // Set expense plans (all plans stay, no expiry)
      setExpensePlans(enhancedPlans);
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
    plan_name?: string;
    total_budget?: number;
    budget_structure?: BudgetStructure;
    start_date?: string;
    end_date?: string;
    plan_type?: 'recurring' | 'one_time' | 'long_term';
    priority?: 'high' | 'medium' | 'low';
    funding_method?: 'auto' | 'manual' | 'hybrid';
    payout_schedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
    required_per_cycle?: number;
    required_per_day?: number;
    planId?: string;
    last_step?: string; // Track the last step/page user was on
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
        if (planData.plan_name !== undefined) updates.plan_name = planData.plan_name;
        if (planData.total_budget !== undefined) updates.total_budget = planData.total_budget;
        if (planData.budget_structure !== undefined) updates.budget_structure = planData.budget_structure;
        if (planData.start_date !== undefined) updates.start_date = planData.start_date;
        if (planData.end_date !== undefined) updates.end_date = planData.end_date;
        if (planData.plan_type !== undefined) updates.plan_type = planData.plan_type;
        if (planData.priority !== undefined) updates.priority = planData.priority;
        if (planData.funding_method !== undefined) updates.funding_method = planData.funding_method;
        if (planData.payout_schedule !== undefined) updates.payout_schedule = planData.payout_schedule;
        if (planData.required_per_cycle !== undefined) updates.required_per_cycle = planData.required_per_cycle;
        if (planData.required_per_day !== undefined) updates.required_per_day = planData.required_per_day;
        
        // Update last_step in metadata if provided
        if (planData.last_step !== undefined) {
          // Get current metadata and update last_step
          const { data: currentPlan } = await supabase
            .from('expense_plans')
            .select('metadata')
            .eq('id', planData.planId)
            .single();
          
          const currentMetadata = currentPlan?.metadata || {};
          updates.metadata = {
            ...currentMetadata,
            last_step: planData.last_step,
          };
        }

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
          name: planData.name || planData.plan_name || 'Untitled Plan',
          plan_name: planData.plan_name || planData.name || 'Untitled Plan',
          total_budget: planData.total_budget,
          budget_structure: planData.budget_structure,
          start_date: planData.start_date || null,
          end_date: planData.end_date || null,
          plan_type: planData.plan_type || 'one_time',
          priority: planData.priority || 'medium',
          funding_method: planData.funding_method || 'manual',
          payout_schedule: planData.payout_schedule || 'weekly',
          required_per_cycle: planData.required_per_cycle || 0,
          required_per_day: planData.required_per_day || 0,
          status: 'draft',
          metadata: planData.last_step ? { last_step: planData.last_step } : {},
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
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      try {
        // Initial fetch
        await fetchExpensePlans();

        if (!isMounted) return;

        // Set up real-time subscription for expense plans
        const channelName = `expense-plans-changes-${session.user.id}`;
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'expense_plans',
              filter: `user_id=eq.${session.user.id}`,
            },
            async (payload: any) => {
              if (!isMounted) return;
              
              console.log('📡 Expense plan change received:', {
                event: payload.eventType || payload.event,
                planId: payload.new?.id || payload.old?.id,
              });

              // Refetch plans to get updated data with buckets and locked funds
              // This ensures we have all related data
              await fetchExpensePlans();
            }
          )
          .subscribe((status: any) => {
            console.log('Expense plans subscription status:', status);
          });
      } catch (err) {
        console.error('Error setting up expense plans realtime subscription:', err);
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  /**
   * Save the last step/page the user was on before closing
   */
  const saveLastStep = async (planId: string, step: string) => {
    if (!session?.user?.id) {
      return; // Silently fail if not authenticated
    }

    try {
      // Get current metadata
      const { data: currentPlan } = await supabase
        .from('expense_plans')
        .select('metadata')
        .eq('id', planId)
        .eq('user_id', session.user.id)
        .single();

      const currentMetadata = currentPlan?.metadata || {};

      // Update last_step in metadata
      const { error: updateError } = await supabase
        .from('expense_plans')
        .update({
          metadata: {
            ...currentMetadata,
            last_step: step,
          },
        })
        .eq('id', planId)
        .eq('user_id', session.user.id);

      if (updateError) {
        console.error('Error saving last step:', updateError);
      }
    } catch (err) {
      console.error('Error saving last step:', err);
      // Don't throw - this is a non-critical operation
    }
  };

  const createCompletePlan = async (planData: {
    plan_name: string;
    name: string;
    total_budget: number;
    budget_structure?: BudgetStructure;
    start_date: string | null;
    end_date: string | null;
    plan_type?: 'recurring' | 'one_time' | 'long_term';
    priority?: 'high' | 'medium' | 'low';
    funding_method?: 'auto' | 'manual' | 'hybrid';
    payout_schedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
    required_per_cycle?: number;
    required_per_day?: number;
    spending_permission?: 'open' | 'restricted';
    lock_type?: 'none' | 'instant' | '24h_delay' | 'pin_required';
    pin_hash?: string | null;
    alert_at_70_percent?: boolean;
    alert_risk_failure?: boolean;
    alert_weekly_progress?: boolean;
    metadata?: Record<string, any>;
    buckets?: Array<{
      category_id: string;
      subcategory_id: string;
      name: string;
      target_amount: number;
    }>;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      return await retryWithBackoff(async () => {
        // Extract auto top-up config from metadata
        const metadata = planData.metadata || {};
        const autoTopupEnabled = metadata.auto_topup_enabled === true;
        
        // Store funding_method in metadata as fallback in case column doesn't exist
        if (planData.funding_method && !metadata.funding_method) {
          metadata.funding_method = planData.funding_method;
        }
        
        // Build insert object with only fields that exist
        // Start with required/base fields
        const insertData: any = {
          user_id: session.user.id,
          name: planData.name,
          total_budget: planData.total_budget,
          budget_structure: planData.budget_structure || 'fixed',
          start_date: planData.start_date,
          end_date: planData.end_date,
          status: 'active',
          metadata: metadata,
        };

        // Add optional fields if they exist in schema (using conditional spread)
        // These fields may not exist if migrations haven't been run
        if (planData.payout_schedule) {
          insertData.payout_schedule = planData.payout_schedule;
        }
        if (planData.plan_type) {
          insertData.plan_type = planData.plan_type;
        }
        // Try to add funding_method, but it may not exist in schema
        // If it fails, it's already stored in metadata as fallback
        if (planData.funding_method) {
          insertData.funding_method = planData.funding_method;
        }
        if (planData.required_per_cycle !== undefined) {
          insertData.required_per_cycle = planData.required_per_cycle;
        }
        if (planData.required_per_day !== undefined) {
          insertData.required_per_day = planData.required_per_day;
        }

        // Add auto top-up fields if enabled
        if (autoTopupEnabled) {
          insertData.auto_topup_enabled = true;
          if (metadata.auto_topup_frequency) {
            insertData.auto_topup_frequency = metadata.auto_topup_frequency as string;
          }
          if (metadata.auto_topup_amount) {
            insertData.auto_topup_amount = metadata.auto_topup_amount as number;
          }
          if (metadata.auto_topup_start_date) {
            insertData.auto_topup_start_date = metadata.auto_topup_start_date as string;
          }
          if (metadata.auto_topup_end_date) {
            insertData.auto_topup_end_date = metadata.auto_topup_end_date as string;
          }
          if (metadata.auto_topup_next_date) {
            insertData.auto_topup_next_date = metadata.auto_topup_next_date as string;
          }
          if (metadata.auto_topup_total_cycles) {
            insertData.auto_topup_total_cycles = metadata.auto_topup_total_cycles as number;
          }
        }
        
        // Try to create expense plan with all fields
        // If it fails due to missing columns, retry without optional columns
        let { data: plan, error: planError } = await supabase
          .from('expense_plans')
          .insert(insertData)
          .select()
          .single();

        // If error is about missing column, retry without optional columns
        if (planError && (planError.code === 'PGRST204' || planError.message?.includes('column'))) {
          console.warn('Column not found, retrying without optional columns:', planError.message);
          
          // Remove potentially missing columns and retry
          const fallbackData: any = {
            user_id: session.user.id,
            name: planData.name,
            total_budget: planData.total_budget,
            budget_structure: planData.budget_structure || 'fixed',
            start_date: planData.start_date,
            end_date: planData.end_date,
            status: 'active',
            metadata: metadata, // All optional data stored in metadata
          };
          
          // Only add fields that definitely exist in base schema
          const retryResult = await supabase
            .from('expense_plans')
            .insert(fallbackData)
            .select()
            .single();
            
          plan = retryResult.data;
          planError = retryResult.error;
        }

        if (planError) throw planError;
        if (!plan) throw new Error('Failed to create plan');

        // Create buckets if provided
        if (planData.buckets && planData.buckets.length > 0) {
          const bucketsToInsert = planData.buckets.map((bucket, index) => ({
            expense_plan_id: plan.id,
            category_id: bucket.category_id,
            subcategory_id: bucket.subcategory_id,
            name: bucket.name,
            target_amount: bucket.target_amount,
            order_index: index,
          }));

          const { error: bucketsError } = await supabase
            .from('expense_buckets')
            .insert(bucketsToInsert);

          if (bucketsError) {
            console.error('Error creating buckets:', bucketsError);
            // Continue anyway
          }
        }

        return plan;
      });
    } catch (err) {
      console.error('Error creating complete plan:', err);
      throw err;
    }
  };

  return {
    expensePlans,
    isLoading,
    error,
    fetchExpensePlans,
    createExpensePlan,
    createCompletePlan,
    updateExpensePlan,
    deleteExpensePlan,
    saveDraftExpensePlan,
    saveExpenseBuckets,
    lockExpenseFunds,
    finalizeExpensePlan,
    getExpenseBuckets,
    saveLastStep,
  };
}

