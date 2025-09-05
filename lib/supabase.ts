import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase configuration from environment
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Create Supabase client with graceful fallback
let supabase: any;

if (supabaseUrl && supabaseAnonKey) {
  // Valid configuration - create real client
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  console.log('✅ Supabase client initialized successfully');
} else {
  // Missing configuration - create mock client that returns user-friendly errors
  console.log('⚠️  Supabase configuration not found, using mock client');
  
  supabase = {
    auth: {
      signUp: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Service temporarily unavailable. Please try again later.', name: 'AuthApiError' } 
      }),
      signInWithPassword: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Invalid email or password. Please check your credentials and try again.', name: 'AuthApiError' } 
      }),
      signOut: () => Promise.resolve({ success: false, error: 'Service temporarily unavailable' }),
      getSession: () => Promise.resolve({ 
        data: { session: null }, 
        error: { message: 'Service temporarily unavailable', name: 'AuthApiError' } 
      }),
      onAuthStateChange: () => ({ 
        data: { subscription: { unsubscribe: () => {} } }, 
        error: null 
      }),
    },
    from: () => ({
      select: () => Promise.resolve({ 
        data: [], 
        error: { message: 'Service temporarily unavailable', name: 'DatabaseError' } 
      }),
      insert: () => Promise.resolve({ 
        data: [], 
        error: { message: 'Service temporarily unavailable', name: 'DatabaseError' } 
      }),
      update: () => Promise.resolve({ 
        data: [], 
        error: { message: 'Service temporarily unavailable', name: 'DatabaseError' } 
      }),
      delete: () => Promise.resolve({ 
        data: [], 
        error: { message: 'Service temporarily unavailable', name: 'DatabaseError' } 
      }),
    }),
    functions: {
      invoke: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Service temporarily unavailable', name: 'FunctionsError' } 
      }),
    },
    rpc: () => Promise.resolve({ 
      data: null, 
      error: { message: 'Service temporarily unavailable', name: 'RpcError' } 
    }),
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