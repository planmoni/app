import React from 'react';
import { View } from 'react-native';

const nativeModulesEnabled =
  process.env.EXPO_PUBLIC_NATIVE_MODULES_SYNCED === 'true' ||
  process.env.EXPO_PUBLIC_USE_REANIMATED === 'true' ||
  process.env.EXPO_PUBLIC_USE_GESTURE_HANDLER === 'true';

let GestureHandlerRootView: React.ComponentType<{ style?: object; children?: React.ReactNode }> =
  View;

if (nativeModulesEnabled) {
  GestureHandlerRootView = require('react-native-gesture-handler').GestureHandlerRootView;
}

export { GestureHandlerRootView, nativeModulesEnabled as gestureHandlerAvailable };
