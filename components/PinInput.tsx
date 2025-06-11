import { View, TextInput, StyleSheet, Dimensions } from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import Animated, { useAnimatedStyle, withTiming, withSequence, withDelay } from 'react-native-reanimated';

type PinInputProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  secure?: boolean;
  inputSpacing?: number;
  containerStyle?: any;
};

export default function PinInput({ 
  length, 
  value, 
  onChange, 
  autoFocus = false,
  secure = false,
  inputSpacing,
  containerStyle
}: PinInputProps) {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const windowWidth = Dimensions.get('window').width;
  
  // Calculate responsive sizes
  const isSmallScreen = windowWidth < 380;
  const dotSize = isSmallScreen ? 16 : 20;
  const cellSize = isSmallScreen ? 48 : 56;
  const spacing = inputSpacing !== undefined ? inputSpacing : isSmallScreen ? 12 : 16;
  
  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);
  
  const handleChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Limit to specified length
    if (numericValue.length <= length) {
      onChange(numericValue);
    }
  };
  
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
  };
  
  const renderPinCells = () => {
    const cells = [];
    
    for (let i = 0; i < length; i++) {
      const isCellFilled = i < value.length;
      const isLastFilledCell = i === value.length - 1;
      const isCurrentCell = i === value.length;
      
      const animatedStyle = useAnimatedStyle(() => {
        if (isLastFilledCell) {
          return {
            transform: [
              { scale: withSequence(
                withTiming(1.2, { duration: 50 }),
                withTiming(1, { duration: 100 })
              )}
            ]
          };
        }
        return {};
      });
      
      const cursorAnimatedStyle = useAnimatedStyle(() => {
        if (isCurrentCell && isFocused) {
          return {
            opacity: withDelay(
              300,
              withSequence(
                withTiming(0, { duration: 500 }),
                withTiming(1, { duration: 500 })
              )
            )
          };
        }
        return { opacity: 0 };
      });
      
      cells.push(
        <Animated.View 
          key={i} 
          style={[
            styles.cell,
            { 
              width: cellSize,
              height: cellSize,
              borderColor: isCurrentCell && isFocused ? colors.primary : colors.border,
              backgroundColor: isCellFilled ? colors.backgroundTertiary : colors.surface
            },
            animatedStyle
          ]}
        >
          {isCellFilled ? (
            secure ? (
              <View style={[styles.dot, { width: dotSize, height: dotSize, backgroundColor: colors.text }]} />
            ) : (
              <Animated.Text style={[styles.cellText, { color: colors.text }]}>
                {value[i]}
              </Animated.Text>
            )
          ) : (
            <Animated.View 
              style={[
                styles.cursor, 
                { backgroundColor: colors.primary },
                cursorAnimatedStyle
              ]} 
            />
          )}
        </Animated.View>
      );
    }
    
    return cells;
  };
  
  const styles = createStyles(colors, isDark, spacing);
  
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.cellsContainer}>
        {renderPinCells()}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        caretHidden
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
      />
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, spacing: number) => StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  cellsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing,
    marginBottom: 24,
  },
  cell: {
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 24,
    fontWeight: '600',
  },
  dot: {
    borderRadius: 10,
  },
  cursor: {
    width: 2,
    height: 24,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});