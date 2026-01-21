import { useState } from 'react';
import { router } from 'expo-router';
import { useToast } from '@/contexts/ToastContext';

type ApplyParams = {
  amount: number;
  tenorDays: number;
  agreeGSM: boolean;
};

export function useCreditApplication() {
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const applyCredit = async (params: ApplyParams) => {
    setIsApplying(true);
    setError(null);
    try {
      // TODO: wire to backend edge function
      await new Promise((resolve) => setTimeout(resolve, 400));
      showToast('Application submitted. We’ll confirm shortly.', 'success');
      router.replace('/credit/repayment-schedule');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Application failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return { applyCredit, isApplying, error };
}
