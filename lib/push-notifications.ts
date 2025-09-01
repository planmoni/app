import { getFCMToken, onForegroundMessage } from './firebase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PushNotificationSettings {
  enabled: boolean;
  deposit_alerts: boolean;
  payout_alerts: boolean;
  security_alerts: boolean;
  marketing_alerts: boolean;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmToken: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get FCM token
      this.fcmToken = await getFCMToken();
      
      if (this.fcmToken) {
        // Store FCM token in database
        await this.storeFCMToken(userId, this.fcmToken);
        console.log('FCM token stored successfully');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  private async storeFCMToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_fcm_tokens')
        .upsert({
          user_id: userId,
          fcm_token: token,
          platform: 'web', // or 'ios', 'android' based on platform
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error storing FCM token:', error);
      }
    } catch (error) {
      console.error('Error in storeFCMToken:', error);
    }
  }

  async updateNotificationSettings(userId: string, settings: PushNotificationSettings): Promise<void> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          push_notifications: settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating push notification settings:', error);
      }
    } catch (error) {
      console.error('Error in updateNotificationSettings:', error);
    }
  }

  async getNotificationSettings(userId: string): Promise<PushNotificationSettings | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('push_notifications')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error getting push notification settings:', error);
        return null;
      }

      return data?.push_notifications || {
        enabled: true,
        deposit_alerts: true,
        payout_alerts: true,
        security_alerts: true,
        marketing_alerts: false
      };
    } catch (error) {
      console.error('Error in getNotificationSettings:', error);
      return null;
    }
  }

  onForegroundMessage(callback: (payload: any) => void): () => void {
    return onForegroundMessage(callback);
  }

  async refreshToken(userId: string): Promise<void> {
    try {
      this.fcmToken = await getFCMToken();
      if (this.fcmToken) {
        await this.storeFCMToken(userId, this.fcmToken);
      }
    } catch (error) {
      console.error('Error refreshing FCM token:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance(); 