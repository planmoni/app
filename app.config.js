import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }) => ({
  ...config,
  name: "Planmoni",
  slug: "planmoni",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/AppIcon.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1E3A8A"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.mosodi.planmoni",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    package: "com.planmoni.app",
    permissions: ["android.permission.CAMERA"]
  },
  web: {
    bundler: "metro",
    output: "server",
    favicon: "./assets/images/AppIcon.png"
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-web-browser"
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    router: {},
    eas: {
      projectId: "05caad20-9b74-4ba8-8280-dc5939b7ca83"
    },
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    EXPO_PUBLIC_MONO_PUBLIC_KEY: process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY || '',
    EXPO_PUBLIC_MONO_SECRET_KEY: process.env.EXPO_PUBLIC_MONO_SECRET_KEY || '',
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || '',
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
    EXPO_PUBLIC_PAYSTACK_SECRET_KEY: process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY || '',
    EXPO_PUBLIC_DOJAH_APP_ID: process.env.EXPO_PUBLIC_DOJAH_APP_ID || '',
    EXPO_PUBLIC_DOJAH_PRIVATE_KEY: process.env.EXPO_PUBLIC_DOJAH_PRIVATE_KEY || '',
    EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY: process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY || '',
    EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
  },
  owner: "planmoni"
});