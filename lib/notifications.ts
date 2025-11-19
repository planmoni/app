import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler for foreground notifications
// Note: This will be overridden by in-app-notifications.ts if both are imported
// The handler in in-app-notifications.ts takes precedence
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request notification permissions (required for both local and push notifications)
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    console.log('Must use a physical device for notifications');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  // Set up Android notification channels (required for local notifications on Android)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }

  return true;
}

// Get FCM push token (optional - only needed for remote push notifications)
// Local notifications work perfectly without this
export async function getPushTokenAsync(): Promise<string | null> {
  try {
    // First ensure we have permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('⚠️ Cannot get push token: permissions not granted');
      return null;
    }

    // Try to get push token (requires FCM to be configured)
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;
    console.log('✅ Push token obtained successfully:', token?.substring(0, 20) + '...');
    return token;
  } catch (error: any) {
    // If Firebase isn't initialized, that's okay - local notifications still work
    if (error?.message?.includes('FirebaseApp') || error?.message?.includes('FCM')) {
      console.log('ℹ️ FCM not configured. Local notifications will still work.');
      console.log('To enable remote push notifications, configure FCM: https://docs.expo.dev/push-notifications/fcm-credentials/');
      return null;
    }
    // Log other errors
    console.error("❌ Error getting push token:", error);
    // Don't re-throw - return null so local notifications can still work
    return null;
  }
}

// Backward compatibility: Export old function name as alias
// This function requests permissions and optionally gets push token
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Request permissions first (required for both local and push)
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return null;
  }
  // Get push token
  return await getPushTokenAsync();
}

// Save push token to database
async function savePushTokenToDatabase(expoPushToken: string, userId: string): Promise<void> {
  try {
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      model: Device.modelName,
    };

    const { error } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          device_info: deviceInfo,
          is_active: true,
          last_used: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,expo_push_token',
        }
      );

    if (error) {
      console.error('Error saving push token to database:', error);
    } else {
      console.log('Push token saved to database successfully');
    }

    // Also store/update the token in user_fcm_tokens so server-side push function can find it
    const platform =
      Platform.OS === 'ios'
        ? 'ios'
        : Platform.OS === 'android'
        ? 'android'
        : 'web';

    const { error: fcmError } = await supabase
      .from('user_fcm_tokens')
      .upsert(
        {
          user_id: userId,
          fcm_token: expoPushToken,
          platform,
        },
        {
          onConflict: 'user_id,platform',
        }
      );

    if (fcmError) {
      console.error('Error saving token to user_fcm_tokens:', fcmError);
    } else {
      console.log('Push token synced to user_fcm_tokens');
    }
  } catch (error) {
    console.error('Error in savePushTokenToDatabase:', error);
  }
}

/**
 * Setup notification listeners using expo-notifications
 * Returns a cleanup function to remove listeners
 */
export function setupNotificationListeners(): (() => void) | null {
  try {
    // Note: expo-notifications listeners are typically set up in NotificationContext
    // This function is kept for compatibility but the actual listeners
    // should be set up using expo-notifications in the app context
    console.log("✅ Notification listeners setup (handled by NotificationContext)");
    return () => {
      // Cleanup function - listeners are managed by NotificationContext
      console.log("Notification listeners cleanup");
    };
  } catch (error) {
    console.error("❌ Error setting up notification listeners:", error);
    return null;
  }
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error("❌ Error checking notification permissions:", error);
    return false;
  }
}

// Initialize notifications
// This sets up local notifications (which work on Android without FCM)
// Push token registration is optional and only needed for remote push notifications
export async function initializeNotifications(userId: string) {
  try {
    // Request permissions and set up Android channels
    // This is required for local notifications to work
    const hasPermission = await requestNotificationPermissions();
    
    if (!hasPermission) {
      console.warn('Notification permissions not granted. Local notifications may not work.');
      return null;
    }

    // Set up listeners for local notifications (works without FCM)
    const cleanup = setupNotificationListeners();

    // Try to get push token (optional - only for remote push notifications)
    // This will fail gracefully if FCM isn't configured, but local notifications still work
    try {
      const token = await getPushTokenAsync();
      if (token) {
        console.log('Push token obtained:', token);
        await savePushTokenToDatabase(token, userId);
      } else {
        console.log('Local notifications ready. Push notifications require FCM configuration.');
      }
    } catch (error: any) {
      // Push token failure is not critical - local notifications still work
      console.log('Push token not available (local notifications still work):', error?.message);
    }

    console.log('Notifications initialized successfully (local notifications ready)');
    return cleanup;
  } catch (error: any) {
    console.error('Error initializing notifications:', error);
    return null;
  }
} 