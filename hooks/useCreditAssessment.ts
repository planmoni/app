import { useEffect, useState } from 'react';

type Assessment = {
  creditLimit: number;
  recommended: number;
  outstanding: number;
  mandateStatus: 'pending' | 'approved' | 'ready' | 'cancelled';
  readyToDebitAt: string | null;
  gsmEnabled: boolean;
};

export function useCreditAssessment() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Stub/mock until backend wiring is done.
    const timer = setTimeout(() => {
      setAssessment({
        creditLimit: 250000,
        recommended: 150000,
        outstanding: 0,
        mandateStatus: 'approved', // can be pending/approved/ready/cancelled
        readyToDebitAt: 'In ~24h after approval',
        gsmEnabled: true,
      });
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return {
    assessment,
    isLoading,
    error,
    refresh: () => Promise.resolve(),
  };
}
