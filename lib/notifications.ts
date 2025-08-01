import messaging from "@react-native-firebase/messaging";
import notifee, { AndroidImportance, EventType } from "@notifee/react-native";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { logAnalyticsEvent } from "./firebase";

const STORAGE_KEYS = {
  FCM_TOKEN: "fcm_token",
  NOTIFICATION_PERMISSIONS: "notification_permissions",
};

// Notification types for the app
export enum NotificationType {
  PAYOUT_READY = "payout_ready",
  PAYOUT_FAILED = "payout_failed",
  DEPOSIT_RECEIVED = "deposit_received",
  SECURITY_ALERT = "security_alert",
  GENERAL = "general",
}

// Notification channel IDs for Android
export const NOTIFICATION_CHANNELS = {
  PAYOUTS: "payouts",
  DEPOSITS: "deposits",
  SECURITY: "security",
  GENERAL: "general",
} as const;

/**
 * Create notification channels for Android
 */
async function createNotificationChannels() {
  if (Platform.OS === "android") {
    try {
      // Payouts channel
      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.PAYOUTS,
        name: "Payouts",
        description: "Notifications about your scheduled payouts",
        importance: AndroidImportance.HIGH,
        sound: "default",
        vibration: true,
      });

      // Deposits channel
      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.DEPOSITS,
        name: "Deposits",
        description: "Notifications about fund deposits",
        importance: AndroidImportance.HIGH,
        sound: "default",
        vibration: true,
      });

      // Security channel
      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.SECURITY,
        name: "Security",
        description: "Important security alerts and notifications",
        importance: AndroidImportance.HIGH,
        sound: "default",
        vibration: true,
      });

      // General channel
      await notifee.createChannel({
        id: NOTIFICATION_CHANNELS.GENERAL,
        name: "General",
        description: "General app notifications",
        importance: AndroidImportance.DEFAULT,
        sound: "default",
      });

      console.log("✅ Notification channels created successfully");
    } catch (error) {
      console.error("❌ Error creating notification channels:", error);
    }
  }
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();

    const enabled = settings.authorizationStatus >= 1; // 1 = AUTHORIZED, 2 = PROVISIONAL

    if (enabled) {
      console.log("✅ Notification permission granted");
      await AsyncStorage.setItem(
        STORAGE_KEYS.NOTIFICATION_PERMISSIONS,
        "granted"
      );

      // Log analytics event
      await logAnalyticsEvent("notification_permission_granted");

      return true;
    } else {
      console.log("❌ Notification permission denied");
      await AsyncStorage.setItem(
        STORAGE_KEYS.NOTIFICATION_PERMISSIONS,
        "denied"
      );

      // Log analytics event
      await logAnalyticsEvent("notification_permission_denied");

      return false;
    }
  } catch (error) {
    console.error("❌ Error requesting notification permissions:", error);
    await logAnalyticsEvent("notification_permission_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * Get FCM token and store it
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Register device for remote messages
    await messaging().registerDeviceForRemoteMessages();

    // Get the token
    const token = await messaging().getToken();

    if (token) {
      console.log("✅ FCM Token obtained:", token.substring(0, 20) + "...");

      // Store token locally
      await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, token);

      // Store token in Supabase user profile
      await storeFCMTokenInSupabase(token);

      // Log analytics event
      await logAnalyticsEvent("fcm_token_obtained");

      return token;
    } else {
      console.log("❌ No FCM token received");
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

/**
 * Store FCM token in Supabase user profile
 */
async function storeFCMTokenInSupabase(token: string): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          fcm_token: token,
          fcm_token_updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

      if (error) {
        console.error("❌ Error storing FCM token in Supabase:", error);
      } else {
        console.log("✅ FCM token stored in Supabase successfully");
      }
    }
  } catch (error) {
    console.error("❌ Error updating user profile with FCM token:", error);
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

    // Extract notification data
    const { notification, data } = message;

    // Determine notification channel based on type
    const notificationType = data?.type || NotificationType.GENERAL;
    let channelId: string = NOTIFICATION_CHANNELS.GENERAL;

    switch (notificationType) {
      case NotificationType.PAYOUT_READY:
      case NotificationType.PAYOUT_FAILED:
        channelId = NOTIFICATION_CHANNELS.PAYOUTS;
        break;
      case NotificationType.DEPOSIT_RECEIVED:
        channelId = NOTIFICATION_CHANNELS.DEPOSITS;
        break;
      case NotificationType.SECURITY_ALERT:
        channelId = NOTIFICATION_CHANNELS.SECURITY;
        break;
      default:
        channelId = NOTIFICATION_CHANNELS.GENERAL;
    }

    // Display notification using Notifee
    await notifee.displayNotification({
      title: notification?.title || "Planmoni",
      body: notification?.body || "",
      data: data || {},
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        actions: getNotificationActions(notificationType),
        smallIcon: "ic_notification", // You'll need to add this to your assets
        largeIcon: "ic_launcher", // App icon
        color: "#4F46E5", // Planmoni brand color
        timestamp: Date.now(),
        showTimestamp: true,
      },
      ios: {
        categoryId: notificationType,
        sound: "default",
      },
    });

    console.log("✅ Notification displayed successfully");
  } catch (error) {
    console.error("❌ Error handling FCM message:", error);
    await logAnalyticsEvent("fcm_message_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get notification actions based on notification type
 */
function getNotificationActions(type: NotificationType) {
  switch (type) {
    case NotificationType.PAYOUT_READY:
      return [
        {
          title: "View Payout",
          pressAction: {
            id: "view_payout",
            launchActivity: "default",
          },
        },
      ];
    case NotificationType.DEPOSIT_RECEIVED:
      return [
        {
          title: "View Balance",
          pressAction: {
            id: "view_balance",
            launchActivity: "default",
          },
        },
      ];
    case NotificationType.SECURITY_ALERT:
      return [
        {
          title: "Review Security",
          pressAction: {
            id: "review_security",
            launchActivity: "default",
          },
        },
      ];
    default:
      return [];
  }
}

/**
 * Handle notification actions
 */
export async function handleNotificationAction(detail: any): Promise<void> {
  try {
    const { pressAction, notification } = detail;

    console.log("🔔 Notification action pressed:", pressAction?.id);

    // Log analytics event
    await logAnalyticsEvent("notification_action_pressed", {
      actionId: pressAction?.id,
      notificationType: notification?.data?.type,
    });

    // Handle different actions
    switch (pressAction?.id) {
      case "view_payout":
        // Navigate to payout details
        // You'll implement navigation logic here
        break;
      case "view_balance":
        // Navigate to wallet/balance screen
        // You'll implement navigation logic here
        break;
      case "review_security":
        // Navigate to security settings
        // You'll implement navigation logic here
        break;
      default:
        console.log("Unhandled notification action:", pressAction?.id);
    }
  } catch (error) {
    console.error("❌ Error handling notification action:", error);
  }
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

    // Listen for notification actions
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        await handleNotificationAction(detail);
      }
    });

    // Handle notification actions when app is killed
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        await handleNotificationAction(detail);
      }
    });

    // Listen for token refresh
    messaging().onTokenRefresh(async (token) => {
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

/**
 * Get stored FCM token
 */
export async function getStoredFCMToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.FCM_TOKEN);
  } catch (error) {
    console.error("❌ Error getting stored FCM token:", error);
    return null;
  }
}
