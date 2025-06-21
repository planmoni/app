import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
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
  measurementId: 'G-XXXXXXXXXX', // IMPORTANT: Replace with your actual measurement ID from Firebase console
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics with a check for web platform support
let analytics: any = null;

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

export { app };