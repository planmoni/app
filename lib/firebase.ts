import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from 'firebase/messaging';
import { Platform } from 'react-native';

// Firebase configuration from google-services.json and GoogleService-Info.plist
const firebaseConfig = {
  apiKey: Platform.OS === 'ios' 
    ? 'AIzaSyBibsoY8hIOFqjQtU5OL2FtCONAY6l7a2o' 
    : 'AIzaSyBhtjKTOiy6bk0b6Ev6iBwTkFM_Kv08768',
  authDomain: 'planmoni-7e669.firebaseapp.com',
  projectId: 'planmoni-7e669',
  storageBucket: 'planmoni-7e669.firebasestorage.app',
  messagingSenderId: '355142174582',
  appId: Platform.OS === 'ios'
    ? '1:355142174582:ios:abcb903ab52233cfbc9c57'
    : '1:355142174582:android:a5602dca3caf5bb5bc9c57',
  measurementId: 'G-LF79E01J2Z', // IMPORTANT: Replace with your actual measurement ID from Firebase console
};

// Initialize Firebase - check if app already exists to prevent duplicate app error
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics with a check for web platform support
let analytics: any = null;
let messaging: any = null;

// Function to initialize analytics
export const initializeAnalytics = async () => {
  try {
    // Check if analytics is supported (important for web)
    if (await isSupported()) {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics initialized successfully');
      return analytics;
    } else {
      console.log('Firebase Analytics is not supported in this environment');
      return null;
    }
  } catch (error) {
    console.error('Error initializing Firebase Analytics:', error);
    return null;
  }
};

// Function to initialize messaging
export const initializeMessaging = async () => {
  try {
    // Check if messaging is supported
    if (await isMessagingSupported()) {
      messaging = getMessaging(app);
      console.log('Firebase Messaging initialized successfully');
      return messaging;
    } else {
      console.log('Firebase Messaging is not supported in this environment');
      return null;
    }
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
};

// Function to get FCM token
export const getFCMToken = async () => {
  try {
    if (!messaging) {
      messaging = await initializeMessaging();
    }
    
    if (!messaging) {
      console.log('Messaging not available');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: 'YOUR_VAPID_KEY' // Replace with your VAPID key
    });
    
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Function to handle foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) {
    console.log('Messaging not available for foreground messages');
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};

// Function to log events safely
export const logAnalyticsEvent = async (eventName: string, eventParams?: Record<string, any>) => {
  try {
    // Initialize analytics if not already initialized
    if (!analytics) {
      analytics = await initializeAnalytics();
    }
    
    // Only log if analytics is available
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
      console.log(`Analytics event logged: ${eventName}`, eventParams);
    }
  } catch (error) {
    console.error(`Error logging analytics event ${eventName}:`, error);
  }
};

export { app, messaging };