import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys, PAGE_SIZE } from '@/lib/queries/keys';
import {
  fetchNotificationsPage,
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationsCache,
  type NotificationEvent,
} from '@/lib/queries/notificationsQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { logAuthQueryGateViolation } from '@/lib/auth-telemetry';
import { syncBadgeCount } from '@/lib/badge-sync';

const STALE_TIME_MS = 5 * 60 * 1000;

type InfiniteNotificationsData = {
  pages: Array<{ items: NotificationEvent[]; nextPage: number | undefined }>;
  pageParams: number[];
};

async function readInfiniteNotificationsCache(
  userId: string
): Promise<InfiniteNotificationsData | null> {
  const firstPage = await readNotificationsCache(userId);
  if (!firstPage?.length) return null;
  return {
    pages: [{ items: firstPage, nextPage: firstPage.length === PAGE_SIZE.notifications ? 1 : undefined }],
    pageParams: [0],
  };
}

export function useNotificationsQuery() {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => (userId ? financialQueryKeys.notifications(userId) : (['notifications', 'anonymous'] as const)),
    [userId]
  );

  useHydrateFinancialCache(userId, queryKey, readInfiniteNotificationsCache);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => {
      logAuthQueryGateViolation('notifications', isAuthReady, userId);
      return fetchNotificationsPage(userId!, pageParam, PAGE_SIZE.notifications);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
  });

  const notifications = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data]
  );

  const { isLoading: guardedLoading } = useLoadingGuard(
    query.isLoading,
    notifications.length > 0
  );

  const unreadCountQuery = useQuery({
    queryKey: userId ? financialQueryKeys.notificationsUnread(userId) : ['notifications', 'unread', 'anonymous'],
    queryFn: () => fetchUnreadNotificationsCount(userId!),
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
    refetchInterval: 60_000,
  });

  const patchLocalStatus = useCallback(
    (updater: (items: NotificationEvent[]) => NotificationEvent[]) => {
      queryClient.setQueryData<InfiniteNotificationsData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: updater(page.items),
          })),
        };
      });
    },
    [queryClient, queryKey]
  );

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (_data, id) => {
      patchLocalStatus((items) =>
        items.map((n) => (n.id === id ? { ...n, status: 'read' as const } : n))
      );
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: financialQueryKeys.notificationsUnread(userId) });
        void syncBadgeCount(userId);
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => {
      patchLocalStatus((items) => items.map((n) => ({ ...n, status: 'read' as const })));
      if (userId) {
        queryClient.setQueryData(financialQueryKeys.notificationsUnread(userId), 0);
        void syncBadgeCount(userId);
      }
    },
  });

  return {
    notifications,
    isLoading: guardedLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
    unreadCount: unreadCountQuery.data ?? 0,
    markAsRead: (id: string) => markReadMutation.mutateAsync(id),
    markAllAsRead: () => markAllReadMutation.mutateAsync(),
    isMarkingAllAsRead: markAllReadMutation.isPending,
  };
}

/** Lightweight badge-only hook — count query, not full list. */
export function useUnreadNotificationsCount() {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: userId ? financialQueryKeys.notificationsUnread(userId) : ['notifications', 'unread', 'anonymous'],
    queryFn: () => fetchUnreadNotificationsCount(userId!),
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
