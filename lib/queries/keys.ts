export const PAGE_SIZE = {
  notifications: 10,
  transactions: 15,
  payoutPlans: 15,
};

export const financialQueryKeys = {
  wallet: (userId: string) => ['wallet', userId] as const,
  payoutPlans: (userId: string) => ['payoutPlans', userId] as const,
  payoutPlansInfinite: (userId: string) => ['payoutPlans', 'infinite', userId] as const,
  transactions: (userId: string, limit?: number) =>
    ['transactions', userId, limit ?? PAGE_SIZE.transactions] as const,
  transactionsInfinite: (userId: string) => ['transactions', 'infinite', userId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  notificationsInfinite: (userId: string) => ['notifications', 'infinite', userId] as const,
  notificationsUnread: (userId: string) => ['notifications', 'unreadCount', userId] as const,
};

export function isFinancialQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return root === 'wallet' || root === 'payoutPlans' || root === 'transactions' || root === 'notifications';
}
