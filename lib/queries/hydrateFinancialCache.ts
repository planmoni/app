import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Hydrate React Query cache from AsyncStorage before the network fetch completes.
 */
export function useHydrateFinancialCache<T>(
  userId: string | undefined,
  queryKey: QueryKey,
  readFn: (userId: string) => Promise<T | null>
): void {
  const queryClient = useQueryClient();
  const readFnRef = useRef(readFn);
  readFnRef.current = readFn;

  useEffect(() => {
    if (!userId) return;
    if (queryClient.getQueryData(queryKey) !== undefined) return;

    let cancelled = false;
    void readFnRef.current(userId).then((data) => {
      if (cancelled || data == null) return;
      if (queryClient.getQueryData(queryKey) === undefined) {
        queryClient.setQueryData(queryKey, data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, queryClient, queryKey]);
}
