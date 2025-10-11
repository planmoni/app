// import { ExpoConfig, ConfigContext } from 'expo/config';

// app.config.js
export default {
  expo: {
    name: 'Planmoni',
    owner: "planmoni", // 👈 Add this line
    slug: "planmoni",
    version: "1.0.0",
    scheme: "myapp",
    updates: {
      url: "https://u.expo.dev/05caad20-9b74-4ba8-8280-dc5939b7ca83"
    },
    runtimeVersion: "1.0.0",
    android: {
      package: "com.planmoni", // ← choose your unique package name
      "permissions": ["android.permission.CAMERA"]
    },
    ios: {
      "bundleIdentifier": "app.planmoni"
    },
    extra: {
      "eas": {
        "projectId": "05caad20-9b74-4ba8-8280-dc5939b7ca83"
      },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
      EXPO_PUBLIC_MONO_PUBLIC_KEY: process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY || '',
      EXPO_PUBLIC_MONO_SECRET_KEY: process.env.EXPO_PUBLIC_MONO_SECRET_KEY || '',
      // Use platform-specific API URL handling
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || '',
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
      EXPO_PUBLIC_PAYSTACK_SECRET_KEY: process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || '',
      EXPO_PUBLIC_DOJAH_APP_ID: process.env.EXPO_PUBLIC_DOJAH_APP_ID || '',
      EXPO_PUBLIC_DOJAH_PRIVATE_KEY: process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY || '',
      EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY: process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY || '',
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
      // Intercom configuration
      INTERCOM_IOS_API_KEY: "ios_sdk-de52645ae34ab0f059890a422f90b18092032115",
      INTERCOM_ANDROID_API_KEY: "android_sdk-c13200a10981c64eb6e2b4030551b67de50243bf",
      INTERCOM_APP_ID: "tf4dp3qt",
    },
  },
};