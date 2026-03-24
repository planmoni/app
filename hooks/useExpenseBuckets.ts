import { useState, useEffect } from 'react';
import { ExpenseBucket } from '@/types/expense-planner';
import { useAuth } from '@/contexts/AuthContext';

export function useExpenseBuckets(planId: string | null) {
  const { session } = useAuth();
  const [buckets, setBuckets] = useState<ExpenseBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBuckets = async () => {
    if (!session?.user?.id || !planId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // TODO: Replace with real Supabase query
      // const { data, error } = await supabase
      //   .from('expense_buckets')
      //   .select('*')
      //   .eq('expense_plan_id', planId)
      //   .order('order_index', { ascending: true });
      
      // For now, return empty array
      setBuckets([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch expense buckets'));
      console.error('Error fetching expense buckets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createBucket = async (bucketData: {
    expense_plan_id: string;
    name: string;
    target_amount: number;
    order_index: number;
  }) => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      // TODO: Replace with real Supabase insert
      const newBucket: ExpenseBucket = {
        id: `temp-${Date.now()}`,
        expense_plan_id: bucketData.expense_plan_id,
        name: bucketData.name,
        target_amount: bucketData.target_amount,
        amount_spent: 0,
        remaining_amount: bucketData.target_amount,
        order_index: bucketData.order_index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setBuckets(prev => [...prev, newBucket]);
      return newBucket;
    } catch (err) {
      console.error('Error creating expense bucket:', err);
      throw err;
    }
  };

  const updateBucket = async (id: string, updates: Partial<ExpenseBucket>) => {
    try {
      // TODO: Replace with real Supabase update
      setBuckets(prev =>
        prev.map(bucket => (bucket.id === id ? { ...bucket, ...updates } : bucket))
      );
    } catch (err) {
      console.error('Error updating expense bucket:', err);
      throw err;
    }
  };

  const deleteBucket = async (id: string) => {
    try {
      // TODO: Replace with real Supabase delete
      setBuckets(prev => prev.filter(bucket => bucket.id !== id));
    } catch (err) {
      console.error('Error deleting expense bucket:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (planId) {
      fetchBuckets();
    }
  }, [planId, session?.user?.id]);

  return {
    buckets,
    isLoading,
    error,
    fetchBuckets,
    createBucket,
    updateBucket,
    deleteBucket,
  };
}

