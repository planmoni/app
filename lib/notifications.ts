import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
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

// Register for push notifications and get Expo push token
// Following the admin push notifications integration guide
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E3A8A',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get Expo push token with project ID
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('EAS project ID not found in app.json');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })).data;

    console.log('Expo Push Token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  return token;
}

// Save push token to database following the admin push notifications guide
export async function savePushTokenToDatabase(expoPushToken: string, userId: string) {
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const ownerUserId = authUser?.id ?? userId;
    if (!ownerUserId) {
      console.warn('Skipping push token save: no authenticated user');
      return false;
    }

    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      model: Device.modelName,
    };

    const tokenPayload = {
      user_id: ownerUserId,
      expo_push_token: expoPushToken,
      device_info: deviceInfo,
      is_active: true,
      last_used: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Important:
    // Avoid upsert conflict updates here to prevent RLS failures in client-auth context.
    // If a duplicate token exists elsewhere, we treat it as non-fatal and continue with
    // canonical token storage on profiles for sender compatibility.
    const { error } = await supabase
      .from('user_push_tokens')
      .insert(tokenPayload);

    if (error) {
      if (error.code === '23505') {
        console.warn('Push token already exists in user_push_tokens; continuing');
      } else {
        console.error('Error inserting push token:', error);
        throw error;
      }
    }
    
    console.log('Push token stored in database');

    // Canonical storage on profiles for server-side push sender.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        fcm_token: expoPushToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ownerUserId);

    if (profileError) {
      console.error('Error saving token to profiles.fcm_token:', profileError);
    }

    // Legacy compatibility during migration window.
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
          user_id: ownerUserId,
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

    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
}

// Setup notification listeners
export function setupNotificationListeners() {
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received in foreground:', notification.request.content.title);
  });

  return () => {
    foregroundSubscription.remove();
  };
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

// Register push token for admin panel and Intercom
// This should be called whenever the user logs in or the app starts
export async function registerPushToken(userId: string, promptForPermission: boolean = false): Promise<boolean> {
  try {
    // Avoid surprise OS prompts unless explicitly requested by UI flow.
    if (!promptForPermission) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('ℹ️ Push permission not granted yet; skipping token registration');
        return false;
      }
    }

    const token = await registerForPushNotificationsAsync();
    if (token) {
      const stored = await savePushTokenToDatabase(token, userId);
      
      // Register token with Intercom for push notifications
      try {
        const { intercomInstant } = await import('@/lib/IntercomInstant');
        await intercomInstant.registerPushToken(token);
      } catch (intercomError) {
        console.warn('⚠️ Failed to register token with Intercom:', intercomError);
        // Don't fail the whole registration if Intercom fails
      }
      
      // Sync badge count on app start/login
      try {
        const { syncBadgeCount } = await import('@/lib/badge-sync');
        await syncBadgeCount(userId);
      } catch (badgeError) {
        console.warn('⚠️ Failed to sync badge count:', badgeError);
        // Don't fail the whole registration if badge sync fails
      }
      
      if (stored) {
        console.log('✅ Push token registered successfully for admin panel');
        return true;
      } else {
        console.warn('⚠️ Failed to store push token in database');
        return false;
      }
    } else {
      console.log('ℹ️ No push token available (permissions may not be granted)');
      return false;
    }
  } catch (error: any) {
    console.warn(
      '⚠️ Push token registration skipped/failed (local notifications still work):',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

// Refresh push token periodically (tokens can expire or change)
export function setupTokenRefresh(userId: string, intervalMinutes: number = 60): () => void {
  // Refresh immediately
  registerPushToken(userId, false).catch(console.error);
  
  // Set up periodic refresh
  const interval = setInterval(() => {
    console.log('🔄 Refreshing push token...');
    registerPushToken(userId, false).catch(console.error);
  }, intervalMinutes * 60 * 1000);

  // Return cleanup function
  return () => {
    clearInterval(interval);
  };
}

// Initialize notifications
// This sets up local notifications (which work on Android without FCM)
// Push token registration is optional and only needed for remote push notifications
export async function initializeNotifications(userId: string) {
  try {
    // Do NOT prompt here. Permission is requested from the pre-permission screen.
    const { status } = await Notifications.getPermissionsAsync();
    const hasPermission = status === 'granted';

    // Foreground-only diagnostics listener.
    const cleanup = setupNotificationListeners();

    // If already granted, register token silently. Otherwise wait for explicit user action.
    if (hasPermission) {
      try {
        await registerPushToken(userId, false);
      } catch (error: any) {
        // Push token failure is not critical - local notifications still work
        console.log('Push token registration failed (local notifications still work):', error?.message);
      }
    } else {
      console.log('ℹ️ Notifications not enabled yet. Waiting for explicit consent screen action.');
    }

    console.log('Notifications initialized successfully (local notifications ready)');
    return cleanup;
  } catch (error: any) {
    console.error('Error initializing notifications:', error);
    return null;
  }
} 