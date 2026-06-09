import React from 'react';
import { ScrollView, View } from 'react-native';

export type SharedValue<T> = { value: T };

const enteringStub = {
  duration: () => enteringStub,
  delay: () => enteringStub,
  springify: () => enteringStub,
};

const AnimatedView = ({ entering, exiting, layout, ...props }: any) => (
  <View {...props} />
);
const AnimatedScrollView = (props: any) => <ScrollView {...props} />;

let reanimatedAvailable = false;

let Animated: any = { View: AnimatedView, ScrollView: AnimatedScrollView };
let FadeIn: any = enteringStub;
let FadeOut: any = enteringStub;
let Layout: any = enteringStub;
let useSharedValue = <T,>(init: T): SharedValue<T> => ({ value: init });
let useAnimatedScrollHandler = () => () => {};
let useAnimatedStyle = (factory: () => Record<string, unknown>) => factory();
let interpolate = (
  value: number,
  input: number[],
  output: number[],
  _extrapolate?: string
) => {
  if (input.length < 2 || output.length < 2) return output[0] ?? value;
  const minIn = input[0];
  const maxIn = input[input.length - 1];
  if (maxIn === minIn) return output[0];
  const t = Math.min(1, Math.max(0, (value - minIn) / (maxIn - minIn)));
  return output[0] + t * (output[output.length - 1] - output[0]);
};

// TurboModule mismatches throw fatal HostFunction errors that JS try/catch cannot
// intercept. Only load react-native-reanimated when explicitly enabled for a
// matching native build (set EXPO_PUBLIC_USE_REANIMATED=true in .env after
// installing a new dev client, or via eas.json for EAS builds).
if (process.env.EXPO_PUBLIC_USE_REANIMATED === 'true') {
  const reanimated = require('react-native-reanimated');
  if (reanimated?.default) {
    Animated = reanimated.default;
    FadeIn = reanimated.FadeIn;
    FadeOut = reanimated.FadeOut;
    Layout = reanimated.Layout;
    useSharedValue = reanimated.useSharedValue;
    useAnimatedScrollHandler = reanimated.useAnimatedScrollHandler;
    useAnimatedStyle = reanimated.useAnimatedStyle;
    interpolate = reanimated.interpolate;
    reanimatedAvailable = true;
  }
}

export {
  Animated,
  FadeIn,
  FadeOut,
  Layout,
  interpolate,
  reanimatedAvailable,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
};
