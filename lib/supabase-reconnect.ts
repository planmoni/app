import { supabase } from '@/lib/supabase';

/**
 * Perform an internal "hard restart" of the Supabase connection.
 *
 * When the app returns from a long background period, existing WebSocket
 * channels are dead and the auth session token may be stale. Instead of
 * waiting for individual queries to timeout, we proactively:
 *   1. Remove every live realtime channel so each hook re-subscribes on a
 *      fresh WebSocket when it next calls setupRealtimeSubscription().
 *   2. Refresh the auth session to get a valid, non-expired access token.
 *
 * This should be called at t=0 of the foreground resume event, in parallel
 * with any initial delay, so the connection is clean before data queries fire.
 */
export async function reconnectSupabase(): Promise<void> {
  // Step 1: Tear down all realtime channels.
  // Each hook's foreground effect will call setupRealtimeSubscription() and
  // create a fresh channel after this, so nothing is lost.
  try {
    await supabase.removeAllChannels();
  } catch (_) {
    // Non-fatal — continue to auth refresh even if channel removal fails.
  }

  // Step 2: Refresh the auth session.
  // After a long background period, the JWT access token may be close to or
  // past expiry. Refreshing here ensures all subsequent API calls use a valid
  // token instead of getting 401 errors that look like network failures.
  try {
    await supabase.auth.refreshSession();
  } catch (_) {
    // Non-fatal — the existing session may still be valid.
  }
}
