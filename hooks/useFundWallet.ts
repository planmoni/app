/**
 * Custom hook for funding wallet via Mono DirectDebit
 * 
 * Uses React Query + Axios to call Edge Function
 * Executes a user-initiated debit using an active mandate
 * 
 * SECURITY: All API calls go through Edge Functions
 * No secret keys exposed to client
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import axiosInstance from '@/lib/axios';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys } from '@/lib/queries/keys';
import { noteNextWalletFetchReason } from '@/lib/queries/walletQueries';

export interface FundWalletParams {
  mandateId: string; // Internal mandate ID
  amount: number; // Amount in Naira
  description?: string;
  reference?: string;
}

export interface FundWalletResponse {
  debit_id: string;
  status: string;
  reference: string;
  amount: number;
  mandate_id: string;
  settlement_date?: string;
  transaction_id?: string;
}

export function useFundWallet() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (params: FundWalletParams): Promise<FundWalletResponse> => {
      if (!session?.user?.id) {
        throw new Error('User must be logged in');
      }

      try {
        const response = await axiosInstance.post('/mono-debit-execute', params);
        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to fund wallet');
        }
        return response.data.data;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data?.error) {
          throw new Error(err.response.data.error);
        }
        throw err;
      }
    },
    onSuccess: () => {
      const userId = session?.user?.id;
      if (userId) {
        noteNextWalletFetchReason('fund_wallet');
        void queryClient.invalidateQueries({ queryKey: financialQueryKeys.wallet(userId) });
        void queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['mandates'] });
    },
  });
}


