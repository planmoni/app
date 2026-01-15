import { Platform } from "react-native";

// Firebase is auto-initialized from google-services.json (Android) and GoogleService-Info.plist (iOS)
// No manual initialization needed for @react-native-firebase

// Conditionally import Firebase modules (may not be available until native rebuild)
let messaging: any = null;
let FirebaseMessagingTypes: any = null;
let analytics: any = null;

try {
  const messagingModule = require('@react-native-firebase/messaging');
  messaging = messagingModule.default;
  FirebaseMessagingTypes = messagingModule.FirebaseMessagingTypes;
} catch (e) {
  console.log('Firebase Messaging not available - native module not linked. Rebuild required.');
}

try {
  analytics = require('@react-native-firebase/analytics').default;
} catch (e) {
  console.log('Firebase Analytics not available (optional package)');
}

let messagingInitialized = false;

// Function to initialize messaging
export const initializeMessaging = async () => {
  try {
    if (!messaging) {
      console.log('Firebase Messaging not available - native module not linked');
      return null;
    }

    if (messagingInitialized) {
      return messaging();
    }

    // Request permission for iOS
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('Firebase Messaging permission not granted');
        return null;
      }
    }

    // Register device for remote messages (iOS)
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    messagingInitialized = true;
    console.log('Firebase Messaging initialized successfully');
    return messaging();
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
};

// Function to get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const messagingInstance = await initializeMessaging();
    
    if (!messagingInstance) {
      console.log('Messaging not available');
      return null;
    }

    const token = await messagingInstance.getToken();
    
    if (token) {
      console.log('FCM Token obtained successfully');
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Function to handle foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  try {
    if (!messaging) {
      console.log('Firebase Messaging not available - cannot set up foreground listener');
      return () => {};
    }
    return messaging().onMessage(async (remoteMessage: any) => {
      console.log('Foreground message received:', remoteMessage);
      callback(remoteMessage);
    });
  } catch (error) {
    console.error('Error setting up foreground message listener:', error);
    return () => {};
  }
};

// Function to log events safely
export const logAnalyticsEvent = async (
  eventName: string,
  eventParams?: Record<string, any>
) => {
  try {
    if (analytics) {
      await analytics().logEvent(eventName, eventParams);
      console.log(`Analytics event logged: ${eventName}`, eventParams);
    } else {
      // Analytics not available, silently skip (non-critical)
      console.log(`[Analytics] ${eventName}`, eventParams);
    }
  } catch (error) {
    console.error(`Error logging analytics event ${eventName}:`, error);
  }
};

// Export messaging instance getter
export const getMessaging = () => {
  if (!messaging) {
    console.log('Firebase Messaging not available');
    return null;
  }
  return messaging();
};
