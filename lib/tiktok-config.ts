/**
 * TikTok Business SDK configuration.
 * Override via env: EXPO_PUBLIC_TIKTOK_APP_ID, EXPO_PUBLIC_TIKTOK_APP_SECRET
 *
 * For events to show in TikTok Events Manager > Event activity (Test events tab):
 * 1. In TikTok Ads Manager go to Assets > Events > [your pixel] > Test events tab.
 * 2. Copy the test event code (e.g. TEST93891).
 * 3. Set it in ios/Planmoni/Info.plist as TIKTOK_TEST_EVENT_CODE.
 * 4. Rebuild the app and trigger events (e.g. register, create plan).
 * 5. Remove or clear TIKTOK_TEST_EVENT_CODE before production.
 */

export const TIKTOK_APP_ID =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_TIKTOK_APP_ID) ||
  '616288647079362578';

export const TIKTOK_APP_SECRET =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_TIKTOK_APP_SECRET) ||
  'TTbaqvHq3nRe7Fj7j7bouBDp8Dhv4Q3p';
