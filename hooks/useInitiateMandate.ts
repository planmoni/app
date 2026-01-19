/**
 * Custom hook for initiating Mono DirectDebit mandate
 * 
 * Uses React Query + Axios to call Edge Function
 * 
 * SECURITY: All API calls go through Edge Functions
 * No secret keys exposed to client
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '@/lib/axios';
import { useAuth } from '@/contexts/AuthContext';

export interface InitiateMandateParams {
  bankAccountId: string;
  monoAccountId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  amount: number; // Maximum total debit authorization in Naira
}

export interface MandateResponse {
  mandate: {
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
    created_at: string;
  };
  mono_mandate_id: string;
  mono_reference: string;
  status: string;
  mono_url?: string; // URL for user authorization
}

export function useInitiateMandate() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (params: InitiateMandateParams): Promise<MandateResponse> => {
      if (!session?.user?.id) {
        throw new Error('User must be logged in');
      }

      const response = await axiosInstance.post('/mono-mandate-initiate', params);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to initiate mandate');
      }

      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate mandates query to refetch
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
    },
  });
}


