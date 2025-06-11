import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PinDisplayProps {
  length: number;
  value: string;
}

export default function PinDisplay({ length, value }: PinDisplayProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // Calculate responsive sizes
  const dotSize = isSmallScreen ? 12 : 16;
  const dotGap = isSmallScreen ? 12 : 16;
  
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: dotGap,
      marginVertical: isSmallScreen ? 16 : 24,
    },
    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
      backgroundColor: isDark ? colors.backgroundSecondary : colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dotFilled: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => (
        <View 
          key={index} 
          style={[
            styles.dot, 
            value.length > index && styles.dotFilled
          ]} 
        />
      ))}
    </View>
  );
}