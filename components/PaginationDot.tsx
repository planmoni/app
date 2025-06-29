import React from 'react';
import Animated, { useAnimatedStyle, interpolate, withTiming } from 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';

interface Props {
  index: number;
  scrollX: Animated.SharedValue<number>;
  screenWidth: number;
  isDark: boolean;
  color: string;
}

export default function PaginationDot({ index, scrollX, screenWidth, isDark, color }: Props) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * screenWidth,
      index * screenWidth,
      (index + 1) * screenWidth,
    ];
    const width = interpolate(scrollX.value, inputRange, [8, 24, 8], 'clamp');
    const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], 'clamp');
    return {
      width: withTiming(width, { duration: 250 }),
      opacity: withTiming(opacity, { duration: 250 }),
      backgroundColor: color,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
