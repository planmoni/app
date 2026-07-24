// import { ExpoConfig, ConfigContext } from 'expo/config';

// app.config.js
module.exports = {
  expo: {
    name: "Planmoni",
    owner: "planmoni", // 👈 Add this line
    slug: "planmoni",
    version: "2.0.6",
    scheme: "myapp",
    userInterfaceStyle: "automatic", // Allow system to control theme
    newArchEnabled: true,
    updates: {
      url: "https://u.expo.dev/05caad20-9b74-4ba8-8280-dc5939b7ca83"
    },
    runtimeVersion: "1.3.7",
    android: {
      package: "com.planmoni.app", // ← choose your unique package name
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "planmoni.com",
              pathPrefix: "/plan",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      blockedPermissions: [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ],
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
      bundleIdentifier: "app.planmoni",
      associatedDomains: ["applinks:planmoni.com"],
      infoPlist: {
        UIBackgroundModes: ["remote-notification", "processing"],
        LSApplicationQueriesSchemes: ["paystack", "opay", "https", "http"],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["myapp", "app.planmoni"]
          },
          {
            CFBundleURLSchemes: ["exp+planmoni"]
          },
          {
            CFBundleURLSchemes: ["paystack", "opay"]
          }
        ],
        NSCameraUsageDescription: "This app needs access to camera for liveness verification",
        NSMicrophoneUsageDescription: "This app uses the microphone to provide a better experience.",
        NSPhotoLibraryUsageDescription: "This app uses the photo library to provide a better experience."
      },
      entitlements: {
        "aps-environment": "development", // ✅ Required for push notification, change to "production" for Testflight and App Store builds
        "keychain-access-groups": ["$(AppIdentifierPrefix)app.planmoni"],
        "com.apple.security.application-groups": ["group.app.planmoni.widget"]
      },
      userInterfaceStyle: "automatic",
    },
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      // Native-only: re-add after EAS build/prebuild links expo-task-manager.
      // Shipping this plugin in OTA without a matching binary crashes Android.
      // "expo-background-task",
      // After secure-store: force tools:replace so AppsFlyer backup rules don't break manifest merge
      "./plugins/withAndroidBackupRulesConflictFix",
      "expo-web-browser",
      // Configure org + project (and EAS SENTRY_AUTH_TOKEN) before enabling uploads.
      // See: https://docs.sentry.io/platforms/react-native/manual-setup/
      [
        "@sentry/react-native",
        {
          // organization: "your-org-slug",
          // project: "your-project-slug",
        },
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Planmoni needs access to your photos to upload document images.",
          "cameraPermission": "Planmoni needs access to your camera to take document photos."
        }
      ],
      [
        "@intercom/intercom-react-native",
        {
          "appId": "tf4dp3qt",
          "androidApiKey": "android_sdk-c13200a10981c64eb6e2b4030551b67de50243bf",
          "iosApiKey": "ios_sdk-0defee459efb13cd27f68001a4f66ca6b468d9f4",
          "intercomRegion": "US"
        }
      ],
      "@react-native-firebase/app",
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 24,
            "compileSdkVersion": 36,
            "targetSdkVersion": 36,
            "buildToolsVersion": "36.0.0"
          },
          "ios": {
            "deploymentTarget": "15.1",
            "useFrameworks": "static",
            "forceStaticLinking": ["RNFBApp", "RNFBMessaging"]
          }
        }
      ],
      [
        "expo-local-authentication",
        {
          faceIDPermission: "Planmoni uses Face ID to unlock the app and confirm payouts and withdrawals."
        }
      ],
      "expo-navigation-bar",
      "expo-document-picker",
      "@bacons/apple-targets"
    ],
    extra: {
      eas: {
        projectId: "05caad20-9b74-4ba8-8280-dc5939b7ca83",
      },
      // ✅ SAFE: Public variables that can be exposed in client bundle
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
      EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY:
        process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
      EXPO_PUBLIC_MONO_PUBLIC_KEY:
        process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY || "",
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || "",
      EXPO_PUBLIC_DOJAH_APP_ID: process.env.EXPO_PUBLIC_DOJAH_APP_ID || "",
      EXPO_PUBLIC_APP_URL: process.env.EXPO_PUBLIC_APP_URL || "",
      
      // ❌ REMOVED: Secret keys should NEVER be in EXPO_PUBLIC_ variables
      // These are now server-side only (no EXPO_PUBLIC_ prefix):
      // - MONO_SECRET_KEY (use Supabase Edge Function: mono-api-proxy)
      // - PAYSTACK_SECRET_KEY (use server-side API routes)
      // - PAYSTACK_LIVE_SECRET_KEY (use server-side API routes)
      // - DOJAH_PRIVATE_KEY (use server-side API routes)
      // - OPENAI_API_KEY (use Supabase Edge Function: openai-proxy)
      // - RESEND_API_KEY (already server-side in Supabase functions)
      // Intercom configuration
      INTERCOM_IOS_API_KEY: "ios_sdk-de52645ae34ab0f059890a422f90b18092032115",
      INTERCOM_ANDROID_API_KEY: "android_sdk-c13200a10981c64eb6e2b4030551b67de50243bf",
      INTERCOM_APP_ID: "tf4dp3qt",
    },
  },
};
