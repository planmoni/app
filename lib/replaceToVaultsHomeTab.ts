import { router } from 'expo-router';

/**
 * Land on the main tabs (Home) with the Vaults sub-tab selected.
 * Use `/(tabs)` only — `/(tabs)/index` is not used elsewhere and can resolve to a blank screen in this app.
 */
export function replaceToVaultsHomeTab() {
  router.replace({
    pathname: '/(tabs)',
    params: { balanceTab: 'plans' },
  });
}
