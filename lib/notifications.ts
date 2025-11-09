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
      return null;
    }

    // Try to get push token (requires FCM to be configured)
    const token = (await Notifications.getDevicePushTokenAsync()).data;
    console.log('Push token obtained successfully');
    return token;
  } catch (error: any) {
    // If Firebase isn't initialized, that's okay - local notifications still work
    if (error?.message?.includes('FirebaseApp') || error?.message?.includes('FCM')) {
      console.log('FCM not configured. Local notifications will still work.');
      console.log('To enable remote push notifications, configure FCM: https://docs.expo.dev/push-notifications/fcm-credentials/');
      return null;
    }
    // Re-throw other errors
    throw error;
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

  // Try to get push token (optional - only for remote push)
  return await getPushTokenAsync();
}

// Store FCM token in Supabase
export async function storeFCMToken(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('user_fcm_tokens')
      .upsert({
        user_id: userId,
        fcm_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      });

    if (error) {
      console.error('Error storing FCM token:', error);
      return false;
    }

    console.log('FCM token stored successfully');
    return true;
  } catch (error) {
    console.error('Error in storeFCMToken:', error);
    return false;
  }
}

// Setup notification listeners
export function setupNotificationListeners() {
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received in foreground:', notification);
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
    const { data } = response.notification.request.content;
    
    if (data?.type === 'deposit_successful') {
      console.log('Navigate to wallet screen');
    }
  });

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
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
        console.log('FCM Token obtained:', token);
        await storeFCMToken(userId, token);
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