// app.config.js
export default {
  expo: {
    name: 'Planmoni',
    // ... other config
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
      EXPO_PUBLIC_MONO_PUBLIC_KEY: process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY || '',
      EXPO_PUBLIC_MONO_SECRET_KEY: process.env.EXPO_PUBLIC_MONO_SECRET_KEY || '',
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || '',
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
      DOJAH_APP_ID: process.env.DOJAH_APP_ID,
      DOJAH_PRIVATE_KEY: process.env.DOJAH_PRIVATE_KEY,
    },
  },
};