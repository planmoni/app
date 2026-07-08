import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { ProfileSnapshotManager } from '@/lib/profileSnapshot';

const EXPIRED_SESSION_RECOVERY_KEY = 'expired_session_recovery';

export type ExpiredSessionRecovery = {
  userId: string;
  email: string;
  firstName: string;
  reason: 'session_expired';
  createdAt: string;
};

function toRecoveryPayload(
  userId: string,
  email?: string | null,
  firstName?: string | null
): ExpiredSessionRecovery | null {
  if (!userId || !email) return null;

  return {
    userId,
    email: email.trim().toLowerCase(),
    firstName: firstName?.trim() || 'there',
    reason: 'session_expired',
    createdAt: new Date().toISOString(),
  };
}

export async function buildExpiredSessionRecovery(
  session: Session | null
): Promise<ExpiredSessionRecovery | null> {
  const userId = session?.user?.id;
  if (!userId) return null;

  const metadata = await ProfileSnapshotManager.loadMetadataSnapshot(userId);
  const profile = await ProfileSnapshotManager.loadProfileSnapshot(userId);

  const email =
    session?.user?.email ||
    metadata?.email ||
    profile?.email ||
    null;

  const firstName =
    session?.user?.user_metadata?.first_name ||
    metadata?.first_name ||
    profile?.first_name ||
    null;

  return toRecoveryPayload(userId, email, firstName);
}

export async function saveExpiredSessionRecovery(
  payload: ExpiredSessionRecovery
): Promise<void> {
  await AsyncStorage.setItem(EXPIRED_SESSION_RECOVERY_KEY, JSON.stringify(payload));
}

export async function loadExpiredSessionRecovery(): Promise<ExpiredSessionRecovery | null> {
  try {
    const raw = await AsyncStorage.getItem(EXPIRED_SESSION_RECOVERY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExpiredSessionRecovery;
  } catch (error) {
    console.error('Failed to load expired session recovery payload:', error);
    return null;
  }
}

export async function clearExpiredSessionRecovery(): Promise<void> {
  await AsyncStorage.removeItem(EXPIRED_SESSION_RECOVERY_KEY);
}
