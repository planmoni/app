import { router } from 'expo-router';

/**
 * Land on the main tabs (Home) with the Payouts sub-tab selected.
 * Use `/(tabs)` only — same routing contract as {@link replaceToVaultsHomeTab}.
 */
export function replaceToPayoutsHomeTab() {
  const target = {
    pathname: '/(tabs)' as const,
    params: { balanceTab: 'payouts' },
  };
  if (router.canDismiss()) {
    router.dismissTo(target);
    return;
  }
  router.replace(target);
}
