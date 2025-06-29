import React from 'react';
import Animated, {
  useAnimatedStyle,
  interpolate,
  withTiming,
} from 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

interface PaginationDotProps {
  index: number;
  scrollX: SharedValue<number>;
  screenWidth: number;
  color?: string;
  isDark?: boolean;
}

export default function PaginationDot({
  index,
  scrollX,
  screenWidth,
  color = '#333',
}: PaginationDotProps) {
  const inputRange = [
    (index - 1) * screenWidth,
    index * screenWidth,
    (index + 1) * screenWidth,
  ];

  const animatedDotStyle = useAnimatedStyle(() => {
    const width = interpolate(scrollX.value, inputRange, [8, 24, 8], 'clamp');
    const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], 'clamp');

    return {
      width: withTiming(width, { duration: 250 }),
      opacity: withTiming(opacity, { duration: 250 }),
    };
  });

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, animatedDotStyle]} />
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
