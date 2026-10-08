import { router } from 'expo-router';

/** Close a root modal (KYC, and similar sheets) back onto the existing Home tab. */
export function dismissToHomeTab() {
  if (router.canDismiss()) {
    router.dismissTo('/(tabs)');
    return;
  }
  router.replace('/(tabs)');
}
