import { useState, useEffect } from 'react';
import { ExpensePlan, ExpenseBucket, BudgetStructure } from '@/types/expense-planner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function useExpensePlans() {
  const { session } = useAuth();
  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchExpensePlans = async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('expense_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      setExpensePlans(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch expense plans'));
      console.error('Error fetching expense plans:', err);
    } finally {
      setIsLoading(false);
    }
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

        if (updateError) throw updateError;
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

      if (insertError) throw insertError;
      return data;
    } catch (err) {
      console.error('Error saving draft expense plan:', err);
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
    try {
      const { error: deleteError } = await supabase
        .from('expense_plans')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Update local state
      setExpensePlans(prev => prev.filter(plan => plan.id !== id));
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

