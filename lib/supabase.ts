import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error('Invalid Supabase URL format. Please check your EXPO_PUBLIC_SUPABASE_URL in .env file.');
}

// Validate that the anon key is not a placeholder
if (supabaseAnonKey.includes('your-') || supabaseAnonKey === '') {
  throw new Error('Invalid Supabase anon key. Please check your EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);