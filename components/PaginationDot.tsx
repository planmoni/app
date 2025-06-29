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
  const slideWidth = width || screenWidth;
  const validWidth = slideWidth > 0 ? slideWidth : 300;

  // 🔐 Safe fallback style for non-animated dots (e.g., on web)
  if (!scrollX) {
    const isActive = index === currentIndex;
    return (
      <View
        style={[
          styles.dot,
          {
            width: isActive ? 24 : 8,
            opacity: isActive ? 1 : 0.5,
            backgroundColor: dotColor,
          },
        ]}
      />
    );
  }

  // 🎥 Animated style for mobile
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * validWidth,
      index * validWidth,
      (index + 1) * validWidth,
    ];

    const dotWidth = interpolate(scrollX.value, inputRange, [8, 24, 8], 'clamp');
    const opacity = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], 'clamp');

    return {
      width: dotWidth,
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: dotColor,
        },
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
