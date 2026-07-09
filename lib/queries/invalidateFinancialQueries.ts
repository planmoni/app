import { queryClient } from '@/contexts/QueryClientProvider';
import { isFinancialQueryKey } from '@/lib/queries/keys';

export async function invalidateFinancialQueries(): Promise<void> {
  await queryClient.invalidateQueries({
    predicate: (query) => isFinancialQueryKey(query.queryKey),
  });
}

export function removeFinancialQueries(): void {
  queryClient.removeQueries({
    predicate: (query) => isFinancialQueryKey(query.queryKey),
  });
}
