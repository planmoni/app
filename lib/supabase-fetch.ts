import AsyncStorage from '@react-native-async-storage/async-storage';
import { withRetryOnTimeout } from '@/lib/with-timeout';
import { ensureSupabaseConnection } from '@/lib/supabase-connection';

export const FETCH_TIMEOUT_MS = 15000;
export const DEFAULT_RETRY_DELAY_MS = 2000;
export const WARM_CONNECTION_MS = 1500;

export const CACHE_KEYS = {
  wallet: (userId: string) => `cache_wallet_${userId}`,
  payoutPlans: (userId: string) => `cache_payout_plans_${userId}`,
  transactions: (userId: string) => `cache_transactions_${userId}`,
  calendarEvents: (userId: string) => `cache_calendar_events_${userId}`,
  kycProgress: (userId: string) => `cache_kyc_progress_${userId}`,
  insights: (userId: string) => `cache_insights_${userId}`,
  safehavenAccount: (userId: string) => `cache_safehaven_account_${userId}`,
  pendingProfile: (userId: string) => `cache_pending_profile_${userId}`,
  kycData: (userId: string) => `cache_kyc_data_${userId}`,
  hasPayoutPlan: (userId: string) => `cache_has_payout_plan_${userId}`,
  expensePlans: (userId: string) => `cache_expense_plans_${userId}`,
  payoutAccounts: (userId: string) => `cache_payout_accounts_${userId}`,
  bankAccounts: (userId: string) => `cache_bank_accounts_${userId}`,
} as const;

export type FetchWithRetryOptions = {
  timeoutMs?: number;
  retryDelayMs?: number;
  label?: string;
};

export async function fetchWithRetry<T>(
  factory: () => Promise<T>,
  label = 'Request',
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  return withRetryOnTimeout(factory, timeoutMs, label, retryDelayMs);
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Non-fatal
  }
}

export async function warmConnection() {
  return ensureSupabaseConnection();
}

export { ensureSupabaseConnection } from '@/lib/supabase-connection';
export { getSupabaseConnectionStatus } from '@/lib/supabase-connection';

const FRIENDLY_REFRESH_ERROR = "Couldn't refresh. Showing saved data.";

export function toUserFacingError(err: unknown, hasCache = false): string {
  if (hasCache) {
    return FRIENDLY_REFRESH_ERROR;
  }

  const message = err instanceof Error ? err.message : String(err ?? '');
  const lower = message.toLowerCase();

  if (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch')
  ) {
    return "Couldn't load data. Check your connection and try again.";
  }

  return message || "Couldn't load data. Please try again.";
}

export function isTimeoutError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return message.toLowerCase().includes('timed out') || message.toLowerCase().includes('timeout');
}
