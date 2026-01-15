/**
 * Custom hook for fetching Mono DirectDebit mandate status
 * 
 * Uses React Query + Axios to fetch mandate data
 * 
 * SECURITY: All API calls go through Edge Functions
 * No secret keys exposed to client
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface MonoMandate {
  id: string;
  user_id: string;
  bank_account_id: string;
  mono_account_id: string;
  mono_mandate_id: string | null;
  mono_reference: string | null;
  status: 'pending' | 'active' | 'cancelled' | 'expired' | 'failed';
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code?: string;
  authorized_at: string | null;
  activated_at: string | null;
  created_at: string;
}

export function useMandateStatus(mandateId?: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['mandate', mandateId],
    queryFn: async (): Promise<MonoMandate | null> => {
      if (!session?.user?.id || !mandateId) {
        return null;
      }

      const { data, error } = await supabase
        .from('mono_mandates')
        .select('*')
        .eq('id', mandateId)
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        throw error;
      }

      return data as MonoMandate;
    },
    enabled: !!session?.user?.id && !!mandateId,
  });
}

export function useUserMandates() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['mandates', session?.user?.id],
    queryFn: async (): Promise<MonoMandate[]> => {
      if (!session?.user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('mono_mandates')
        .select('*')
        .eq('user_id', session.user.id)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []) as MonoMandate[];
    },
    enabled: !!session?.user?.id,
  });
}

