// app.config.js
module.exports = {
  expo: {
    name: "Planmoni",
    owner: "planmoni", // 👈 Add this line
    slug: "planmoni",
    version: "1.0.0",
    scheme: "myapp",
    plugins: ["@react-native-firebase/app", "@react-native-firebase/messaging"],
    android: {
      package: "com.planmoni.app", // ← choose your unique package name
      permissions: [
        "android.permission.CAMERA",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.WAKE_LOCK",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
      ],
      googleServicesFile: "./google-services.json",
    },
    ios: {
      googleServicesFile: "./GoogleService-Info.plist",
      bundleIdentifier: "com.planmoni.app",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
      },
    },
    extra: {
      eas: {
        projectId: "05caad20-9b74-4ba8-8280-dc5939b7ca83",
      },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
      EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY:
        process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
      EXPO_PUBLIC_MONO_PUBLIC_KEY:
        process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY || "",
      EXPO_PUBLIC_MONO_SECRET_KEY:
        process.env.EXPO_PUBLIC_MONO_SECRET_KEY || "",
      // Use platform-specific API URL handling
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || "",
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || "",
      EXPO_PUBLIC_PAYSTACK_SECRET_KEY:
        process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || "",
      EXPO_PUBLIC_DOJAH_APP_ID: process.env.EXPO_PUBLIC_DOJAH_APP_ID || "",
      EXPO_PUBLIC_DOJAH_PRIVATE_KEY:
        process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY || "",
      EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY:
        process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY || "",
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || "",
    },
  },
};
