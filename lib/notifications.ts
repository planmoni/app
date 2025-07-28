import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request notification permissions and get FCM token
export async function registerForPushNotificationsAsync() {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notifications!');
      return null;
    }

    token = (await Notifications.getDevicePushTokenAsync()).data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }
  } else {
    console.log('Must use a physical device for push notifications');
  }

  return token;
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
export async function initializeNotifications(userId: string) {
  try {
    const token = await registerForPushNotificationsAsync();
    
    if (token) {
      console.log('FCM Token:', token);
      await storeFCMToken(userId, token);
    }

    const cleanup = setupNotificationListeners();
    return cleanup;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return null;
  }
} 