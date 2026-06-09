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

const createAnimatedComponent = (Component: React.ComponentType<any>) => Component;

let reanimatedAvailable = false;

let Animated: any = {
  View: AnimatedView,
  ScrollView: AnimatedScrollView,
  createAnimatedComponent,
};
let FadeIn: any = enteringStub;
let FadeInDown: any = enteringStub;
let FadeOut: any = enteringStub;
let Layout: any = enteringStub;
let Easing: any = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  out: (fn: (t: number) => number) => fn,
};
let useSharedValue = <T,>(init: T): SharedValue<T> => ({ value: init });
let useAnimatedScrollHandler = () => () => {};
let useAnimatedStyle = (factory: () => Record<string, unknown>) => factory();
let useAnimatedProps = (factory: () => Record<string, unknown>) => factory();
let useAnimatedReaction = () => {};
let withTiming: any = (value: unknown) => value;
let cancelAnimation: any = () => {};
let runOnJS = <T extends (...args: any[]) => any>(fn: T) => fn;
let Extrapolate = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
let interpolate = (
  value: number,
  input: number[],
  output: number[],
  extrapolate?: string
) => {
  if (input.length === 0 || output.length === 0) return value;
  if (input.length !== output.length) return output[0];

  const clamp =
    extrapolate === 'clamp' ||
    extrapolate === Extrapolate.CLAMP ||
    extrapolate === undefined;

  if (value <= input[0]) {
    return clamp ? output[0] : output[0];
  }
  if (value >= input[input.length - 1]) {
    return clamp ? output[output.length - 1] : output[output.length - 1];
  }

  for (let i = 0; i < input.length - 1; i++) {
    if (value >= input[i] && value <= input[i + 1]) {
      const range = input[i + 1] - input[i];
      if (range === 0) return output[i];
      const t = (value - input[i]) / range;
      return output[i] + t * (output[i + 1] - output[i]);
    }
  }

  return output[0];
};

const nativeModulesEnabled =
  process.env.EXPO_PUBLIC_NATIVE_MODULES_SYNCED === 'true' ||
  process.env.EXPO_PUBLIC_USE_REANIMATED === 'true';

if (nativeModulesEnabled) {
  const reanimated = require('react-native-reanimated');
  if (reanimated?.default) {
    Animated = reanimated.default;
    FadeIn = reanimated.FadeIn;
    FadeInDown = reanimated.FadeInDown;
    FadeOut = reanimated.FadeOut;
    Layout = reanimated.Layout;
    Easing = reanimated.Easing;
    useSharedValue = reanimated.useSharedValue;
    useAnimatedScrollHandler = reanimated.useAnimatedScrollHandler;
    useAnimatedStyle = reanimated.useAnimatedStyle;
    useAnimatedProps = reanimated.useAnimatedProps;
    useAnimatedReaction = reanimated.useAnimatedReaction;
    withTiming = reanimated.withTiming;
    cancelAnimation = reanimated.cancelAnimation;
    interpolate = reanimated.interpolate;
    runOnJS = reanimated.runOnJS;
    Extrapolate = reanimated.Extrapolate;
    reanimatedAvailable = true;
  }
}

export {
  Animated,
  cancelAnimation,
  Easing,
  Extrapolate,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  Layout,
  reanimatedAvailable,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
};
