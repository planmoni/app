/**
 * TikTok Business SDK – event tracking and identify from JS.
 * iOS: uses native TikTokTracking module. Android / web: no-op.
 */

import { NativeModules, Platform } from 'react-native';

const { TikTokTracking } = NativeModules;

export type TikTokEventName =
  | 'Registration'
  | 'LoanApplication'
  | 'LoanApproval'
  | 'LoanDisbursal'
  | string;

export interface TikTokIdentifyParams {
  externalId?: string;
  externalUserName?: string;
  phoneNumber?: string;
  email?: string;
}

/**
 * Track a TikTok app event. Use standard names for recommended events.
 */
export function trackTikTokEvent(eventName: TikTokEventName): void {
  if (Platform.OS !== 'ios' || !TikTokTracking?.trackEvent) {
    if (__DEV__) console.log('[TikTok] trackEvent (no-op):', eventName);
    return;
  }
  try {
    TikTokTracking.trackEvent(eventName);
    if (__DEV__) console.log('[TikTok] trackEvent:', eventName);
  } catch (e) {
    if (__DEV__) console.warn('[TikTok] trackEvent error:', e);
  }
}

/**
 * Identify the user to TikTok (e.g. after login).
 */
export function identifyTikTokUser(params: TikTokIdentifyParams): void {
  if (Platform.OS !== 'ios' || !TikTokTracking?.identify) {
    if (__DEV__) console.log('[TikTok] identify (no-op)');
    return;
  }
  try {
    TikTokTracking.identify(
      params.externalId ?? '',
      params.externalUserName ?? '',
      params.phoneNumber ?? '',
      params.email ?? ''
    );
    if (__DEV__) console.log('[TikTok] identify:', params.externalId);
  } catch (e) {
    if (__DEV__) console.warn('[TikTok] identify error:', e);
  }
}
