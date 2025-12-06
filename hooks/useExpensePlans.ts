import { useState, useEffect } from 'react';
import { ExpensePlan } from '@/types/expense-planner';
import { useAuth } from '@/contexts/AuthContext';

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
      
      // TODO: Replace with real Supabase query
      // const { data, error } = await supabase
      //   .from('expense_plans')
      //   .select('*')
      //   .eq('user_id', session.user.id)
      //   .order('created_at', { ascending: false });
      
      // For now, return empty array
      setExpensePlans([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch expense plans'));
      console.error('Error fetching expense plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createExpensePlan = async (planData: {
    name: string;
    total_budget: number;
    buckets: Array<{ name: string; target_amount: number }>;
    start_date?: string;
    end_date?: string;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      // TODO: Replace with real Supabase insert
      // This should create the plan and buckets in a transaction
      const newPlan: ExpensePlan = {
        id: `temp-${Date.now()}`,
        user_id: session.user.id,
        name: planData.name,
        total_budget: planData.total_budget,
        total_spent: 0,
        remaining_budget: planData.total_budget,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setExpensePlans(prev => [newPlan, ...prev]);
      return newPlan;
    } catch (err) {
      console.error('Error creating expense plan:', err);
      throw err;
    }
  };

  const updateExpensePlan = async (id: string, updates: Partial<ExpensePlan>) => {
    try {
      // TODO: Replace with real Supabase update
      setExpensePlans(prev =>
        prev.map(plan => (plan.id === id ? { ...plan, ...updates } : plan))
      );
    } catch (err) {
      console.error('Error updating expense plan:', err);
      throw err;
    }
  };

  const deleteExpensePlan = async (id: string) => {
    try {
      // TODO: Replace with real Supabase delete
      setExpensePlans(prev => prev.filter(plan => plan.id !== id));
    } catch (err) {
      console.error('Error deleting expense plan:', err);
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
  };
}

