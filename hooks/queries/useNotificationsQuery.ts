import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financialQueryKeys, PAGE_SIZE } from '@/lib/queries/keys';
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationsCache,
  type NotificationEvent,
} from '@/lib/queries/notificationsQueries';
import { useHydrateFinancialCache } from '@/lib/queries/hydrateFinancialCache';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { syncBadgeCount } from '@/lib/badge-sync';

const STALE_TIME_MS = 2 * 60 * 1000;

type NotificationsPage = { items: NotificationEvent[]; nextPage: number | undefined };
type InfiniteNotificationsData = InfiniteData<NotificationsPage, number>;

async function readInfiniteNotificationsCache(
  userId: string
): Promise<InfiniteNotificationsData | null> {
  const firstPage = await readNotificationsCache(userId);
  if (!firstPage?.length) return null;
  return {
    pages: [
      {
        items: firstPage,
        nextPage: firstPage.length === PAGE_SIZE.notifications ? 1 : undefined,
      },
    ],
    pageParams: [0],
  };
}

/**
 * Activities screen: loads latest 10 first, then more on scroll.
 * Only runs while this hook is mounted (not from tab bar / app launch).
 */
export function useNotificationsQuery() {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () =>
      userId
        ? financialQueryKeys.notificationsInfinite(userId)
        : (['notifications', 'infinite', 'anonymous'] as const),
    [userId]
  );

  useHydrateFinancialCache(userId, queryKey, readInfiniteNotificationsCache);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) =>
      fetchNotificationsPage(userId!, pageParam, PAGE_SIZE.notifications),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
    retry: 1,
    networkMode: 'online',
  });

  const notifications = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data]
  );

  const { isLoading: guardedLoading } = useLoadingGuard(
    query.isLoading,
    notifications.length > 0
  );

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
      if (userId) void syncBadgeCount(userId);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => {
      patchLocalStatus((items) => items.map((n) => ({ ...n, status: 'read' as const })));
      if (userId) void syncBadgeCount(userId);
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
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : String(query.error)
      : null,
    markAsRead: (id: string) => markReadMutation.mutateAsync(id),
    markAllAsRead: () => markAllReadMutation.mutateAsync(),
    isMarkingAllAsRead: markAllReadMutation.isPending,
  };
}

/**
 * Optional lightweight unread count — call only where a badge is shown.
 */
export function useUnreadNotificationsCount(enabled = true) {
  const { session, isAuthReady } = useAuth();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: userId
      ? financialQueryKeys.notificationsUnread(userId)
      : ['notifications', 'unread', 'anonymous'],
    queryFn: () =>
      import('@/lib/queries/notificationsQueries').then((m) =>
        m.fetchUnreadNotificationsCount(userId!)
      ),
    enabled: enabled && isAuthReady && !!userId,
    staleTime: STALE_TIME_MS,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  return {
    unreadCount: query.data ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
