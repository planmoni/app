import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/mixpanel';
import type { LifecycleEventNameType } from '@/lib/lifecycleEvents';

/**
 * Record a funnel event for behavioral retargeting (Postgres) and optional Mixpanel dashboards.
 * Never throws; safe to call from UI without awaiting in a blocking way.
 */
export async function trackLifecycleEvent(
  eventName: LifecycleEventNameType,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return;
    }

    const { error } = await supabase.from('lifecycle_events').insert({
      user_id: user.id,
      event_name: eventName,
      properties: (properties ?? {}) as Record<string, unknown>,
    });

    if (error) {
      console.warn('trackLifecycleEvent insert failed:', eventName, error.message);
    }

    try {
      trackEvent(eventName, { ...properties, source: 'lifecycle' });
    } catch {
      // Mixpanel optional
    }
  } catch (e) {
    console.warn('trackLifecycleEvent error:', eventName, e);
  }
}
