import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';

interface PaginationDotProps {
  index: number;
  currentIndex?: number;
  scrollX?: SharedValue<number>;
  screenWidth?: number;
  width?: number;
  activeColor?: string;
  inactiveColor?: string;
  isDark?: boolean;
  color?: string;
}

export default function PaginationDot({
  index,
  currentIndex = 0,
  scrollX,
  screenWidth = 300,
  width = 300,
  activeColor = '#007AFF',
  inactiveColor,
  isDark = false,
  color,
}: PaginationDotProps) {
  const dotColor = color || activeColor;
  const dotInactiveColor = inactiveColor || dotColor;
  const slideWidth = width || screenWidth || 300;

  const animatedStyle = useAnimatedStyle(() => {
    // Fallback if scrollX is not passed or invalid
    if (!scrollX || typeof scrollX.value !== 'number') {
      return {
        width: index === currentIndex ? 24 : 8,
        opacity: index === currentIndex ? 1 : 0.5,
      };
    }

    const inputRange = [
      (index - 1) * slideWidth,
      index * slideWidth,
      (index + 1) * slideWidth,
    ];

    return {
      width: interpolate(scrollX.value, inputRange, [8, 24, 8], 'clamp'),
      opacity: interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], 'clamp'),
    };
  }, [scrollX, index, currentIndex]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: dotColor },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
