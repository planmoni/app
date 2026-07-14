import { supabase } from '@/lib/supabase';
import { fetchWithRetry, readCache, writeCache } from '@/lib/supabase-fetch';
import { PAGE_SIZE } from '@/lib/queries/keys';

export type NotificationEvent = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string | null;
  status: 'unread' | 'read';
  payout_plan_id: string | null;
  transaction_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const cacheKey = (userId: string) => `cache_notifications_${userId}`;

export async function readNotificationsCache(userId: string): Promise<NotificationEvent[] | null> {
  const cached = await readCache<NotificationEvent[]>(cacheKey(userId));
  return Array.isArray(cached) ? cached : null;
}

export async function fetchNotificationsPage(
  userId: string,
  pageParam = 0,
  pageSize = PAGE_SIZE.notifications
): Promise<{ items: NotificationEvent[]; nextPage: number | undefined }> {
  const from = pageParam * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = (await fetchWithRetry(
    () =>
      supabase
        .from('events')
        .select('id, user_id, type, title, description, status, payout_plan_id, transaction_id, created_at, metadata')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to),
    'Notifications page'
  )) as { data: NotificationEvent[] | null; error: any };

  if (error) throw error;

  const items = (data || []) as NotificationEvent[];
  if (pageParam === 0) {
    void writeCache(cacheKey(userId), items);
  }

  return {
    items,
    nextPage: items.length === pageSize ? pageParam + 1 : undefined,
  };
}

export async function fetchUnreadNotificationsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'unread');

  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('events').update({ status: 'read' }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'read' })
    .eq('user_id', userId)
    .eq('status', 'unread');
  if (error) throw error;
}
