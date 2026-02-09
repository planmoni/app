import { Platform } from 'react-native';

const APP_GROUP_ID = 'group.app.planmoni.widget';
const NEXT_PAYOUT_KEY = 'nextPayout';

export type NextPayoutWidgetPayload = {
  planId: string;
  planName: string;
  nextPayoutDate: string;
  payoutAmount: number;
  planStatus?: string;
} | null;

/**
 * Writes the current "Up Next" payout to App Group storage and reloads the iOS widget.
 * Only runs on iOS; no-op on other platforms.
 */
export function updateNextPayoutWidget(nextPayout: NextPayoutWidgetPayload): void {
  if (Platform.OS !== 'ios') return;

  try {
    const { ExtensionStorage } = require('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP_ID);

    if (!nextPayout) {
      storage.set(NEXT_PAYOUT_KEY, JSON.stringify({ planName: '', nextPayoutDate: '', payoutAmount: 0 }));
    } else {
      storage.set(
        NEXT_PAYOUT_KEY,
        JSON.stringify({
          planId: nextPayout.planId,
          planName: nextPayout.planName,
          nextPayoutDate: nextPayout.nextPayoutDate,
          payoutAmount: nextPayout.payoutAmount,
          planStatus: nextPayout.planStatus,
        })
      );
    }
    ExtensionStorage.reloadWidget();
  } catch (_) {
    // ExtensionStorage may be unavailable (e.g. in Expo Go or web)
  }
}
