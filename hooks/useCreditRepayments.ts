import { useEffect, useMemo, useState } from 'react';

type Repayment = {
  id: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  successfulAccount: string | null;
};

export function useCreditRepayments() {
  const [schedule, setSchedule] = useState<Repayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Stub/mock until backend wiring is done.
    const timer = setTimeout(() => {
      setSchedule([
        {
          id: 'rep-1',
          amount: 50000,
          dueDate: '2026-02-10',
          status: 'pending',
          attempts: 0,
          successfulAccount: null,
        },
        {
          id: 'rep-2',
          amount: 50000,
          dueDate: '2026-03-10',
          status: 'pending',
          attempts: 0,
          successfulAccount: null,
        },
        {
          id: 'rep-3',
          amount: 50000,
          dueDate: '2026-04-10',
          status: 'pending',
          attempts: 0,
          successfulAccount: null,
        },
      ]);
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const nextRepayment = useMemo(() => {
    return schedule.find((item) => item.status === 'pending' || item.status === 'processing') || null;
  }, [schedule]);

  return {
    schedule,
    nextRepayment,
    isLoading,
    error,
    refresh: () => Promise.resolve(),
  };
}
