## 🔧 Notifee + Firebase Push Notification Setup (Expo App)

---

### ✅ 1. Install Required Packages

In your Expo project, run:

```bash
yarn add @notifee/react-native @react-native-firebase/app @react-native-firebase/messaging
```

---

### ✅ 2. Firebase Console Configuration

Create a project in [Firebase Console](https://console.firebase.google.com/), then:

#### 📱 Android:

* Download `google-services.json`
* Place it in your project root (e.g., `./google-services.json`)

#### 🍎 iOS:

* Download `GoogleService-Info.plist`
* Place it in your project root (e.g., `./GoogleService-Info.plist`)

---

### ✅ 3. Update `app.config.js`

```js
// app.config.js
export default {
  name: "YourApp",
  slug: "your-app",
  plugins: ["@notifee/react-native"],
  android: {
    googleServicesFile: "./google-services.json",
    package: "com.yourcompany.yourapp",
  },
  ios: {
    googleServicesFile: "./GoogleService-Info.plist",
    bundleIdentifier: "com.yourcompany.yourapp",
  },
};
```

---

### ✅ 4. Firebase Initialization

```ts
// firebase.ts
import { initializeApp } from '@react-native-firebase/app';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

initializeApp(firebaseConfig);
```

---

### ✅ 5. Notification Setup Logic

```ts
// notifications.ts
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

async function onMessageReceived(message: any) {
  await notifee.displayNotification({
    title: message.notification?.title,
    body: message.notification?.body,
    android: {
      channelId: 'default',
    },
  });
}

export async function setupNotifications() {
  await messaging().registerDeviceForRemoteMessages();

  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('FCM permission granted');
  }

  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: AndroidImportance.HIGH,
    });
  }

  messaging().onMessage(onMessageReceived);
  messaging().setBackgroundMessageHandler(async (message) => {
    console.log('Background message:', message);
  });
}
```

---

### ✅ 6. Use in `App.tsx`

```ts
import React, { useEffect } from 'react';
import { setupNotifications } from './notifications';

export default function App() {
  useEffect(() => {
    setupNotifications();
  }, []);

  return (
    // Your app layout
  );
}
```

---

### ✅ 7. Get FCM Token

Use this token to send notifications:

```ts
const token = await messaging().getToken();
console.log('FCM Token:', token);
```

You can test using the Firebase Console or your own backend.

---

## ✅ Summary (No Build Steps)

| Task                           | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| ✅ Installed required libraries | Notifee, Firebase, Dev client                      |
| ✅ Set up Firebase config files | `google-services.json`, `GoogleService-Info.plist` |
| ✅ Integrated Notifee           | With notification channel for Android              |
| ✅ Registered push handling     | Foreground + background notifications              |
| ✅ Token management             | FCM token fetch and print                          |
