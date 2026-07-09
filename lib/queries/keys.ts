export const financialQueryKeys = {
  wallet: (userId: string) => ['wallet', userId] as const,
  payoutPlans: (userId: string) => ['payoutPlans', userId] as const,
  transactions: (userId: string, limit?: number) =>
    ['transactions', userId, limit ?? 50] as const,
};

export function isFinancialQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return root === 'wallet' || root === 'payoutPlans' || root === 'transactions';
}
