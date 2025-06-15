import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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

if (configError) {
  console.error('Supabase Configuration Error:', configError);
  // Create a mock client that will show the error when used
  export const supabase = {
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
  } as any;
} else {
  export const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
}

// Export validation function for use in components if needed
export const getSupabaseConfigError = () => configError;

// Add global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
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