import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vault_setup_draft_v1';

export type VaultSetupDraft = {
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

function hasStartedVaultSetup(pathname: string, params: Record<string, string>): boolean {
  if (!pathname.startsWith('/create-vault')) return false;
  if (
    pathname.includes('/success') ||
    pathname.includes('/fund-plan') ||
    pathname.includes('/fund-amount')
  ) {
    return false;
  }
  if (pathname.includes('/plan-details') && !params.planId && !params.subCategories) {
    return false;
  }
  return true;
}

export async function saveVaultSetupDraft(
  pathname: string,
  params: Record<string, string | string[] | undefined | null>
): Promise<void> {
  const normalized = normalizeParams(params);
  if (!hasStartedVaultSetup(pathname, normalized)) return;

  const draft: VaultSetupDraft = {
    pathname,
    params: normalized,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function loadVaultSetupDraft(): Promise<VaultSetupDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultSetupDraft;
    if (!parsed?.pathname || !hasStartedVaultSetup(parsed.pathname, parsed.params || {})) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearVaultSetupDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
