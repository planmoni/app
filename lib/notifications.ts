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
  } catch (error) {
    console.error("❌ Error getting FCM token:", error);
    await logAnalyticsEvent("fcm_token_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
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
}

/**
 * Handle incoming FCM messages
 */
export async function handleFCMMessage(message: any): Promise<void> {
  try {
    console.log("📱 FCM Message received:", message);

    // Log analytics event
    await logAnalyticsEvent("fcm_message_received", {
      messageId: message.messageId,
      from: message.from,
    });

  // Try to get push token (optional - only for remote push)
  return await getPushTokenAsync();
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(): void {
  try {
    // Listen for FCM messages when app is in foreground
    messaging().onMessage(handleFCMMessage);

    // Handle FCM messages when app is in background/killed state
    messaging().setBackgroundMessageHandler(handleFCMMessage);

    // Handle notification when app is opened from a notification
    messaging().onNotificationOpenedApp(async (remoteMessage: any) => {
      try {
        console.log("🔔 App opened from notification:", remoteMessage);
        await logAnalyticsEvent("notification_opened_app", {
          messageId: remoteMessage.messageId,
          notificationType: remoteMessage.data?.type,
        });
        router.push("/notifications");
        console.log("✅ Navigated to notifications screen from opened app");
      } catch (error) {
        console.error("❌ Error handling notification open app:", error);
      }
    });

    // Check if app was opened from a notification when it was completely closed
    messaging()
      .getInitialNotification()
      .then(async (remoteMessage: any) => {
        if (remoteMessage) {
          try {
            console.log(
              "🔔 App opened from notification (cold start):",
              remoteMessage
            );
            await logAnalyticsEvent("notification_opened_cold_start", {
              messageId: remoteMessage.messageId,
              notificationType: remoteMessage.data?.type,
            });
            router.push("/notifications");
            console.log("✅ Navigated to notifications screen from cold start");
          } catch (error) {
            console.error("❌ Error handling notification cold start:", error);
          }
        }
      });

    // Listen for notification actions and main notification press
    notifee.onForegroundEvent(async ({ type, detail }: { type: any; detail: any }) => {
      if (type === EventType.ACTION_PRESS) {
        await handleNotificationAction(detail);
      } else if (type === EventType.PRESS) {
        // Handle main notification tap - route to notifications screen
        try {
          console.log("🔔 Main notification pressed");
          await logAnalyticsEvent("notification_pressed", {
            notificationType: detail.notification?.data?.type,
          });
          router.push("/notifications");
          console.log(
            "✅ Navigated to notifications screen from main notification press"
          );
        } catch (error) {
          console.error("❌ Error handling main notification press:", error);
        }
      }
    });

    // Handle notification actions and main notification press when app is killed
    notifee.onBackgroundEvent(async ({ type, detail }: { type: any; detail: any }) => {
      if (type === EventType.ACTION_PRESS) {
        await handleNotificationAction(detail);
      } else if (type === EventType.PRESS) {
        // Handle main notification tap - route to notifications screen
        try {
          console.log("🔔 Main notification pressed (background)");
          await logAnalyticsEvent("notification_pressed_background", {
            notificationType: detail.notification?.data?.type,
          });
          router.push("/notifications");
          console.log(
            "✅ Navigated to notifications screen from background notification press"
          );
        } catch (error) {
          console.error(
            "❌ Error handling background notification press:",
            error
          );
        }
      }
    });

    // Listen for token refresh
    messaging().onTokenRefresh(async (token: string) => {
      console.log("🔄 FCM Token refreshed:", token.substring(0, 20) + "...");
      await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, token);
      await storeFCMTokenInSupabase(token);
      await logAnalyticsEvent("fcm_token_refreshed");
    });

    console.log("✅ Notification listeners setup successfully");
  } catch (error) {
    console.error("❌ Error setting up notification listeners:", error);
  }
}

/**
 * Initialize the complete notification system
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    console.log("🚀 Initializing notification system...");

    // Create notification channels (Android)
    await createNotificationChannels();

    // Request permissions
    const permissionGranted = await requestNotificationPermissions();

    if (!permissionGranted) {
      console.log(
        "⚠️ Notification permissions not granted, skipping FCM setup"
      );
      return false;
    }

    // Get FCM token
    const token = await getFCMToken();

    if (!token) {
      console.log("⚠️ FCM token not obtained, notification setup incomplete");
      return false;
    }

    // Setup listeners
    setupNotificationListeners();

    console.log("✅ Notification system initialized successfully");
    await logAnalyticsEvent("notification_system_initialized");

    return true;
  } catch (error) {
    console.error("❌ Error initializing notification system:", error);
    await logAnalyticsEvent("notification_system_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();
    return settings.authorizationStatus >= 1; // 1 = AUTHORIZED, 2 = PROVISIONAL
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