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
      
      // Fetch all budget plans
      const { data: plans, error: fetchError } = await supabase
        .from('budget_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      if (!plans || plans.length === 0) {
        setExpensePlans([]);
        return;
      }

      // Enhance plans with categories/subcategories and funding status
      // Buckets are no longer a separate table - categories/subcategories are stored directly in budget_plans
      const enhancedPlans: ExpensePlan[] = plans.map((plan: any) => {
        // Get current_balance from plan
        const currentBalance = (plan as any).current_balance || 0;
        const totalBudget = plan.total_budget || 0;
        
        // Calculate funding status based on current_balance and total_budget
        const fundingStatus = getPlanFundingStatus(plan.status, currentBalance, totalBudget);
        
        // Convert subcategories to bucket-like structure for backward compatibility
        const subcategories = (plan as any).subcategories || [];
        const planBuckets: ExpenseBucket[] = subcategories.map((sub: any, index: number) => ({
          id: `${plan.id}-${sub.category_id}-${sub.subcategory_id}`,
          expense_plan_id: plan.id,
          category_id: sub.category_id,
          subcategory_id: sub.subcategory_id,
          name: sub.name || `${sub.category_id} - ${sub.subcategory_id}`,
          target_amount: 0, // Not stored in budget_plans anymore
          amount_spent: 0,
          remaining_amount: 0,
          order_index: index,
          created_at: plan.created_at,
          updated_at: plan.updated_at,
        }));

        // Extract metadata fields
        const metadata = plan.metadata || {};
        
        return {
          ...plan,
          buckets: planBuckets,
          total_locked: 0, // No longer using locked funds
          funding_status: fundingStatus,
          // Extract metadata fields to top level for easier access
          start_action: metadata.start_action || plan.start_action,
          payout_account_id: metadata.payout_account_id || plan.payout_account_id,
          payout_account_label: metadata.payout_account_label || plan.payout_account_label,
          payout_account_bank_name: metadata.payout_account_bank_name || plan.payout_account_bank_name,
          funding_method: plan.funding_method || metadata.funding_method || 'manual',
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
    start_date?: string;
    end_date?: string;
    funding_method?: 'auto' | 'manual';
    payout_schedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
    required_per_cycle?: number;
    required_per_day?: number;
    planId?: string;
    last_step?: string; // Track the last step/page user was on
    categories?: string[]; // Array of category IDs
    subcategories?: Array<{ category_id: string; subcategory_id: string }>; // Array of subcategory objects
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
        if (planData.start_date !== undefined) updates.start_date = planData.start_date;
        if (planData.end_date !== undefined) updates.end_date = planData.end_date;
        if (planData.funding_method !== undefined) updates.funding_method = planData.funding_method;
        if (planData.payout_schedule !== undefined) updates.payout_schedule = planData.payout_schedule;
        if (planData.required_per_cycle !== undefined) updates.required_per_cycle = planData.required_per_cycle;
        if (planData.required_per_day !== undefined) updates.required_per_day = planData.required_per_day;
        // Add categories and subcategories if provided
        if (planData.categories !== undefined) updates.categories = planData.categories;
        if (planData.subcategories !== undefined) updates.subcategories = planData.subcategories;
        
        // Update categories and subcategories if provided
        if (planData.categories !== undefined) {
          updates.categories = planData.categories;
        }
        if (planData.subcategories !== undefined) {
          updates.subcategories = planData.subcategories;
        }
        
        // Update last_step in metadata if provided
        if (planData.last_step !== undefined) {
        // Get current metadata and update last_step
        const { data: currentPlan } = await supabase
          .from('budget_plans')
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
          .from('budget_plans')
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
      if (!planData.total_budget) {
        throw new Error('total_budget is required to create a draft plan');
      }

      const insertData: any = {
        user_id: session.user.id,
        name: planData.name || planData.plan_name || 'Untitled Plan',
        plan_name: planData.plan_name || planData.name || 'Untitled Plan',
        total_budget: planData.total_budget,
        start_date: planData.start_date || null,
        end_date: planData.end_date || null,
        funding_method: planData.funding_method || 'manual',
        payout_schedule: planData.payout_schedule || 'weekly',
        required_per_cycle: planData.required_per_cycle || 0,
        required_per_day: planData.required_per_day || 0,
        status: 'active',
        metadata: planData.last_step ? { last_step: planData.last_step } : {},
      };

      // Add categories and subcategories if provided
      if (planData.categories !== undefined) {
        insertData.categories = planData.categories;
      }
      if (planData.subcategories !== undefined) {
        insertData.subcategories = planData.subcategories;
      }

      const { data, error: insertError } = await supabase
        .from('budget_plans')
        .insert(insertData)
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
      // Buckets are no longer stored separately - categories/subcategories are in budget_plans
      // Extract categories and subcategories from buckets and update the plan
      const uniqueCategories = new Set<string>();
      const subcategoriesArray: Array<{ category_id: string; subcategory_id: string }> = [];
      
      buckets.forEach(bucket => {
        if (bucket.category_id) {
          uniqueCategories.add(bucket.category_id);
        }
        if (bucket.category_id && bucket.subcategory_id) {
          subcategoriesArray.push({
            category_id: bucket.category_id,
            subcategory_id: bucket.subcategory_id,
          });
        }
      });

      // Update the plan with categories and subcategories
      const { data, error: updateError } = await supabase
        .from('budget_plans')
        .update({
          categories: Array.from(uniqueCategories),
          subcategories: subcategoriesArray,
        })
        .eq('id', planId)
        .select();

      if (updateError) throw updateError;
      
      // Return bucket-like structure for backward compatibility
      return subcategoriesArray.map((sub, index) => ({
        id: `${planId}-${sub.category_id}-${sub.subcategory_id}`,
        expense_plan_id: planId,
        category_id: sub.category_id,
        subcategory_id: sub.subcategory_id,
        name: `${sub.category_id} - ${sub.subcategory_id}`,
        target_amount: 0,
        amount_spent: 0,
        remaining_amount: 0,
        order_index: index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
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
        .from('budget_plans')
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

      // Note: create_expense_plan_with_buckets RPC function may not exist anymore
      // Creating plan directly instead
      const { data: createdPlan, error: createError } = await supabase
        .from('budget_plans')
        .insert({
          user_id: session.user.id,
          name: planData.name,
          total_budget: planData.total_budget,
          start_date: planData.start_date || null,
          end_date: planData.end_date || null,
          status: 'active',
        })
        .select()
        .single();

      if (createError) throw createError;

      return createdPlan;
    } catch (err) {
      console.error('Error creating expense plan:', err);
      throw err;
    }
  };

  const updateExpensePlan = async (id: string, updates: Partial<ExpensePlan>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('budget_plans')
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
        .from('budget_plans')
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
        .from('budget_plans')
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

  const transferPlanToWallet = async (planId: string, amount: number) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.rpc('transfer_plan_to_wallet', {
        p_user_id: session.user.id,
        p_plan_id: planId,
        p_amount: amount,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to transfer funds');
      }

      // Refresh plans to get updated balances
      await fetchExpensePlans();

      return data;
    } catch (err) {
      console.error('Error transferring plan to wallet:', err);
      throw err;
    }
  };

  const getExpenseBuckets = async (planId: string): Promise<ExpenseBucket[]> => {
    try {
      // Fetch plan to get subcategories
      const { data: plan, error: fetchError } = await supabase
        .from('budget_plans')
        .select('subcategories, created_at, updated_at')
        .eq('id', planId)
        .single();

      if (fetchError) throw fetchError;
      
      // Convert subcategories to bucket-like structure
      const subcategories = (plan as any)?.subcategories || [];
      return subcategories.map((sub: any, index: number) => ({
        id: `${planId}-${sub.category_id}-${sub.subcategory_id}`,
        expense_plan_id: planId,
        category_id: sub.category_id,
        subcategory_id: sub.subcategory_id,
        name: sub.name || `${sub.category_id} - ${sub.subcategory_id}`,
        target_amount: 0,
        amount_spent: 0,
        remaining_amount: 0,
        order_index: index,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      }));
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
        .from('budget_plans')
        .select('metadata')
        .eq('id', planId)
        .eq('user_id', session.user.id)
        .single();

      const currentMetadata = currentPlan?.metadata || {};

      // Update last_step in metadata
      const { error: updateError } = await supabase
        .from('budget_plans')
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
    start_date: string | null;
    end_date: string | null;
    funding_method?: 'auto' | 'manual';
    payout_schedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
    required_per_cycle?: number;
    required_per_day?: number;
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
        
        // Extract categories and subcategories from buckets BEFORE creating plan
        let uniqueCategories: string[] = [];
        let subcategoriesArray: Array<{ category_id: string; subcategory_id: string }> = [];
        
        // First, check if categories/subcategories are provided in metadata (for AI-created plans)
        if (metadata.categories && Array.isArray(metadata.categories) && metadata.categories.length > 0) {
          uniqueCategories = [...new Set(metadata.categories)];
        }
        if (metadata.subcategories && Array.isArray(metadata.subcategories) && metadata.subcategories.length > 0) {
          subcategoriesArray = metadata.subcategories;
        }
        
        // Then, extract from buckets if available (this will override metadata if buckets exist)
        if (planData.buckets && planData.buckets.length > 0) {
          const categorySet = new Set<string>(uniqueCategories); // Start with existing categories
          planData.buckets.forEach(bucket => {
            if (bucket.category_id) {
              categorySet.add(bucket.category_id);
            }
            if (bucket.category_id && bucket.subcategory_id) {
              // Only add if not already in array
              const exists = subcategoriesArray.some(
                sub => sub.category_id === bucket.category_id && sub.subcategory_id === bucket.subcategory_id
              );
              if (!exists) {
                subcategoriesArray.push({
                  category_id: bucket.category_id,
                  subcategory_id: bucket.subcategory_id,
                });
              }
            }
          });
          uniqueCategories = Array.from(categorySet);
        } else if (uniqueCategories.length === 0) {
          // If no buckets yet, try to read from existing draft plan if planId is in metadata
          // This handles the case where categories were saved during plan-details step
          const existingPlanId = metadata.planId || (planData as any).planId;
          if (existingPlanId) {
            try {
              const { data: existingPlan } = await supabase
                .from('budget_plans')
                .select('categories, subcategories')
                .eq('id', existingPlanId)
                .eq('user_id', session.user.id)
                .single();
              
              if (existingPlan?.categories && Array.isArray(existingPlan.categories)) {
                uniqueCategories = existingPlan.categories;
              }
              if (existingPlan?.subcategories && Array.isArray(existingPlan.subcategories)) {
                subcategoriesArray = existingPlan.subcategories;
              }
            } catch (err) {
              console.warn('Could not read categories from existing plan:', err);
            }
          }
        }

        // Build insert object with only fields that exist
        // Start with required/base fields
        const insertData: any = {
          user_id: session.user.id,
          name: planData.name,
          total_budget: planData.total_budget,
          start_date: planData.start_date,
          end_date: planData.end_date,
          status: 'active',
          metadata: metadata,
        };

        // Add categories and subcategories if we have them
        if (uniqueCategories.length > 0) {
          insertData.categories = uniqueCategories;
        }
        if (subcategoriesArray.length > 0) {
          insertData.subcategories = subcategoriesArray;
        }

        // Add optional fields if they exist in schema (using conditional spread)
        // These fields may not exist if migrations haven't been run
        if (planData.payout_schedule) {
          insertData.payout_schedule = planData.payout_schedule;
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
        if (planData.alert_at_70_percent !== undefined) {
          insertData.alert_at_70_percent = planData.alert_at_70_percent;
        }
        if (planData.alert_risk_failure !== undefined) {
          insertData.alert_risk_failure = planData.alert_risk_failure;
        }
        if (planData.alert_weekly_progress !== undefined) {
          insertData.alert_weekly_progress = planData.alert_weekly_progress;
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
          .from('budget_plans')
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
            start_date: planData.start_date,
            end_date: planData.end_date,
            status: 'active',
            metadata: metadata, // All optional data stored in metadata
          };

          // Try to add categories/subcategories even in fallback (they should exist after migration)
          if (uniqueCategories.length > 0) {
            fallbackData.categories = uniqueCategories;
          }
          if (subcategoriesArray.length > 0) {
            fallbackData.subcategories = subcategoriesArray;
          }
          
          // Only add fields that definitely exist in base schema
          const retryResult = await supabase
            .from('budget_plans')
            .insert(fallbackData)
            .select()
            .single();
            
          plan = retryResult.data;
          planError = retryResult.error;
        }

        if (planError) throw planError;
        if (!plan) throw new Error('Failed to create plan');

        // Buckets are no longer stored separately - categories/subcategories are in budget_plans
        // If we have buckets but categories/subcategories weren't included, update the plan
        if (planData.buckets && planData.buckets.length > 0 && (uniqueCategories.length === 0 || subcategoriesArray.length === 0)) {
          // Re-extract from buckets if not already extracted
          const categorySet = new Set<string>();
          const subcatsArray: Array<{ category_id: string; subcategory_id: string }> = [];
          
          planData.buckets.forEach(bucket => {
            if (bucket.category_id) {
              categorySet.add(bucket.category_id);
            }
            if (bucket.category_id && bucket.subcategory_id) {
              subcatsArray.push({
                category_id: bucket.category_id,
                subcategory_id: bucket.subcategory_id,
              });
            }
          });
          
          // Update the plan with categories and subcategories
          const { error: updateError } = await supabase
            .from('budget_plans')
            .update({
              categories: Array.from(categorySet),
              subcategories: subcatsArray,
            })
            .eq('id', plan.id);
          
          if (updateError) {
            console.error('Error updating plan with categories/subcategories:', updateError);
            // Continue anyway - not critical
          }
        }

        return plan;
      });
    } catch (err) {
      console.error('Error creating complete plan:', err);
      throw err;
    }
  };

  const addFundsToPlan = async (planId: string, amount: number) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    if (!planId) {
      throw new Error('Plan ID is required');
    }

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('transfer_wallet_to_plan', {
        p_user_id: session.user.id,
        p_plan_id: planId,
        p_amount: amount,
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Failed to transfer funds');
      }

      if (!data || (data as any).success === false) {
        const errorMsg = (data as any)?.error || 'Failed to transfer funds';
        throw new Error(errorMsg);
      }

      // Refresh expense plans to get updated balance
      await fetchExpensePlans();

      return {
        success: true,
        new_wallet_balance: (data as any).new_wallet_balance,
        new_plan_balance: (data as any).new_plan_balance,
        amount: (data as any).amount,
      };
    } catch (error: any) {
      console.error('Error adding funds to plan:', error);
      throw error;
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
    addFundsToPlan,
    transferPlanToWallet,
  };
}

