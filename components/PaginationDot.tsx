// PaginationDot.tsx

import React from 'react';
import Animated, {
  useAnimatedStyle,
  interpolate,
  withTiming,
} from 'react-native-reanimated';
import { ViewStyle } from 'react-native';

interface PaginationDotProps {
  index: number;
  scrollX: Animated.SharedValue<number>;
  screenWidth: number;
  isDark: boolean;
  color: string;
}

const PaginationDot = ({
  index,
  scrollX,
  screenWidth,
  isDark,
  color,
}: PaginationDotProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * screenWidth,
      index * screenWidth,
      (index + 1) * screenWidth,
    ];

    return {
      width: withTiming(interpolate(scrollX.value, inputRange, [8, 24, 8], 'clamp')),
      opacity: withTiming(interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], 'clamp')),
      backgroundColor: isDark ? '#FFFFFF' : color,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
    } as ViewStyle;
  });

  return <Animated.View style={animatedStyle} />;
};

export default PaginationDot;
