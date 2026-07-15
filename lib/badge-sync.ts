import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

const DEDUPE_MS = 2500;

let lastUserId: string | null = null;
let lastSyncedAt = 0;
let lastUnreadCount = 0;
let inFlight: Promise<number> | null = null;

/**
 * Centralized badge count synchronization.
 * Coalesces rapid duplicate calls (e.g. login + focus + listeners).
 */
export async function syncBadgeCount(userId: string): Promise<number> {
  if (!userId) return 0;

  const now = Date.now();
  if (inFlight && lastUserId === userId) {
    return inFlight;
  }

  if (lastUserId === userId && now - lastSyncedAt < DEDUPE_MS) {
    return lastUnreadCount;
  }

  lastUserId = userId;
  inFlight = (async () => {
    try {
      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'unread');

      if (error) {
        console.error('❌ Error syncing badge count:', error);
        return lastUnreadCount;
      }

      const unreadCount = count || 0;
      await Notifications.setBadgeCountAsync(unreadCount);

      if (unreadCount !== lastUnreadCount) {
        console.log(`✅ Badge count synced: ${unreadCount} unread notifications`);
      }

      lastUnreadCount = unreadCount;
      lastSyncedAt = Date.now();
      return unreadCount;
    } catch (error) {
      console.error('❌ Error syncing badge count:', error);
      return lastUnreadCount;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Get current unread count without syncing badge
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'unread');

    if (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
}
