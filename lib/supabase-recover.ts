/**
 * Pull-to-refresh recovery.
 *
 * A force-quit works because it throws away the in-memory Supabase client:
 * dead sockets and the auth lock go with it. Saved data stays. Pull-to-refresh
 * does the same reset, then one session check, then the screen refetch.
 */

import { queryClient } from '@/contexts/QueryClientProvider';
import { isFinancialMutationActive } from '@/lib/financial-mutation-gate';
import { dropBadgeSyncInFlight } from '@/lib/badge-sync';
import {
  abandonInFlightEnsure,
  resetSupabaseConnectionEnsureState,
} from '@/lib/supabase-connection';
import { abortAllSupabaseFetches } from '@/lib/supabase-http';
import { dropInFlightWalletFetch } from '@/lib/queries/walletQueries';
import { abortInFlightAuthRefresh } from '@/lib/supabase-reconnect';
import { dropInFlightSession, getSessionSerialized } from '@/lib/supabase-session';
import { supabase } from '@/lib/supabase';

const SESSION_CHECK_MS = 5000;

export async function recoverPullToRefresh(): Promise<void> {
  // A payout create is already using the connection. Leave it alone.
  if (isFinancialMutationActive()) return;

  abortInFlightAuthRefresh();
  abortAllSupabaseFetches();
  dropInFlightSession();
  dropInFlightWalletFetch();
  dropBadgeSyncInFlight();
  abandonInFlightEnsure();
  resetSupabaseConnectionEnsureState();

  try {
    await queryClient.cancelQueries();
  } catch {
    // ignore
  }

  try {
    supabase.auth.stopAutoRefresh?.();
    supabase.auth.startAutoRefresh?.();
  } catch {
    // ignore
  }

  // Let aborted calls release the auth lock before the next session read.
  await new Promise((resolve) => setTimeout(resolve, 0));

  try {
    await getSessionSerialized({ bypassCache: true, timeoutMs: SESSION_CHECK_MS });
  } catch {
    // The screen refetch still runs. Cached rows stay on screen.
  }
}
