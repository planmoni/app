// import { ExpoConfig, ConfigContext } from 'expo/config';

// app.config.js
module.exports = {
  expo: {
    name: "Planmoni",
    owner: "planmoni", // 👈 Add this line
    slug: "planmoni",
    version: "1.1.0",
    scheme: "myapp",
    userInterfaceStyle: "automatic", // Allow system to control theme
    updates: {
      url: "https://u.expo.dev/05caad20-9b74-4ba8-8280-dc5939b7ca83"
    },
    runtimeVersion: "1.1.0",
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
      package: "com.planmoni", // ← choose your unique package name
      "userInterfaceStyle": "automatic",
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_EXTERNAL_STORAGE"
      ]
    },
    ios: {
      "bundleIdentifier": "com.planmoni",
      "userInterfaceStyle": "automatic",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"], // ✅ Required for push notifications
        "NSCameraUsageDescription": "This app needs access to camera for liveness verification",
        "NSMicrophoneUsageDescription": "This app uses the microphone to provide a better experience.",
        "NSPhotoLibraryUsageDescription": "This app uses the photo library to provide a better experience."
      },
      "entitlements": {
        "aps-environment": "development", // ✅ Required for push notification, change to "production" for Testflight and App Store builds
        "keychain-access-groups": ["$(AppIdentifierPrefix)com.planmoni"]
      }
    },
    "plugins": [
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
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 21,
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "buildToolsVersion": "35.0.0"
          },
          "ios": {
            "deploymentTarget": "16.0"
          }
        }
       
      ],
      [
        "react-native-vision-camera",
        {
          "cameraPermissionText": "$(PRODUCT_NAME) needs access to your Camera to take photos for liveness verification.",
          "enableMicrophonePermission": false,
          "enableFrameProcessors": true
        }
      ]
    ],
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
