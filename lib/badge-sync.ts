import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

/**
 * Centralized badge count synchronization
 * Ensures badge count always matches the actual unread notifications in the database
 */
export async function syncBadgeCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'unread');

    if (error) {
      console.error('❌ Error syncing badge count:', error);
      return 0;
    }

    const unreadCount = count || 0;
    
    // Always sync the badge count to match database
    await Notifications.setBadgeCountAsync(unreadCount);
    
    console.log(`✅ Badge count synced: ${unreadCount} unread notifications`);
    
    return unreadCount;
  } catch (error) {
    console.error('❌ Error syncing badge count:', error);
    return 0;
  }
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

