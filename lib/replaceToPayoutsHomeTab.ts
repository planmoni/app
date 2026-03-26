import { router } from 'expo-router';

/**
 * Land on the main tabs (Home) with the Payouts sub-tab selected.
 * Use `/(tabs)` only — same routing contract as {@link replaceToVaultsHomeTab}.
 */
export function replaceToPayoutsHomeTab() {
  router.replace({
    pathname: '/(tabs)',
    params: { balanceTab: 'payouts' },
  });
}
