import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@/contexts/QueryClientProvider';
import { CACHE_KEYS } from '@/lib/supabase-fetch';
import { clearSession } from '@/lib/session-persistence';
import { ProfileSnapshotManager } from '@/lib/profileSnapshot';
import { secureStoreAdapter } from '@/lib/SecureStoreAdapter';
import { clearSessionCache } from '@/lib/supabase-session';

function userCacheKeys(userId: string): string[] {
  return [
    CACHE_KEYS.wallet(userId),
    CACHE_KEYS.payoutPlans(userId),
    CACHE_KEYS.transactions(userId),
    CACHE_KEYS.calendarEvents(userId),
    CACHE_KEYS.kycProgress(userId),
    CACHE_KEYS.insights(userId),
    CACHE_KEYS.safehavenAccount(userId),
    CACHE_KEYS.pendingProfile(userId),
    CACHE_KEYS.kycData(userId),
    CACHE_KEYS.hasPayoutPlan(userId),
    CACHE_KEYS.expensePlans(userId),
    CACHE_KEYS.payoutAccounts(userId),
    CACHE_KEYS.bankAccounts(userId),
  ];
}

export async function clearExpiredAuthState(userId?: string | null): Promise<void> {
  try {
    queryClient.clear();
  } catch (error) {
    console.warn('Failed to clear React Query cache:', error);
  }

  secureStoreAdapter.clearCache();
  clearSessionCache();

  try {
    await clearSession();
  } catch (error) {
    console.warn('Failed to clear persisted auth session:', error);
  }

  if (userId) {
    try {
      await AsyncStorage.multiRemove(userCacheKeys(userId));
    } catch (error) {
      console.warn('Failed to clear user cache keys:', error);
    }

    try {
      await ProfileSnapshotManager.clearProfileSnapshot(userId);
    } catch (error) {
      console.warn('Failed to clear profile snapshots:', error);
    }
  }
}

/** Clear persisted financial caches on sign-out (in-memory RQ cleared separately). */
export async function clearUserCachesOnSignOut(userId?: string | null): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.multiRemove(userCacheKeys(userId));
  } catch (error) {
    console.warn('Failed to clear user cache keys on sign-out:', error);
  }
}

export async function resetStateAfterReauth(): Promise<void> {
  try {
    queryClient.clear();
  } catch (error) {
    console.warn('Failed to clear React Query cache after reauth:', error);
  }

  secureStoreAdapter.clearCache();
  clearSessionCache();
}
