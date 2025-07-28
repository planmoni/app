import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get environment variables from Expo Constants for better compatibility
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validation function that returns error messages instead of throwing
function validateSupabaseConfig(): string | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Missing Supabase environment variables. Please check your .env file.';
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch (error) {
    return 'Invalid Supabase URL format. Please check your EXPO_PUBLIC_SUPABASE_URL in .env file.';
  }

  // Validate that the anon key is not a placeholder
  if (supabaseAnonKey.includes('your-') || supabaseAnonKey === '') {
    return 'Invalid Supabase anon key. Please check your EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file.';
  }

  return null;
}

// Validate configuration
const configError = validateSupabaseConfig();

// Declare supabase variable at top level
let supabase: any;

if (configError) {
  console.error('Supabase Configuration Error:', configError);
  // Create a mock client that will show the error when used
  supabase = {
    auth: {
      signUp: () => Promise.reject(new Error(configError)),
      signInWithPassword: () => Promise.reject(new Error(configError)),
      signOut: () => Promise.reject(new Error(configError)),
      getSession: () => Promise.resolve({ data: { session: null }, error: new Error(configError) }),
      onAuthStateChange: () => ({ 
        data: { subscription: { unsubscribe: () => {} } }, 
        error: null 
      }),
    },
    from: () => ({
      select: () => Promise.reject(new Error(configError)),
      insert: () => Promise.reject(new Error(configError)),
      update: () => Promise.reject(new Error(configError)),
      delete: () => Promise.reject(new Error(configError)),
    }),
  };
} else {
  // Configure Supabase with AsyncStorage for session persistence
  supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

// Export at top level
export { supabase };

// Export validation function for use in components if needed
export const getSupabaseConfigError = () => configError;

// Utility function to debug session storage
export const debugSessionStorage = async () => {
  if (Platform.OS === 'web') {
    console.log('🌐 Web platform - checking localStorage');
    try {
      const keys = Object.keys(localStorage);
      const authKeys = keys.filter(key => key.includes('supabase') || key.includes('auth'));
      console.log('📦 Auth-related localStorage keys:', authKeys);
      authKeys.forEach(key => {
        console.log(`  ${key}:`, localStorage.getItem(key));
      });
    } catch (error) {
      console.error('❌ Error accessing localStorage:', error);
    }
  } else {
    console.log('📱 Native platform - checking AsyncStorage');
    try {
      const keys = await AsyncStorage.getAllKeys();
      const authKeys = keys.filter(key => key.includes('supabase') || key.includes('auth'));
      console.log('📦 Auth-related AsyncStorage keys:', authKeys);
      for (const key of authKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`  ${key}:`, value);
      }
    } catch (error) {
      console.error('❌ Error accessing AsyncStorage:', error);
    }
  }
};

// Add global error handler for unhandled promise rejections
// Only add event listener if we're in a browser environment and addEventListener exists
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent the default behavior (which would crash the app)
    event.preventDefault();
  });
}

// For Node.js environments (like during build)
if (typeof process !== 'undefined' && process.on) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}