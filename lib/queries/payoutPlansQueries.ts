import { supabase } from '@/lib/supabase';
import { fetchWithRetry, CACHE_KEYS, readCache, writeCache } from '@/lib/supabase-fetch';
import { PAGE_SIZE } from '@/lib/queries/keys';
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

async function fetchPairedPlans(userId: string): Promise<PayoutPlan[]> {
  const { data: pairingRows, error: pairingError } = (await fetchWithRetry(
    () =>
      supabase
        .from('payout_plan_pairings')
        .select('payout_plan_id')
        .eq('paired_user_id', userId),
    'Payout plan pairings'
  )) as { data: { payout_plan_id: string }[] | null; error: any };

  if (pairingError || !pairingRows?.length) return [];

  const pairedIds = pairingRows.map((r) => r.payout_plan_id).filter(Boolean);
  if (pairedIds.length === 0) return [];

  const { data: pairedData, error: pairedError } = (await fetchWithRetry(
    () =>
      supabase
        .from('payout_plans')
        .select(select)
        .in('id', pairedIds)
        .order('created_at', { ascending: false }),
    'Paired payout plans'
  )) as { data: any[] | null; error: any };

  if (pairedError) return [];
  return (pairedData || []).map((p: any) => ({ ...p, is_paired: true }));
}

/**
 * Bounded payout plans for home / calendar / insights.
 * Paired plans are always included (usually few).
 */
export async function fetchPayoutPlans(
  userId: string,
  limit: number = PAGE_SIZE.payoutPlans
): Promise<PayoutPlan[]> {
  const [ownedResult, paired] = await Promise.all([
    fetchWithRetry(
      () =>
        supabase
          .from('payout_plans')
          .select(select)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit),
      'Payout plans'
    ) as Promise<{ data: any[] | null; error: any }>,
    fetchPairedPlans(userId),
  ]);

  if (ownedResult.error) throw ownedResult.error;

  const owned: PayoutPlan[] = (ownedResult.data || []).map((p: any) => ({ ...p, is_paired: false }));
  const merged = [...owned];
  for (const p of paired) {
    if (!merged.some((m) => m.id === p.id)) merged.push(p);
  }
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  void writeCache(CACHE_KEYS.payoutPlans(userId), merged);
  return merged;
}

/** Paginated owned plans for All Payouts screen. Paired plans only on page 0. */
export async function fetchPayoutPlansPage(
  userId: string,
  pageParam = 0,
  pageSize = PAGE_SIZE.payoutPlans
): Promise<{ items: PayoutPlan[]; nextPage: number | undefined }> {
  const from = pageParam * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = (await fetchWithRetry(
    () =>
      supabase
        .from('payout_plans')
        .select(select)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to),
    'Payout plans page'
  )) as { data: any[] | null; error: any };

  if (error) throw error;

  let items: PayoutPlan[] = (data || []).map((p: any) => ({ ...p, is_paired: false }));

  if (pageParam === 0) {
    const paired = await fetchPairedPlans(userId);
    for (const p of paired) {
      if (!items.some((m) => m.id === p.id)) items.push(p);
    }
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    void writeCache(CACHE_KEYS.payoutPlans(userId), items);
  }

  const ownedCount = (data || []).length;
  return {
    items,
    nextPage: ownedCount === pageSize ? pageParam + 1 : undefined,
  };
}
