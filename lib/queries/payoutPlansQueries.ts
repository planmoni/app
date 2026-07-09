import { supabase } from '@/lib/supabase';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import type { PayoutPlan } from '@/hooks/useRealtimePayoutPlans';

const select = `
  *,
  bank_accounts (
    bank_name,
    account_number,
    account_name
  ),
  payout_accounts (
    bank_name,
    account_number,
    account_name
  )
`;

export async function readPayoutPlansCache(userId: string): Promise<PayoutPlan[] | null> {
  const cached = await readCache<PayoutPlan[]>(CACHE_KEYS.payoutPlans(userId));
  return Array.isArray(cached) ? cached : null;
}

export async function fetchPayoutPlans(userId: string): Promise<PayoutPlan[]> {
  const [ownedResult, pairingResult] = (await Promise.all([
    fetchWithRetry(
      () =>
        supabase
          .from('payout_plans')
          .select(select)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      'Payout plans'
    ),
    fetchWithRetry(
      () =>
        supabase
          .from('payout_plan_pairings')
          .select('payout_plan_id')
          .eq('paired_user_id', userId),
      'Payout plan pairings'
    ),
  ])) as [
    { data: any[] | null; error: any },
    { data: { payout_plan_id: string }[] | null; error: any },
  ];

  const { data: ownedData, error: ownedError } = ownedResult;
  const { data: pairingRows, error: pairingError } = pairingResult;

  if (ownedError) throw ownedError;

  const owned: PayoutPlan[] = (ownedData || []).map((p: any) => ({ ...p, is_paired: false }));

  if (pairingError) {
    void writeCache(CACHE_KEYS.payoutPlans(userId), owned);
    return owned;
  }

  const pairedIds = (pairingRows || [])
    .map((r: { payout_plan_id: string }) => r.payout_plan_id)
    .filter(Boolean);

  if (pairedIds.length === 0) {
    void writeCache(CACHE_KEYS.payoutPlans(userId), owned);
    return owned;
  }

  const { data: pairedData, error: pairedError } = (await fetchWithRetry(
    () =>
      supabase
        .from('payout_plans')
        .select(select)
        .in('id', pairedIds)
        .order('created_at', { ascending: false }),
    'Paired payout plans'
  )) as { data: any[] | null; error: any };

  if (pairedError) {
    void writeCache(CACHE_KEYS.payoutPlans(userId), owned);
    return owned;
  }

  const paired: PayoutPlan[] = (pairedData || []).map((p: any) => ({ ...p, is_paired: true }));
  const merged = [...owned];
  for (const p of paired) {
    if (!merged.some((m) => m.id === p.id)) merged.push(p);
  }
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  void writeCache(CACHE_KEYS.payoutPlans(userId), merged);
  return merged;
}
