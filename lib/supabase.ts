import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { secureStoreAdapter } from './SecureStoreAdapter';

// Get Supabase configuration from environment
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Create Supabase client with graceful fallback
let supabase: any;

if (supabaseUrl && supabaseAnonKey) {
  // Valid configuration - create real client with SecureStore adapter
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: secureStoreAdapter,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  console.log('✅ Supabase client initialized successfully with SecureStore adapter');
} else {
  // Missing configuration - create mock client that returns user-friendly errors
  console.log('⚠️  Supabase configuration not found, using mock client');
  
  supabase = {
    auth: {
      signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: { message: 'Supabase not configured' } }),
      getSession: async () => ({ data: { session: null }, error: { message: 'Supabase not configured' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      setSession: async () => ({ data: { session: null }, error: { message: 'Supabase not configured' } }),
      refreshSession: async () => ({ data: { session: null }, error: { message: 'Supabase not configured' } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'Supabase not configured' } }) }) }),
      insert: () => ({ select: async () => ({ data: null, error: { message: 'Supabase not configured' } }) }),
      update: () => ({ eq: () => ({ select: async () => ({ data: null, error: { message: 'Supabase not configured' } }) }) }),
      delete: () => ({ eq: async () => ({ data: null, error: { message: 'Supabase not configured' } }) }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => {},
      }),
    }),
    removeChannel: () => {},
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        createSignedUrl: async () => ({ data: { signedUrl: '' }, error: { message: 'Supabase not configured' } }),
        getBucket: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      }),
    },
  };
}

export { supabase };

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Helper function to get configuration status (for debugging)
export const getSupabaseConfigStatus = () => {
  return {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    isConfigured: isSupabaseConfigured(),
    url: supabaseUrl ? 'Set' : 'Missing',
    key: supabaseAnonKey ? 'Set' : 'Missing'
  };
};