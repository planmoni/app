import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'payout_setup_draft_v1';

export type PayoutSetupDraft = {
  pathname: string;
  params: Record<string, string>;
  updatedAt: number;
};

function normalizeParams(
  params: Record<string, string | string[] | undefined | null>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    const next = Array.isArray(value) ? value[0] : value;
    if (next == null || next === '') continue;
    normalized[key] = String(next);
  }
  return normalized;
}

export async function savePayoutSetupDraft(
  pathname: string,
  params: Record<string, string | string[] | undefined | null>
): Promise<void> {
  if (!pathname.startsWith('/create-payout') || pathname.includes('/success')) return;
  const normalized = normalizeParams(params);
  if (!normalized.totalAmount) return;

  const draft: PayoutSetupDraft = {
    pathname,
    params: normalized,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function loadPayoutSetupDraft(): Promise<PayoutSetupDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PayoutSetupDraft;
    if (!parsed?.pathname || !parsed.params?.totalAmount) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPayoutSetupDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
