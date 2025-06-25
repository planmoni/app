import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a custom logger to handle errors gracefully
const customLogger = {
  error: (message: string) => {
    console.error(`[Supabase Error]: ${message}`);
  },
  warn: (message: string) => {
    console.warn(`[Supabase Warning]: ${message}`);
  },
  info: (message: string) => {
    if (__DEV__) {
      console.info(`[Supabase Info]: ${message}`);
    }
  },
  debug: (message: string) => {
    if (__DEV__) {
      console.debug(`[Supabase Debug]: ${message}`);
    }
  },
};

// Create Supabase client with error handling
let supabaseClient;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anonymous Key is missing. Check your .env file.');
  }
  
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-app-version': '1.0.0' },
    },
    logger: customLogger,
  });
  
  console.log('Supabase client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  
  // Create a mock client that won't crash the app
  supabaseClient = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase client not initialized') }),
      getSession: async () => ({ data: { session: null }, error: new Error('Supabase client not initialized') }),
      signInWithPassword: async () => ({ data: { session: null }, error: new Error('Supabase client not initialized') }),
      signUp: async () => ({ data: { user: null }, error: new Error('Supabase client not initialized') }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      insert: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      update: () => ({ data: null, error: new Error('Supabase client not initialized') }),
      delete: () => ({ data: null, error: new Error('Supabase client not initialized') }),
    }),
    channel: () => ({
      on: () => ({ on: () => ({ subscribe: () => {} }) }),
    }),
    removeChannel: () => {},
  } as any;
}

// Add global unhandled promise rejection handler
if (typeof global !== 'undefined') {
  // @ts-ignore
  global.process = global.process || {};
  // @ts-ignore
  global.process.on = global.process.on || function() {};
  
  // @ts-ignore
  global.process.on('unhandledRejection', (reason, promise) => {
    console.warn('Unhandled Promise Rejection:', reason);
  });
}

export const supabase = supabaseClient;