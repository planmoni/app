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
  color?: string;
  isDark?: boolean;
}

export default function PaginationDot({
  index,
  currentIndex = 0,
  scrollX,
  screenWidth = 300,
  color = '#007AFF',
  isDark = false,
}: PaginationDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    if (!scrollX) {
      // Fallback to simple active/inactive state when scrollX is not available
      const isActive = index === currentIndex;
      return {
        opacity: isActive ? 1 : 0.3,
        transform: [{ scale: isActive ? 1.2 : 1 }],
      };
    }

    // Ensure screenWidth is valid to prevent NaN
    const validScreenWidth = screenWidth > 0 ? screenWidth : 300;
    
    const inputRange = [
      (index - 1) * validScreenWidth,
      index * validScreenWidth,
      (index + 1) * validScreenWidth,
    ];

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      'clamp'
    );

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [1, 1.2, 1],
      'clamp'
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  }, [index, currentIndex, scrollX, screenWidth]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 14,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 1,
  },
});