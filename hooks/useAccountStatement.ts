import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface StatementRequestStatus {
  canRequest: boolean;
  requestsToday: number;
  maxRequests: number;
  requests: any[];
}

export function useAccountStatement() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatementRequestStatus | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchStatus();
    }
  }, [session?.user?.id]);

  const fetchStatus = async () => {
    try {
      if (!session?.user?.id) return;

      const { data: canRequest, error: limitError } = await supabase
        .rpc('check_statement_request_limit', { p_user_id: session.user.id });

      if (limitError) {
        console.error('Error checking request limit:', limitError);
        return;
      }

      const { data: requests, error: requestsError } = await supabase
        .from('account_statement_requests')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error fetching requests:', requestsError);
        return;
      }

      setStatus({
        canRequest: canRequest || false,
        requestsToday: requests?.length || 0,
        maxRequests: 4,
        requests: requests || [],
      });
    } catch (err) {
      console.error('Error fetching statement status:', err);
    }
  };

  const requestStatement = async (startDate: Date, endDate: Date): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!session?.access_token) {
        const error = 'Not authenticated';
        setError(error);
        console.error(error);
        return false;
      }

      console.log('Requesting statement from:', startDate, 'to:', endDate);

      const { data, error: invokeError } = await supabase.functions.invoke('send-account-statement', {
        body: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      console.log('Edge function response:', data, invokeError);

      if (invokeError) {
        const errorMsg = invokeError.message || 'Failed to request statement';
        setError(errorMsg);
        console.error('Request failed:', invokeError);
        console.error('Full error object:', JSON.stringify(invokeError));
        return false;
      }

      if (data?.error) {
        if (data.error === 'Daily limit reached') {
          setError(data.message || 'Daily limit reached. Please try again tomorrow.');
        } else {
          setError(data.error);
        }
        console.error('Request failed:', data);
        return false;
      }

      await fetchStatus();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request statement';
      setError(errorMessage);
      console.error('Error requesting statement:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    status,
    requestStatement,
    fetchStatus,
  };
}
