import { supabase } from './supabase';
import { createRoutePersistence } from './route-persistence';
import { isAppLockEnabled } from './app-lock';
import { createUserScopedStorage } from './user-scoped-storage';

export interface SessionRestorationResult {
  hasValidSession: boolean;
  lastRoute: string | null;
  shouldShowAppLock: boolean;
  user: any;
}

/**
 * Restore user session and determine initial app state
 */
export async function restoreSession(): Promise<SessionRestorationResult> {
  try {
    // Get current session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('[SessionRestoration] Error getting session:', error);
      return {
        hasValidSession: false,
        lastRoute: null,
        shouldShowAppLock: false,
        user: null
      };
    }

    if (!session?.user) {
      return {
        hasValidSession: false,
        lastRoute: null,
        shouldShowAppLock: false,
        user: null
      };
    }

    // Get last route for this user
    const routePersistence = createRoutePersistence(session.user.id);
    const lastRoute = await routePersistence.getLastRoute();

    // Check if app lock should be shown
    const userStorage = createUserScopedStorage(session.user.id);
    const appLockEnabled = await isAppLockEnabled(session.user.id);
    const hasAppLockPin = await userStorage.getItem('app_lock_pin') !== null;

    return {
      hasValidSession: true,
      lastRoute,
      shouldShowAppLock: appLockEnabled && hasAppLockPin,
      user: session.user
    };

  } catch (error) {
    console.error('[SessionRestoration] Failed to restore session:', error);
    return {
      hasValidSession: false,
      lastRoute: null,
      shouldShowAppLock: false,
      user: null
    };
  }
}

/**
 * Check if a route is valid for restoration
 */
export function isValidRouteForRestoration(route: string | null): boolean {
  if (!route) return false;
  
  // Don't restore to auth pages
  const authRoutes = ['/(auth)', '/login', '/onboarding'];
  if (authRoutes.some(authRoute => route.startsWith(authRoute))) {
    return false;
  }
  
  // Don't restore to error pages
  const errorRoutes = ['/+not-found', '/error'];
  if (errorRoutes.some(errorRoute => route.startsWith(errorRoute))) {
    return false;
  }
  
  return true;
} 