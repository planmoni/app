/**
 * AppsFlyer SDK initialization and helpers.
 * See: https://dev.appsflyer.com/hc/docs/rn_installation
 */

import { Platform } from 'react-native';

const APPSFLYER_DEV_KEY = 'DABqeACmmj9KgnxWSo4EzH';

let isInitialized = false;

/**
 * Initialize the AppsFlyer SDK. Call once at app startup (e.g. in root _layout).
 * Android: native init is in MainApplication.kt; we also init from JS here for RN plugin features.
 * iOS: skipped here until the native module is linked (pod install); otherwise NativeEventEmitter throws.
 */
export async function initAppsFlyer(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Platform.OS !== 'android') return; // Only init from JS on Android; iOS requires pod install first
  if (isInitialized) return;

  try {
    const appsFlyer = require('react-native-appsflyer').default;
    appsFlyer.initSdk(
      {
        devKey: APPSFLYER_DEV_KEY,
        isDebug: __DEV__,
        onInstallConversionDataListener: true,
        onDeepLinkListener: true,
      },
      () => {
        isInitialized = true;
        if (__DEV__) console.log('[AppsFlyer] SDK initialized');
      },
      (err: unknown) => {
        console.warn('[AppsFlyer] init failed:', err);
      }
    );
  } catch (e) {
    console.warn('[AppsFlyer] require/init error:', e);
  }
}
